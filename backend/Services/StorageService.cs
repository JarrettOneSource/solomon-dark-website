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
        BoneyardDraftsPath = Path.Combine(RootPath, "drafts", "boneyards");

        Directory.CreateDirectory(RootPath);
        Directory.CreateDirectory(ModsPath);
        Directory.CreateDirectory(ScreenshotsPath);
        Directory.CreateDirectory(SavesPath);
        Directory.CreateDirectory(BoneyardDraftsPath);
    }

    public string RootPath { get; }
    public string DatabasePath => Path.Combine(RootPath, "sdr.db");
    public string ModsPath { get; }
    public string ScreenshotsPath { get; }
    public string SavesPath { get; }
    public string BoneyardDraftsPath { get; }

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
        string token,
        string extension,
        Stream source,
        CancellationToken cancellationToken = default)
    {
        if (!SafeScreenshotTokenRegex().IsMatch(token))
        {
            throw new ArgumentException("Unsafe screenshot storage path.");
        }

        var fileName = $"{modId}-{token}.{extension}";
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

    public Task SaveBoneyardDraftDocumentAsync(
        int userId,
        int draftId,
        ReadOnlyMemory<byte> bytes,
        CancellationToken cancellationToken = default) =>
        SaveBytesAtomicallyAsync(
            GetBoneyardDraftDocumentPath(userId, draftId),
            bytes,
            cancellationToken);

    public Task SaveBoneyardDraftCompiledAsync(
        int userId,
        int draftId,
        ReadOnlyMemory<byte> bytes,
        CancellationToken cancellationToken = default) =>
        SaveBytesAtomicallyAsync(
            GetBoneyardDraftCompiledPath(userId, draftId),
            bytes,
            cancellationToken);

    public async Task<byte[]?> ReadBoneyardDraftDocumentAsync(
        int userId,
        int draftId,
        CancellationToken cancellationToken = default)
    {
        var path = GetBoneyardDraftDocumentPath(userId, draftId);
        return File.Exists(path)
            ? await File.ReadAllBytesAsync(path, cancellationToken)
            : null;
    }

    public async Task<byte[]?> ReadBoneyardDraftCompiledAsync(
        int userId,
        int draftId,
        CancellationToken cancellationToken = default)
    {
        var path = GetBoneyardDraftCompiledPath(userId, draftId);
        return File.Exists(path)
            ? await File.ReadAllBytesAsync(path, cancellationToken)
            : null;
    }

    public string GetModFilePath(string fileName) => ResolvePath(ModsPath, fileName);

    public string GetCloudSavePath(int userId, int slot) =>
        ResolvePath(SavesPath, $"{userId}/{slot}.bin");

    public string GetBoneyardDraftDocumentPath(int userId, int draftId) =>
        ResolveBoneyardDraftPath(userId, draftId, "document.json");

    public string GetBoneyardDraftCompiledPath(int userId, int draftId) =>
        ResolveBoneyardDraftPath(userId, draftId, "compiled.boneyard");

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

    public void DeleteBoneyardDraftCompiled(int userId, int draftId)
    {
        var path = GetBoneyardDraftCompiledPath(userId, draftId);
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }

    public void DeleteBoneyardDraft(int userId, int draftId)
    {
        var directory = ResolveBoneyardDraftPath(userId, draftId, null);
        if (Directory.Exists(directory))
        {
            Directory.Delete(directory, true);
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

    private static async Task SaveBytesAtomicallyAsync(
        string path,
        ReadOnlyMemory<byte> bytes,
        CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporaryPath = $"{path}.{Guid.NewGuid():N}.tmp";
        try
        {
            await File.WriteAllBytesAsync(temporaryPath, bytes.ToArray(), cancellationToken);
            File.Move(temporaryPath, path, true);
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }

    private string ResolveBoneyardDraftPath(int userId, int draftId, string? fileName)
    {
        if (userId <= 0 || draftId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(draftId), "Draft storage ids must be positive.");
        }

        var relativePath = fileName is null
            ? $"{userId}/{draftId}"
            : $"{userId}/{draftId}/{fileName}";
        return ResolvePath(BoneyardDraftsPath, relativePath);
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

    [GeneratedRegex("^[a-z0-9-]{1,32}$")]
    private static partial Regex SafeScreenshotTokenRegex();
}
