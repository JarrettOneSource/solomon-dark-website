namespace SolomonDarkRevived.Data;

public sealed class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? School { get; set; }
    public string? SteamId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class Mod
{
    public int Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? LauncherModId { get; set; }
    public int AuthorId { get; set; }
    public int Downloads { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public User Author { get; set; } = null!;
    public ICollection<ModTag> Tags { get; set; } = [];
    public ICollection<ModVersion> Versions { get; set; } = [];
    public ICollection<ModScreenshot> Screenshots { get; set; } = [];
    public ICollection<ModComment> Comments { get; set; } = [];
}

public sealed class ModDownloadEvent
{
    public int Id { get; set; }
    public int ModId { get; set; }
    public DateTime DownloadedAtUtc { get; set; }
}

public sealed class ModTag
{
    public int Id { get; set; }
    public int ModId { get; set; }
    public string Name { get; set; } = string.Empty;
}

public sealed class ModVersion
{
    public int Id { get; set; }
    public int ModId { get; set; }
    public string Version { get; set; } = string.Empty;
    public string? ManifestVersion { get; set; }
    public string? PackageSha256 { get; set; }
    public string? ContentSha256 { get; set; }
    public string Changelog { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public int Downloads { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class ModScreenshot
{
    public int Id { get; set; }
    public int ModId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public sealed class ModComment
{
    public int Id { get; set; }
    public int ModId { get; set; }
    public int AuthorId { get; set; }
    public string Body { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }

    public Mod Mod { get; set; } = null!;
    public User Author { get; set; } = null!;
}

public sealed class LobbySession
{
    public int Id { get; set; }
    public string LobbyId { get; set; } = string.Empty;
    public string HostSteamId { get; set; } = string.Empty;
    public string HostPlayer { get; set; } = string.Empty;
    public string Privacy { get; set; } = string.Empty;
    public string Secret { get; set; } = string.Empty;
    public string? PasswordSalt { get; set; }
    public string? PasswordHash { get; set; }
    public string FriendSteamIdsJson { get; set; } = "[]";
    public string ActiveModsJson { get; set; } = "[]";
    public int Players { get; set; }
    public int MaxPlayers { get; set; }
    public long AppId { get; set; }
    public int ProtocolVersion { get; set; }
    public string ManifestSha256 { get; set; } = string.Empty;
    public string LoaderVersion { get; set; } = string.Empty;
    public string Phase { get; set; } = string.Empty;
    public string? BoneyardId { get; set; }
    public string? BoneyardName { get; set; }
    public string? BoneyardSha256 { get; set; }
    public int? Wave { get; set; }
    public string? Difficulty { get; set; }
    public int? ElapsedSeconds { get; set; }
    public string? StatusText { get; set; }
    public DateTime FirstSeenUtc { get; set; }
    public DateTime LastSeenUtc { get; set; }
}

public sealed class SteamLinkAttempt
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string StateHash { get; set; } = string.Empty;
    public string ReturnPath { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }

    public User User { get; set; } = null!;
}

public sealed class CloudSave
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int Slot { get; set; }
    public string? Name { get; set; }
    public long Size { get; set; }
    public long UncompressedSize { get; set; }
    public int FileCount { get; set; }
    public int FormatVersion { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; }

    public User User { get; set; } = null!;
}

public sealed class BoneyardDraft
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? PublishedModId { get; set; }
    public string Name { get; set; } = string.Empty;
    public long DocumentSize { get; set; }
    public long? CompiledSize { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public User User { get; set; } = null!;
    public Mod? PublishedMod { get; set; }
}

public sealed class CrashReport
{
    public int Id { get; set; }
    public string PublicId { get; set; } = string.Empty;
    public string ClientReportId { get; set; } = string.Empty;
    public int? SubmitterUserId { get; set; }
    public string? SubmitterSteamId { get; set; }
    public DateTime SubmittedAtUtc { get; set; }
    public DateTime CrashedAtUtc { get; set; }
    public string LaunchToken { get; set; } = string.Empty;
    public int? ExitCode { get; set; }
    public string LauncherVersion { get; set; } = string.Empty;
    public string LoaderVersion { get; set; } = string.Empty;
    public string GameVersion { get; set; } = string.Empty;
    public string RuntimeProfile { get; set; } = string.Empty;
    public string EnabledModsJson { get; set; } = "[]";
    public string MetadataJson { get; set; } = "{}";
    public bool HasCrashLog { get; set; }
    public int MinidumpCount { get; set; }
    public string ArchivePath { get; set; } = string.Empty;
    public long ArchiveSize { get; set; }
    public string ArchiveSha256 { get; set; } = string.Empty;

    public User? SubmitterUser { get; set; }
}

public sealed class DiagnosticLog
{
    public int Id { get; set; }
    public string PublicId { get; set; } = string.Empty;
    public string ClientLogId { get; set; } = string.Empty;
    public int? SubmitterUserId { get; set; }
    public string? SubmitterSteamId { get; set; }
    public DateTime SubmittedAtUtc { get; set; }
    public DateTime CapturedAtUtc { get; set; }
    public string LauncherVersion { get; set; } = string.Empty;
    public string? LaunchToken { get; set; }
    public string MetadataJson { get; set; } = "{}";
    public string ArchivePath { get; set; } = string.Empty;
    public long ArchiveSize { get; set; }
    public string ArchiveSha256 { get; set; } = string.Empty;

    public User? SubmitterUser { get; set; }
}
