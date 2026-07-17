using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace SolomonDarkRevived.Services;

public sealed partial class StorageService
{
    public StorageService(string rootPath)
    {
        RootPath = Path.GetFullPath(rootPath);
        ModsPath = Path.Combine(RootPath, "uploads", "mods");
        ScreenshotsPath = Path.Combine(RootPath, "uploads", "screenshots");
        SavesPath = Path.Combine(RootPath, "saves");

        Directory.CreateDirectory(RootPath);
        Directory.CreateDirectory(ModsPath);
        Directory.CreateDirectory(ScreenshotsPath);
        Directory.CreateDirectory(SavesPath);
    }

    public string RootPath { get; }
    public string DatabasePath => Path.Combine(RootPath, "sdr.db");
    public string ModsPath { get; }
    public string ScreenshotsPath { get; }
    public string SavesPath { get; }

    public static bool IsSafeVersion(string version) =>
        version.Length <= 64 && SafeVersionRegex().IsMatch(version);

    public async Task<string> SaveModFileAsync(
        string slug,
        string version,
        Stream source,
        CancellationToken cancellationToken = default)
    {
        var fileName = ModFileName(slug, version);
        var path = ResolvePath(ModsPath, fileName);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await SaveStreamAsync(path, source, cancellationToken);
        return fileName;
    }

    public async Task<string> SaveScreenshotAsync(
        int modId,
        int number,
        string extension,
        Stream source,
        CancellationToken cancellationToken = default)
    {
        var fileName = $"{modId}-{number}.{extension}";
        var path = ResolvePath(ScreenshotsPath, fileName);
        await SaveStreamAsync(path, source, cancellationToken);
        return fileName;
    }

    public async Task<string> SaveCloudSaveAsync(
        int userId,
        int slot,
        ReadOnlyMemory<byte> bytes,
        CancellationToken cancellationToken = default)
    {
        var path = GetCloudSavePath(userId, slot);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        var temporaryPath = path + ".tmp";
        await File.WriteAllBytesAsync(temporaryPath, bytes.ToArray(), cancellationToken);
        File.Move(temporaryPath, path, true);
        return Sha256(bytes.Span);
    }

    public string GetModFilePath(string fileName) => ResolvePath(ModsPath, fileName);

    public string GetCloudSavePath(int userId, int slot) =>
        ResolvePath(SavesPath, $"{userId}/{slot}.bin");

    public void DeleteModDirectory(string slug)
    {
        var directory = ResolvePath(ModsPath, slug);
        if (Directory.Exists(directory))
        {
            Directory.Delete(directory, true);
        }
    }

    public void DeleteModFile(string fileName)
    {
        var path = ResolvePath(ModsPath, fileName);
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }

    public void DeleteScreenshot(string fileName)
    {
        var path = ResolvePath(ScreenshotsPath, fileName);
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }

    public void DeleteCloudSave(int userId, int slot)
    {
        var path = GetCloudSavePath(userId, slot);
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }

    public static string Sha256(ReadOnlySpan<byte> bytes) =>
        Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

    private static string ModFileName(string slug, string version)
    {
        if (!SafeSlugRegex().IsMatch(slug) || !IsSafeVersion(version))
        {
            throw new ArgumentException("Unsafe mod storage path.");
        }

        return $"{slug}/{version}.zip";
    }

    private static async Task SaveStreamAsync(
        string path,
        Stream source,
        CancellationToken cancellationToken)
    {
        await using var destination = new FileStream(
            path,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            81920,
            FileOptions.Asynchronous);
        await source.CopyToAsync(destination, cancellationToken);
    }

    private static string ResolvePath(string root, string relativePath)
    {
        var fullRoot = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        var fullPath = Path.GetFullPath(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        if (!fullPath.StartsWith(fullRoot, StringComparison.Ordinal))
        {
            throw new ArgumentException("Storage path escaped its root.");
        }

        return fullPath;
    }

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex SafeSlugRegex();

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._+-]*$")]
    private static partial Regex SafeVersionRegex();
}
