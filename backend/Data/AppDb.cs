using Microsoft.EntityFrameworkCore;

namespace SolomonDarkRevived.Data;

public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Mod> Mods => Set<Mod>();
    public DbSet<ModDownloadEvent> ModDownloadEvents => Set<ModDownloadEvent>();
    public DbSet<ModTag> ModTags => Set<ModTag>();
    public DbSet<ModVersion> ModVersions => Set<ModVersion>();
    public DbSet<ModScreenshot> ModScreenshots => Set<ModScreenshot>();
    public DbSet<ModComment> ModComments => Set<ModComment>();
    public DbSet<LobbySession> Lobbies => Set<LobbySession>();
    public DbSet<SteamLinkAttempt> SteamLinkAttempts => Set<SteamLinkAttempt>();
    public DbSet<CloudSave> CloudSaves => Set<CloudSave>();
    public DbSet<BoneyardDraft> BoneyardDrafts => Set<BoneyardDraft>();
    public DbSet<CrashReport> CrashReports => Set<CrashReport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(user => user.Username).UseCollation("NOCASE");
            entity.Property(user => user.Email).UseCollation("NOCASE");
            entity.HasIndex(user => user.Username).IsUnique();
            entity.HasIndex(user => user.Email).IsUnique();
            entity.Property(user => user.SteamId).HasMaxLength(20);
            entity.HasIndex(user => user.SteamId).IsUnique();
        });

        modelBuilder.Entity<Mod>(entity =>
        {
            entity.HasIndex(mod => mod.Slug).IsUnique();
            entity.Property(mod => mod.LauncherModId).HasMaxLength(128).UseCollation("NOCASE");
            entity.HasIndex(mod => mod.LauncherModId).IsUnique();
            entity.HasOne(mod => mod.Author)
                .WithMany()
                .HasForeignKey(mod => mod.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasMany(mod => mod.Tags)
                .WithOne()
                .HasForeignKey(tag => tag.ModId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(mod => mod.Versions)
                .WithOne()
                .HasForeignKey(version => version.ModId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(mod => mod.Screenshots)
                .WithOne()
                .HasForeignKey(screenshot => screenshot.ModId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasMany(mod => mod.Comments)
                .WithOne(comment => comment.Mod)
                .HasForeignKey(comment => comment.ModId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ModVersion>(entity =>
        {
            entity.Property(version => version.ManifestVersion).HasMaxLength(64);
            entity.Property(version => version.PackageSha256).HasMaxLength(64);
            entity.Property(version => version.ContentSha256).HasMaxLength(64);
            entity.HasIndex(version => new
            {
                version.ModId,
                version.ManifestVersion,
                version.ContentSha256
            }).IsUnique();
        });

        modelBuilder.Entity<ModDownloadEvent>(entity =>
        {
            entity.HasIndex(e => e.DownloadedAtUtc);
            entity.HasIndex(e => new { e.ModId, e.DownloadedAtUtc });
            entity.HasOne<Mod>()
                .WithMany()
                .HasForeignKey(e => e.ModId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ModTag>(entity =>
        {
            entity.Property(tag => tag.Name).HasMaxLength(24);
            entity.HasIndex(tag => new { tag.ModId, tag.Name }).IsUnique();
            entity.HasIndex(tag => tag.Name);
        });

        modelBuilder.Entity<ModComment>(entity =>
        {
            entity.Property(comment => comment.Body).HasMaxLength(1000);
            entity.HasIndex(comment => new { comment.ModId, comment.CreatedAtUtc });
            entity.HasOne(comment => comment.Author)
                .WithMany()
                .HasForeignKey(comment => comment.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LobbySession>(entity =>
        {
            entity.ToTable("Lobbies");
            entity.Property(lobby => lobby.LobbyId).HasMaxLength(20);
            entity.Property(lobby => lobby.HostSteamId).HasMaxLength(20);
            entity.Property(lobby => lobby.HostPlayer).HasMaxLength(64);
            entity.Property(lobby => lobby.Privacy).HasMaxLength(24);
            entity.Property(lobby => lobby.Secret).HasMaxLength(64);
            entity.Property(lobby => lobby.PasswordSalt).HasMaxLength(32);
            entity.Property(lobby => lobby.PasswordHash).HasMaxLength(64);
            entity.Property(lobby => lobby.ManifestSha256).HasMaxLength(64);
            entity.Property(lobby => lobby.LoaderVersion).HasMaxLength(64);
            entity.Property(lobby => lobby.Phase).HasMaxLength(12);
            entity.Property(lobby => lobby.BoneyardId).HasMaxLength(64);
            entity.Property(lobby => lobby.BoneyardName).HasMaxLength(80);
            entity.Property(lobby => lobby.BoneyardSha256).HasMaxLength(64);
            entity.Property(lobby => lobby.Difficulty).HasMaxLength(32);
            entity.Property(lobby => lobby.StatusText).HasMaxLength(120);
            entity.HasIndex(lobby => lobby.LobbyId).IsUnique();
            entity.HasIndex(lobby => lobby.LastSeenUtc);
        });

        modelBuilder.Entity<SteamLinkAttempt>(entity =>
        {
            entity.Property(attempt => attempt.StateHash).HasMaxLength(64);
            entity.Property(attempt => attempt.ReturnPath).HasMaxLength(256);
            entity.HasIndex(attempt => attempt.StateHash).IsUnique();
            entity.HasIndex(attempt => attempt.ExpiresAtUtc);
            entity.HasOne(attempt => attempt.User)
                .WithMany()
                .HasForeignKey(attempt => attempt.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CloudSave>(entity =>
        {
            entity.Property(save => save.Name).HasMaxLength(40);
            entity.Property(save => save.Sha256).HasMaxLength(64);
            entity.HasIndex(save => new { save.UserId, save.Slot }).IsUnique();
            entity.HasOne(save => save.User)
                .WithMany()
                .HasForeignKey(save => save.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BoneyardDraft>(entity =>
        {
            entity.Property(draft => draft.Name).HasMaxLength(80);
            entity.HasIndex(draft => new { draft.UserId, draft.UpdatedAtUtc });
            entity.HasOne(draft => draft.User)
                .WithMany()
                .HasForeignKey(draft => draft.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CrashReport>(entity =>
        {
            entity.Property(report => report.PublicId).HasMaxLength(36);
            entity.Property(report => report.ClientReportId).HasMaxLength(36);
            entity.Property(report => report.SubmitterSteamId).HasMaxLength(20);
            entity.Property(report => report.LaunchToken).HasMaxLength(32);
            entity.Property(report => report.LauncherVersion).HasMaxLength(64);
            entity.Property(report => report.LoaderVersion).HasMaxLength(64);
            entity.Property(report => report.GameVersion).HasMaxLength(32);
            entity.Property(report => report.RuntimeProfile).HasMaxLength(64);
            entity.Property(report => report.ArchiveSha256).HasMaxLength(64);
            entity.HasIndex(report => report.PublicId).IsUnique();
            entity.HasIndex(report => report.ClientReportId).IsUnique();
            entity.HasIndex(report => report.SubmittedAtUtc);
            entity.HasIndex(report => report.SubmitterSteamId);
            entity.HasOne(report => report.SubmitterUser)
                .WithMany()
                .HasForeignKey(report => report.SubmitterUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
