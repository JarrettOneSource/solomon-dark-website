using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;

namespace SolomonDarkRevived.Services;

public sealed record CloudSaveArchiveInspection(
    string? Name,
    int FileCount,
    long UncompressedSize,
    int FormatVersion);

public static class CloudSaveArchiveInspector
{
    public const int FormatVersion = 1;
    public const int MaxArchiveBytes = 16 * 1024 * 1024;
    public const long MaxUncompressedBytes = 64L * 1024 * 1024;
    public const int MaxFiles = 256;

    private const int MaxManifestBytes = 128 * 1024;
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    public static CloudSaveArchiveInspection Inspect(ReadOnlyMemory<byte> bytes, int expectedSlot)
    {
        try
        {
            using var stream = new MemoryStream(bytes.ToArray(), writable: false);
            using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: false);
            return InspectArchive(archive, expectedSlot);
        }
        catch (InvalidDataException)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is IOException or JsonException or NotSupportedException)
        {
            throw new InvalidDataException(
                "The cloud save is not a valid launcher save archive.",
                exception);
        }
    }

    private static CloudSaveArchiveInspection InspectArchive(
        ZipArchive archive,
        int expectedSlot)
    {
        var entries = new Dictionary<string, ZipArchiveEntry>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in archive.Entries)
        {
            if (!entries.TryAdd(entry.FullName, entry))
            {
                throw new InvalidDataException("Cloud save archives cannot contain duplicate paths.");
            }
            if (entry.FullName.Contains('\\') || IsUnsafePath(entry.FullName))
            {
                throw new InvalidDataException("Cloud save archives contain an unsafe path.");
            }
            if (IsSymbolicLink(entry))
            {
                throw new InvalidDataException("Cloud save archives cannot contain symbolic links.");
            }
        }
        if (entries.Count > MaxFiles + 1)
        {
            throw new InvalidDataException("Cloud save archives contain too many entries.");
        }

        if (!entries.TryGetValue("manifest.json", out var manifestEntry) ||
            manifestEntry.Length is <= 0 or > MaxManifestBytes)
        {
            throw new InvalidDataException("Cloud save archives require a bounded manifest.json.");
        }

        ArchiveManifest? manifest;
        using (var manifestStream = manifestEntry.Open())
        {
            manifest = JsonSerializer.Deserialize<ArchiveManifest>(manifestStream, JsonOptions);
        }
        if (manifest is null ||
            manifest.SchemaVersion != FormatVersion ||
            manifest.Slot != expectedSlot ||
            manifest.Name is { } name &&
                (name.Length > 40 || name.Any(char.IsControl)) ||
            manifest.Files is null ||
            manifest.Files.Count is <= 0 or > MaxFiles)
        {
            throw new InvalidDataException("The cloud save manifest is invalid.");
        }

        var actualFiles = entries
            .Where(pair =>
                !string.Equals(pair.Key, "manifest.json", StringComparison.OrdinalIgnoreCase) &&
                !pair.Key.EndsWith('/'))
            .ToDictionary(
                pair => NormalizeSavePath(pair.Key),
                pair => pair.Value,
                StringComparer.OrdinalIgnoreCase);
        if (actualFiles.Count != manifest.Files.Count)
        {
            throw new InvalidDataException("The cloud save manifest does not match its files.");
        }

        long totalBytes = 0;
        var manifestPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in manifest.Files)
        {
            var path = NormalizeManifestPath(file.Path);
            if (!manifestPaths.Add(path) ||
                !actualFiles.TryGetValue(path, out var entry) ||
                entry.Length != file.Size ||
                !IsSha256(file.Sha256))
            {
                throw new InvalidDataException("The cloud save manifest does not match its files.");
            }

            if (entry.Length > MaxUncompressedBytes - totalBytes)
            {
                throw new InvalidDataException("Cloud saves may not expand beyond 64 MiB.");
            }
            totalBytes += entry.Length;

            using var fileStream = entry.Open();
            var sha256 = Convert.ToHexString(SHA256.HashData(fileStream)).ToLowerInvariant();
            if (!string.Equals(sha256, file.Sha256, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidDataException("A cloud save file failed its integrity check.");
            }
        }

        return new CloudSaveArchiveInspection(
            string.IsNullOrWhiteSpace(manifest.Name) ? null : manifest.Name.Trim(),
            manifest.Files.Count,
            totalBytes,
            FormatVersion);
    }

    private static string NormalizeSavePath(string archivePath)
    {
        const string prefix = "savegames/";
        if (!archivePath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException(
                "Cloud save archives may contain only manifest.json and savegames files.");
        }
        return NormalizeManifestPath(archivePath[prefix.Length..]);
    }

    private static string NormalizeManifestPath(string? path)
    {
        path = path?.Trim();
        if (string.IsNullOrEmpty(path) ||
            path.Length > 240 ||
            path.Contains('\\') ||
            IsUnsafePath(path) ||
            !path.StartsWith("solomondark/", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException("The cloud save manifest contains an unsafe file path.");
        }
        return path;
    }

    private static bool IsUnsafePath(string path) =>
        path.StartsWith('/') ||
        path.Contains(':') ||
        path.Split('/').Any(part => part is "" or "." or "..");

    private static bool IsSymbolicLink(ZipArchiveEntry entry)
    {
        const int unixFileTypeMask = 0xF000;
        const int unixSymbolicLink = 0xA000;
        return ((entry.ExternalAttributes >> 16) & unixFileTypeMask) == unixSymbolicLink;
    }

    private static bool IsSha256(string? value) =>
        value is { Length: 64 } &&
        value.All(character =>
            character is >= '0' and <= '9' or
            >= 'a' and <= 'f' or
            >= 'A' and <= 'F');

    private sealed class ArchiveManifest
    {
        public int SchemaVersion { get; init; }
        public int Slot { get; init; }
        public string? Name { get; init; }
        public List<ArchiveFile>? Files { get; init; }
    }

    private sealed class ArchiveFile
    {
        public string? Path { get; init; }
        public long Size { get; init; }
        public string? Sha256 { get; init; }
    }
}
