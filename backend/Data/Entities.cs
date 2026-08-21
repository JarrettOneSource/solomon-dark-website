namespace SolomonDarkRevived.Data;

public sealed class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? School { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class Mod
{
    public int Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? PackageId { get; set; }
    public int AuthorId { get; set; }
    public int Downloads { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public User Author { get; set; } = null!;
    public ICollection<ModTag> Tags { get; set; } = [];
    public ICollection<ModVersion> Versions { get; set; } = [];
    public ICollection<ModScreenshot> Screenshots { get; set; } = [];
    public ICollection<ModComment> Comments { get; set; } = [];
    public ICollection<ModSubscription> Subscriptions { get; set; } = [];
}

public sealed class ModSubscription
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int ModId { get; set; }
    public bool Enabled { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public User User { get; set; } = null!;
    public Mod Mod { get; set; } = null!;
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

public sealed class WebGameSave
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int Slot { get; set; }
    public int FormatVersion { get; set; }
    public int Revision { get; set; }
    public string Document { get; set; } = string.Empty;
    public long Size { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; }

    public User User { get; set; } = null!;
}

public sealed class BoneyardDraft
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public long DocumentSize { get; set; }
    public long? CompiledSize { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public User User { get; set; } = null!;
}

public sealed class DiagnosticLog
{
    public int Id { get; set; }
    public string PublicId { get; set; } = string.Empty;
    public string ClientLogId { get; set; } = string.Empty;
    public int? SubmitterUserId { get; set; }
    public DateTime SubmittedAtUtc { get; set; }
    public DateTime CapturedAtUtc { get; set; }
    public string ClientVersion { get; set; } = string.Empty;
    public string? LaunchToken { get; set; }
    public string MetadataJson { get; set; } = "{}";
    public string ArchivePath { get; set; } = string.Empty;
    public long ArchiveSize { get; set; }
    public string ArchiveSha256 { get; set; } = string.Empty;

    public User? SubmitterUser { get; set; }
}
