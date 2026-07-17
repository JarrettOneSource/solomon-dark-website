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
    public string Type { get; set; } = string.Empty;
    public int AuthorId { get; set; }
    public int Downloads { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public User Author { get; set; } = null!;
    public ICollection<ModVersion> Versions { get; set; } = [];
    public ICollection<ModScreenshot> Screenshots { get; set; } = [];
    public ICollection<ModComment> Comments { get; set; } = [];
}

public sealed class ModVersion
{
    public int Id { get; set; }
    public int ModId { get; set; }
    public string Version { get; set; } = string.Empty;
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

public sealed class MatchSession
{
    public int Id { get; set; }
    public string SessionKey { get; set; } = string.Empty;
    public string HostPlayer { get; set; } = string.Empty;
    public string Boneyard { get; set; } = string.Empty;
    public int Players { get; set; }
    public int MaxPlayers { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime FirstSeenUtc { get; set; }
    public DateTime LastSeenUtc { get; set; }
}

public sealed class CloudSave
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int Slot { get; set; }
    public string? Name { get; set; }
    public long Size { get; set; }
    public string Sha256 { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; }

    public User User { get; set; } = null!;
}
