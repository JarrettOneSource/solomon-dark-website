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

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS WebGameSaves (
                Id INTEGER NOT NULL CONSTRAINT PK_WebGameSaves PRIMARY KEY AUTOINCREMENT,
                UserId INTEGER NOT NULL,
                Slot INTEGER NOT NULL,
                FormatVersion INTEGER NOT NULL,
                Revision INTEGER NOT NULL,
                Document TEXT NOT NULL,
                Size INTEGER NOT NULL,
                Sha256 TEXT NOT NULL,
                UpdatedAtUtc TEXT NOT NULL,
                CONSTRAINT FK_WebGameSaves_Users_UserId
                    FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_WebGameSaves_UserId_Slot
                ON WebGameSaves (UserId, Slot);
            CREATE INDEX IF NOT EXISTS IX_WebGameSaves_UserId
                ON WebGameSaves (UserId);
            """,
            cancellationToken);


        if (!await HasColumnAsync(db, "DiagnosticLogs", "ClientVersion", cancellationToken) &&
            await HasColumnAsync(db, "DiagnosticLogs", "LauncherVersion", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE DiagnosticLogs RENAME COLUMN LauncherVersion TO ClientVersion;",
                cancellationToken);
        }

        if (!await HasColumnAsync(db, "Mods", "PackageId", cancellationToken))
        {
            if (await HasColumnAsync(db, "Mods", "LauncherModId", cancellationToken))
            {
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE Mods RENAME COLUMN LauncherModId TO PackageId;",
                    cancellationToken);
            }
            else
            {
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE Mods ADD COLUMN PackageId TEXT NULL;",
                    cancellationToken);
            }
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

        if (await HasColumnAsync(db, "ModVersions", "MinimumLoaderVersion", cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE ModVersions DROP COLUMN MinimumLoaderVersion;",
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
            DROP INDEX IF EXISTS IX_Mods_LauncherModId;
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Mods_PackageId
            ON Mods (PackageId COLLATE NOCASE)
            WHERE PackageId IS NOT NULL;

            CREATE UNIQUE INDEX IF NOT EXISTS IX_ModVersions_ModId_ManifestVersion_ContentSha256
            ON ModVersions (ModId, ManifestVersion, ContentSha256)
            WHERE ManifestVersion IS NOT NULL AND ContentSha256 IS NOT NULL;

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

            CREATE TABLE IF NOT EXISTS ModSubscriptions (
                Id INTEGER NOT NULL CONSTRAINT PK_ModSubscriptions PRIMARY KEY AUTOINCREMENT,
                UserId INTEGER NOT NULL,
                ModId INTEGER NOT NULL,
                Enabled INTEGER NOT NULL,
                CreatedAtUtc TEXT NOT NULL,
                UpdatedAtUtc TEXT NOT NULL,
                CONSTRAINT FK_ModSubscriptions_Users_UserId
                    FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE,
                CONSTRAINT FK_ModSubscriptions_Mods_ModId
                    FOREIGN KEY (ModId) REFERENCES Mods (Id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_ModSubscriptions_UserId_ModId
                ON ModSubscriptions (UserId, ModId);
            CREATE INDEX IF NOT EXISTS IX_ModSubscriptions_UserId_Enabled
                ON ModSubscriptions (UserId, Enabled);
            CREATE INDEX IF NOT EXISTS IX_ModSubscriptions_ModId
                ON ModSubscriptions (ModId);

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

            CREATE TABLE IF NOT EXISTS DiagnosticLogs (
                Id INTEGER NOT NULL CONSTRAINT PK_DiagnosticLogs PRIMARY KEY AUTOINCREMENT,
                PublicId TEXT NOT NULL,
                ClientLogId TEXT NOT NULL,
                SubmitterUserId INTEGER NULL,
                SubmittedAtUtc TEXT NOT NULL,
                CapturedAtUtc TEXT NOT NULL,
                ClientVersion TEXT NOT NULL,
                LaunchToken TEXT NULL,
                MetadataJson TEXT NOT NULL,
                ArchivePath TEXT NOT NULL,
                ArchiveSize INTEGER NOT NULL,
                ArchiveSha256 TEXT NOT NULL,
                CONSTRAINT FK_DiagnosticLogs_Users_SubmitterUserId
                    FOREIGN KEY (SubmitterUserId) REFERENCES Users (Id) ON DELETE SET NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_DiagnosticLogs_PublicId
                ON DiagnosticLogs (PublicId);
            CREATE UNIQUE INDEX IF NOT EXISTS IX_DiagnosticLogs_ClientLogId
                ON DiagnosticLogs (ClientLogId);
            CREATE INDEX IF NOT EXISTS IX_DiagnosticLogs_SubmittedAtUtc
                ON DiagnosticLogs (SubmittedAtUtc);
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
