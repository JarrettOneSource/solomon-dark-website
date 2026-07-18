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

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Users_SteamId
            ON Users (SteamId)
            WHERE SteamId IS NOT NULL;

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
            """,
            cancellationToken);

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
