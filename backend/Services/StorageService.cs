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
        BoneyardDraftsPath = Path.Combine(RootPath, "drafts", "boneyards");
        DiagnosticLogsPath = Path.Combine(RootPath, "diagnostic-logs");
        GameContentPath = Path.Combine(RootPath, "game-content");

        Directory.CreateDirectory(RootPath);
        Directory.CreateDirectory(ModsPath);
        Directory.CreateDirectory(ScreenshotsPath);
        Directory.CreateDirectory(BoneyardDraftsPath);
        Directory.CreateDirectory(DiagnosticLogsPath);
        Directory.CreateDirectory(GameContentPath);
    }

    public string RootPath { get; }
    public string DatabasePath => Path.Combine(RootPath, "sdr.db");
    public string ModsPath { get; }
    public string ScreenshotsPath { get; }
    public string BoneyardDraftsPath { get; }
    public string DiagnosticLogsPath { get; }
    public string GameContentPath { get; }

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

    public Task<StoredDiagnosticLogFile> SaveDiagnosticLogAsync(
        DateTime submittedAtUtc,
        string publicId,
        Stream source,
        CancellationToken cancellationToken = default) =>
        SaveArchiveAsync(
            DiagnosticLogsPath,
            "Diagnostic log",
            submittedAtUtc,
            publicId,
            source,
            cancellationToken);

    private static async Task<StoredDiagnosticLogFile> SaveArchiveAsync(
        string rootPath,
        string archiveKind,
        DateTime submittedAtUtc,
        string publicId,
        Stream source,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParseExact(publicId, "D", out _))
        {
            throw new ArgumentException($"{archiveKind} ids must be canonical UUIDs.", nameof(publicId));
        }

        var relativePath = $"{submittedAtUtc:yyyy/MM}/{publicId}.zip";
        var path = ResolvePath(rootPath, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporaryPath = path + ".tmp";
        try
        {
            await using (var destination = new FileStream(
                             temporaryPath,
                             FileMode.Create,
                             FileAccess.Write,
                             FileShare.None,
                             81920,
                             FileOptions.Asynchronous))
            {
                await source.CopyToAsync(destination, cancellationToken);
            }

            var size = new FileInfo(temporaryPath).Length;
            string sha256;
            await using (var stored = File.OpenRead(temporaryPath))
            {
                sha256 = Convert.ToHexString(await SHA256.HashDataAsync(stored, cancellationToken))
                    .ToLowerInvariant();
            }
            File.Move(temporaryPath, path, overwrite: false);
            return new StoredDiagnosticLogFile(relativePath, size, sha256);
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
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

    public string GetBoneyardDraftDocumentPath(int userId, int draftId) =>
        ResolveBoneyardDraftPath(userId, draftId, "document.json");

    public string GetBoneyardDraftCompiledPath(int userId, int draftId) =>
        ResolveBoneyardDraftPath(userId, draftId, "compiled.boneyard");

    public string GetDiagnosticLogPath(string relativePath) =>
        ResolvePath(DiagnosticLogsPath, relativePath);

    public async Task<StoredGameContent> SaveGameContentAsync(
        ReadOnlyMemory<byte> bytes,
        CancellationToken cancellationToken = default)
    {
        if (bytes.IsEmpty)
        {
            throw new ArgumentException("Game content cannot be empty.", nameof(bytes));
        }
        var sha256 = Sha256(bytes.Span);
        var path = GetGameContentPath(sha256);
        if (!File.Exists(path))
        {
            await SaveBytesAtomicallyAsync(path, bytes, cancellationToken);
        }
        return new StoredGameContent(sha256, bytes.Length);
    }

    public string GetGameContentPath(string sha256)
    {
        if (!SafeSha256Regex().IsMatch(sha256))
        {
            throw new ArgumentException("Game content identity must be lowercase SHA-256.", nameof(sha256));
        }
        return ResolvePath(GameContentPath, $"{sha256[..2]}/{sha256}");
    }

    public void DeleteDiagnosticLog(string relativePath)
    {
        var path = ResolvePath(DiagnosticLogsPath, relativePath);
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }

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

    [GeneratedRegex("^[a-f0-9]{64}$")]
    private static partial Regex SafeSha256Regex();
}

public sealed record StoredDiagnosticLogFile(
    string RelativePath,
    long Size,
    string Sha256);

public sealed record StoredGameContent(string Sha256, int ByteLength);
