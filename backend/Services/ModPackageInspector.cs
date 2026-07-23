using System.Buffers;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace SolomonDarkRevived.Services;

public sealed record ModPackageInspection(
    string LauncherModId,
    string ManifestName,
    string ManifestVersion,
    string PackageSha256,
    string ContentSha256,
    bool HasOverlays,
    bool HasBoneyards,
    bool HasLua,
    IReadOnlyList<string> RequiredMods);

public sealed class ModPackageValidationException(string message) : Exception(message);

public static partial class ModPackageInspector
{
    private const int MaxEntries = 2048;
    private const long MaxExpandedBytes = 256L * 1024 * 1024;
    private const long MaxManifestBytes = 1024 * 1024;
    private const int MaxRelativePathLength = 240;
    private const int MaxManifestItems = 256;
    private const int MaxStringLength = 256;

    private static readonly JsonSerializerOptions ManifestJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        MaxDepth = 16
    };

    public static async Task<ModPackageInspection> InspectAsync(
        Stream packageStream,
        CancellationToken cancellationToken = default)
    {
        if (!packageStream.CanSeek)
        {
            throw new ModPackageValidationException("The uploaded archive could not be inspected.");
        }

        packageStream.Position = 0;
        var packageSha256 = await HashStreamAsync(packageStream, cancellationToken);
        packageStream.Position = 0;

        try
        {
            using var archive = new ZipArchive(packageStream, ZipArchiveMode.Read, leaveOpen: true);
            if (archive.Entries.Count == 0)
            {
                throw new ModPackageValidationException("The mod archive is empty.");
            }

            if (archive.Entries.Count > MaxEntries)
            {
                throw new ModPackageValidationException($"Mod archives may contain at most {MaxEntries} entries.");
            }

            var fileEntries = new Dictionary<string, ZipArchiveEntry>(StringComparer.Ordinal);
            var portablePaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            long expandedBytes = 0;
            foreach (var entry in archive.Entries)
            {
                var path = ValidateArchiveEntry(entry);
                var collisionKey = path.TrimEnd('/');
                if (!portablePaths.Add(collisionKey))
                {
                    throw new ModPackageValidationException(
                        $"The archive contains duplicate or case-conflicting paths: {path}");
                }

                if (path.EndsWith("/", StringComparison.Ordinal))
                {
                    continue;
                }

                if (path.EndsWith(".dll", StringComparison.OrdinalIgnoreCase))
                {
                    throw new ModPackageValidationException(
                        $"The archive contains a file type outside the mod package contract: {path}");
                }

                expandedBytes = checked(expandedBytes + entry.Length);
                if (expandedBytes > MaxExpandedBytes)
                {
                    throw new ModPackageValidationException(
                        "The expanded mod archive may not exceed 256 MiB.");
                }

                fileEntries.Add(path, entry);
            }

            ValidateArchiveTree(fileEntries.Keys);

            if (!fileEntries.TryGetValue("manifest.json", out var manifestEntry))
            {
                throw new ModPackageValidationException(
                    "The archive must contain manifest.json at its root.");
            }

            if (manifestEntry.Length > MaxManifestBytes)
            {
                throw new ModPackageValidationException("manifest.json may not exceed 1 MiB.");
            }

            var manifest = await ReadManifestAsync(manifestEntry, cancellationToken);
            ValidateManifest(manifest, fileEntries);

            using var aggregate = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            foreach (var pair in fileEntries.OrderBy(pair => pair.Key, StringComparer.Ordinal))
            {
                await using var entryStream = pair.Value.Open();
                var fileSha256 = await HashStreamAsync(entryStream, cancellationToken);
                var record = $"{pair.Key}\0{fileSha256}\n";
                aggregate.AppendData(Encoding.UTF8.GetBytes(record));
            }

            var contentSha256 = Convert.ToHexString(aggregate.GetHashAndReset()).ToLowerInvariant();
            return new ModPackageInspection(
                manifest.Id,
                manifest.Name,
                manifest.Version,
                packageSha256,
                contentSha256,
                manifest.Overlays.Count > 0,
                manifest.Overlays.Any(overlay =>
                    overlay.Target.EndsWith(".boneyard", StringComparison.OrdinalIgnoreCase)),
                !string.IsNullOrWhiteSpace(manifest.Runtime.EntryScript),
                manifest.RequiredMods.ToArray());
        }
        catch (ModPackageValidationException)
        {
            throw;
        }
        catch (Exception exception) when (exception is InvalidDataException or JsonException or OverflowException)
        {
            throw new ModPackageValidationException("The mod archive is not a valid ZIP package.");
        }
        finally
        {
            packageStream.Position = 0;
        }
    }

    private static string ValidateArchiveEntry(ZipArchiveEntry entry)
    {
        var path = entry.FullName;
        if (path.Length == 0 || path.Length > MaxRelativePathLength)
        {
            throw new ModPackageValidationException(
                $"Archive paths must be 1-{MaxRelativePathLength} characters.");
        }

        if (path.StartsWith("/", StringComparison.Ordinal) ||
            path.Contains('\\') ||
            path.Contains('\0'))
        {
            throw new ModPackageValidationException($"Archive paths must be relative and use '/': {path}");
        }

        var isDirectory = path.EndsWith("/", StringComparison.Ordinal);
        var segments = path.TrimEnd('/').Split('/');
        if (segments.Any(segment => !IsPortablePathSegment(segment)))
        {
            throw new ModPackageValidationException($"Archive path is not portable: {path}");
        }

        var unixFileType = (entry.ExternalAttributes >> 16) & 0xF000;
        if (unixFileType == 0xA000 ||
            (entry.ExternalAttributes & (int)FileAttributes.ReparsePoint) != 0)
        {
            throw new ModPackageValidationException($"Archive links are not allowed: {path}");
        }

        if (isDirectory && entry.Length != 0)
        {
            throw new ModPackageValidationException($"Invalid directory entry: {path}");
        }

        return path;
    }

    private static bool IsPortablePathSegment(string segment)
    {
        if (segment.Length == 0 || segment is "." or ".." ||
            segment.EndsWith(' ') || segment.EndsWith('.'))
        {
            return false;
        }

        if (segment.Any(character =>
                character < 0x20 || character is '<' or '>' or ':' or '"' or '|' or '?' or '*'))
        {
            return false;
        }

        var baseName = segment.Split('.', 2)[0];
        return !WindowsReservedNameRegex().IsMatch(baseName);
    }

    private static async Task<PackageManifest> ReadManifestAsync(
        ZipArchiveEntry entry,
        CancellationToken cancellationToken)
    {
        await using var stream = entry.Open();
        var manifest = await JsonSerializer.DeserializeAsync<PackageManifest>(
            stream,
            ManifestJsonOptions,
            cancellationToken);
        return manifest ?? throw new ModPackageValidationException("manifest.json is empty.");
    }

    private static void ValidateManifest(
        PackageManifest manifest,
        IReadOnlyDictionary<string, ZipArchiveEntry> files)
    {
        if (manifest.Id is null || manifest.Name is null || manifest.Version is null ||
            manifest.Overlays is null || manifest.Runtime is null ||
            manifest.RequiredMods is null ||
            manifest.Overlays.Any(overlay => overlay is null) ||
            manifest.RequiredMods.Any(required => required is null) ||
            manifest.Runtime.RequiredCapabilities is null ||
            manifest.Runtime.OptionalCapabilities is null ||
            manifest.Runtime.RequiredCapabilities.Any(capability => capability is null) ||
            manifest.Runtime.OptionalCapabilities.Any(capability => capability is null))
        {
            throw new ModPackageValidationException("manifest.json contains null fields or list entries.");
        }

        if (manifest.ExtensionData is { Count: > 0 } ||
            manifest.Overlays.Any(overlay => overlay.ExtensionData is { Count: > 0 }) ||
            manifest.Runtime.ExtensionData is { Count: > 0 })
        {
            throw new ModPackageValidationException(
                "manifest.json contains fields that are not part of the package contract.");
        }

        if (!LauncherModIdRegex().IsMatch(manifest.Id))
        {
            throw new ModPackageValidationException(
                "manifest.id must be 1-128 characters using letters, numbers, '.', '_', or '-'.");
        }

        if (string.IsNullOrWhiteSpace(manifest.Name) || manifest.Name.Length > 80)
        {
            throw new ModPackageValidationException("manifest.name must be 1-80 characters.");
        }

        if (!StorageService.IsSafeVersion(manifest.Version))
        {
            throw new ModPackageValidationException(
                "manifest.version must be 1-64 filename-safe characters.");
        }

        if (manifest.Priority is < -100_000 or > 100_000)
        {
            throw new ModPackageValidationException("manifest.priority is outside the supported range.");
        }

        if (manifest.Overlays.Count > MaxManifestItems ||
            manifest.RequiredMods.Count > MaxManifestItems ||
            manifest.Runtime.RequiredCapabilities.Count > MaxManifestItems ||
            manifest.Runtime.OptionalCapabilities.Count > MaxManifestItems)
        {
            throw new ModPackageValidationException(
                $"Manifest lists may contain at most {MaxManifestItems} entries.");
        }

        var hasLua = !string.IsNullOrWhiteSpace(manifest.Runtime.EntryScript);
        if (manifest.Overlays.Count == 0 && !hasLua)
        {
            throw new ModPackageValidationException(
                "A mod must define at least one overlay or a Lua runtime entry script.");
        }

        var overlaySources = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var overlay in manifest.Overlays)
        {
            if (overlay.Target is null || overlay.Source is null || overlay.Format is null)
            {
                throw new ModPackageValidationException("Overlay fields may not be null.");
            }
            var source = ValidateManifestPath(overlay.Source, "Overlay source");
            if (!source.StartsWith("files/", StringComparison.Ordinal) || !files.ContainsKey(source))
            {
                throw new ModPackageValidationException(
                    $"Overlay source must name an existing file under files/: {overlay.Source}");
            }

            if (!overlaySources.Add(source))
            {
                throw new ModPackageValidationException($"Duplicate overlay source: {source}");
            }

            var target = ValidateManifestPath(overlay.Target, "Overlay target");
            var allowedStockBoneyard =
                target.StartsWith("data/levels/", StringComparison.Ordinal) &&
                target.EndsWith(".boneyard", StringComparison.Ordinal);
            var allowedImageTarget = target.StartsWith("images/", StringComparison.Ordinal);
            var allowedCustomBoneyard =
                target.StartsWith("sandbox/DarkCloud/mylevels/", StringComparison.Ordinal) &&
                target.EndsWith(".boneyard", StringComparison.Ordinal);
            if (!allowedStockBoneyard && !allowedImageTarget && !allowedCustomBoneyard)
            {
                throw new ModPackageValidationException(
                    $"Website overlays must target Boneyards under data/levels/ or sandbox/DarkCloud/mylevels/, or art under images/: {overlay.Target}");
            }

            if (overlay.Format.Length > MaxStringLength)
            {
                throw new ModPackageValidationException("Overlay format values may not exceed 256 characters.");
            }

            ValidateBoneyardOverlay(overlay, source, target, files[source]);
        }

        if (hasLua)
        {
            if (string.IsNullOrWhiteSpace(manifest.Runtime.ApiVersion) ||
                manifest.Runtime.ApiVersion.Length > 64)
            {
                throw new ModPackageValidationException(
                    "Lua mods must define runtime.apiVersion using at most 64 characters.");
            }

            var entryScript = ValidateManifestPath(manifest.Runtime.EntryScript, "Runtime entryScript");
            if (!entryScript.StartsWith("scripts/", StringComparison.Ordinal) ||
                !entryScript.EndsWith(".lua", StringComparison.Ordinal) ||
                !files.ContainsKey(entryScript))
            {
                throw new ModPackageValidationException(
                    "runtime.entryScript must name an existing .lua file under scripts/.");
            }
        }

        ValidateUniqueStrings(
            manifest.Runtime.RequiredCapabilities,
            "runtime.requiredCapabilities",
            CapabilityRegex());
        ValidateUniqueStrings(
            manifest.Runtime.OptionalCapabilities,
            "runtime.optionalCapabilities",
            CapabilityRegex());
        ValidateUniqueStrings(manifest.RequiredMods, "requiredMods", LauncherModIdRegex());
        if (manifest.RequiredMods.Any(required =>
                string.Equals(required, manifest.Id, StringComparison.OrdinalIgnoreCase)))
        {
            throw new ModPackageValidationException("A mod may not require itself.");
        }
    }

    private static void ValidateBoneyardOverlay(
        PackageOverlay overlay,
        string source,
        string target,
        ZipArchiveEntry sourceEntry)
    {
        var sourceIsBoneyard = source.EndsWith(".boneyard", StringComparison.OrdinalIgnoreCase);
        var targetIsBoneyard = target.EndsWith(".boneyard", StringComparison.OrdinalIgnoreCase);
        var formatIsBoneyard = string.Equals(
            overlay.Format,
            "boneyard",
            StringComparison.OrdinalIgnoreCase);
        if (!sourceIsBoneyard && !targetIsBoneyard && !formatIsBoneyard)
        {
            return;
        }

        if (!sourceIsBoneyard || !targetIsBoneyard ||
            (!string.IsNullOrWhiteSpace(overlay.Format) && !formatIsBoneyard))
        {
            throw new ModPackageValidationException(
                "Boneyard overlays must use .boneyard source and target paths and format 'boneyard' when format is present.");
        }

        var allowedBoneyardTarget =
            target.StartsWith("data/levels/", StringComparison.Ordinal) ||
            target.StartsWith("sandbox/DarkCloud/mylevels/", StringComparison.Ordinal);
        if (!allowedBoneyardTarget)
        {
            throw new ModPackageValidationException(
                $"Website Boneyard targets must be stock levels under data/levels/ or custom levels under sandbox/DarkCloud/mylevels/: {target}");
        }

        using var stream = sourceEntry.Open();
        BoneyardFileInspector.Validate(stream, source);
    }

    private static string ValidateManifestPath(string value, string label)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > MaxRelativePathLength ||
            value.StartsWith("/", StringComparison.Ordinal) ||
            value.EndsWith("/", StringComparison.Ordinal) ||
            value.Contains('\\'))
        {
            throw new ModPackageValidationException($"{label} must be a portable relative file path: {value}");
        }

        if (value.Split('/').Any(segment => !IsPortablePathSegment(segment)))
        {
            throw new ModPackageValidationException($"{label} is not a portable path: {value}");
        }

        return value;
    }

    private static void ValidateUniqueStrings(
        IEnumerable<string> values,
        string property,
        Regex format)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var value in values)
        {
            if (value is null || !format.IsMatch(value))
            {
                throw new ModPackageValidationException($"Invalid value in {property}: {value}");
            }

            if (!seen.Add(value))
            {
                throw new ModPackageValidationException($"Duplicate value in {property}: {value}");
            }
        }
    }

    private static void ValidateArchiveTree(IEnumerable<string> filePaths)
    {
        var files = new HashSet<string>(filePaths, StringComparer.OrdinalIgnoreCase);
        foreach (var path in files)
        {
            var separator = path.IndexOf('/');
            while (separator >= 0)
            {
                if (files.Contains(path[..separator]))
                {
                    throw new ModPackageValidationException(
                        $"An archive path is both a file and a directory: {path[..separator]}");
                }
                separator = path.IndexOf('/', separator + 1);
            }
        }
    }

    private static async Task<string> HashStreamAsync(
        Stream stream,
        CancellationToken cancellationToken)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = ArrayPool<byte>.Shared.Rent(81920);
        try
        {
            int count;
            while ((count = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken)) > 0)
            {
                hash.AppendData(buffer, 0, count);
            }

            return Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant();
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    private sealed class PackageManifest
    {
        [JsonPropertyName("$schema")]
        public string? Schema { get; init; }
        public string Id { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
        public string Version { get; init; } = string.Empty;
        public int Priority { get; init; }
        public List<PackageOverlay> Overlays { get; init; } = [];
        public PackageRuntime Runtime { get; init; } = new();
        public List<string> RequiredMods { get; init; } = [];
        [JsonExtensionData]
        public Dictionary<string, JsonElement>? ExtensionData { get; init; }
    }

    private sealed class PackageOverlay
    {
        public string Target { get; init; } = string.Empty;
        public string Source { get; init; } = string.Empty;
        public string Format { get; init; } = string.Empty;
        [JsonExtensionData]
        public Dictionary<string, JsonElement>? ExtensionData { get; init; }
    }

    private sealed class PackageRuntime
    {
        public string ApiVersion { get; init; } = string.Empty;
        public string EntryScript { get; init; } = string.Empty;
        public List<string> RequiredCapabilities { get; init; } = [];
        public List<string> OptionalCapabilities { get; init; } = [];
        [JsonExtensionData]
        public Dictionary<string, JsonElement>? ExtensionData { get; init; }
    }

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$", RegexOptions.CultureInvariant)]
    private static partial Regex LauncherModIdRegex();

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$", RegexOptions.CultureInvariant)]
    private static partial Regex CapabilityRegex();

    [GeneratedRegex("^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex WindowsReservedNameRegex();
}
