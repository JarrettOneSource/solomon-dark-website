using System.Data;
using Microsoft.EntityFrameworkCore;

namespace SolomonDarkRevived.Data;

public static class DatabaseSchema
{
    public static async Task EnsureCurrentAsync(
        AppDb db,
        CancellationToken cancellationToken = default)
    {
        await db.Database.EnsureCreatedAsync(cancellationToken);
        if (!await HasColumnAsync(db, "Users", "SteamId", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE Users ADD COLUMN SteamId TEXT NULL;",
                cancellationToken);
        }

        if (!await HasColumnAsync(db, "Mods", "LauncherModId", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE Mods ADD COLUMN LauncherModId TEXT NULL;",
                cancellationToken);
        }

        if (!await HasColumnAsync(db, "ModVersions", "ManifestVersion", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE ModVersions ADD COLUMN ManifestVersion TEXT NULL;",
                cancellationToken);
        }

        if (!await HasColumnAsync(db, "ModVersions", "PackageSha256", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE ModVersions ADD COLUMN PackageSha256 TEXT NULL;",
                cancellationToken);
        }

        if (!await HasColumnAsync(db, "ModVersions", "ContentSha256", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE ModVersions ADD COLUMN ContentSha256 TEXT NULL;",
                cancellationToken);
        }

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_SteamId
            ON Users (SteamId)
            WHERE SteamId IS NOT NULL;

            CREATE UNIQUE INDEX IF NOT EXISTS IX_Mods_LauncherModId
            ON Mods (LauncherModId COLLATE NOCASE)
            WHERE LauncherModId IS NOT NULL;

            CREATE UNIQUE INDEX IF NOT EXISTS IX_ModVersions_ModId_ManifestVersion_ContentSha256
            ON ModVersions (ModId, ManifestVersion, ContentSha256)
            WHERE ManifestVersion IS NOT NULL AND ContentSha256 IS NOT NULL;

            CREATE TABLE IF NOT EXISTS Lobbies (
                Id INTEGER NOT NULL CONSTRAINT PK_Lobbies PRIMARY KEY AUTOINCREMENT,
                LobbyId TEXT NOT NULL,
                HostSteamId TEXT NOT NULL,
                HostPlayer TEXT NOT NULL,
                Privacy TEXT NOT NULL,
                Secret TEXT NOT NULL,
                PasswordSalt TEXT NULL,
                PasswordHash TEXT NULL,
                FriendSteamIdsJson TEXT NOT NULL,
                ActiveModsJson TEXT NOT NULL,
                Players INTEGER NOT NULL,
                MaxPlayers INTEGER NOT NULL,
                AppId INTEGER NOT NULL,
                ProtocolVersion INTEGER NOT NULL,
                ManifestSha256 TEXT NOT NULL,
                LoaderVersion TEXT NOT NULL,
                Phase TEXT NOT NULL,
                BoneyardId TEXT NULL,
                BoneyardName TEXT NULL,
                BoneyardSha256 TEXT NULL,
                Wave INTEGER NULL,
                Difficulty TEXT NULL,
                ElapsedSeconds INTEGER NULL,
                StatusText TEXT NULL,
                FirstSeenUtc TEXT NOT NULL,
                LastSeenUtc TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Lobbies_LobbyId ON Lobbies (LobbyId);
            CREATE INDEX IF NOT EXISTS IX_Lobbies_LastSeenUtc ON Lobbies (LastSeenUtc);

            CREATE TABLE IF NOT EXISTS SteamLinkAttempts (
                Id INTEGER NOT NULL CONSTRAINT PK_SteamLinkAttempts PRIMARY KEY AUTOINCREMENT,
                UserId INTEGER NOT NULL,
                StateHash TEXT NOT NULL,
                ReturnPath TEXT NOT NULL,
                ExpiresAtUtc TEXT NOT NULL,
                CONSTRAINT FK_SteamLinkAttempts_Users_UserId
                    FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_SteamLinkAttempts_StateHash
                ON SteamLinkAttempts (StateHash);
            CREATE INDEX IF NOT EXISTS IX_SteamLinkAttempts_ExpiresAtUtc
                ON SteamLinkAttempts (ExpiresAtUtc);
            CREATE INDEX IF NOT EXISTS IX_SteamLinkAttempts_UserId
                ON SteamLinkAttempts (UserId);

            CREATE TABLE IF NOT EXISTS ModTags (
                Id INTEGER NOT NULL CONSTRAINT PK_ModTags PRIMARY KEY AUTOINCREMENT,
                ModId INTEGER NOT NULL,
                Name TEXT NOT NULL,
                CONSTRAINT FK_ModTags_Mods_ModId
                    FOREIGN KEY (ModId) REFERENCES Mods (Id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_ModTags_ModId_Name
                ON ModTags (ModId, Name);
            CREATE INDEX IF NOT EXISTS IX_ModTags_Name ON ModTags (Name);

            CREATE TABLE IF NOT EXISTS ModDownloadEvents (
                Id INTEGER NOT NULL CONSTRAINT PK_ModDownloadEvents PRIMARY KEY AUTOINCREMENT,
                ModId INTEGER NOT NULL,
                DownloadedAtUtc TEXT NOT NULL,
                CONSTRAINT FK_ModDownloadEvents_Mods_ModId
                    FOREIGN KEY (ModId) REFERENCES Mods (Id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS IX_ModDownloadEvents_DownloadedAtUtc
                ON ModDownloadEvents (DownloadedAtUtc);
            CREATE INDEX IF NOT EXISTS IX_ModDownloadEvents_ModId_DownloadedAtUtc
                ON ModDownloadEvents (ModId, DownloadedAtUtc);

            CREATE TABLE IF NOT EXISTS BoneyardDrafts (
                Id INTEGER NOT NULL CONSTRAINT PK_BoneyardDrafts PRIMARY KEY AUTOINCREMENT,
                UserId INTEGER NOT NULL,
                Name TEXT NOT NULL,
                DocumentSize INTEGER NOT NULL,
                CompiledSize INTEGER NULL,
                CreatedAtUtc TEXT NOT NULL,
                UpdatedAtUtc TEXT NOT NULL,
                CONSTRAINT FK_BoneyardDrafts_Users_UserId
                    FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS IX_BoneyardDrafts_UserId_UpdatedAtUtc
                ON BoneyardDrafts (UserId, UpdatedAtUtc);
            """,
            cancellationToken);

        if (!await HasColumnAsync(db, "Lobbies", "ActiveModsJson", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE Lobbies ADD COLUMN ActiveModsJson TEXT NOT NULL DEFAULT '[]';",
                cancellationToken);
        }

        if (await HasColumnAsync(db, "Mods", "Type", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(
                """
                INSERT OR IGNORE INTO ModTags (ModId, Name)
                SELECT Id, lower(trim(Type))
                FROM Mods
                WHERE length(trim(Type)) BETWEEN 2 AND 24;

                ALTER TABLE Mods DROP COLUMN Type;
                """,
                cancellationToken);
        }
    }

    private static async Task<bool> HasColumnAsync(
        AppDb db,
        string table,
        string column,
        CancellationToken cancellationToken)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"PRAGMA table_info({table});";
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }
}
