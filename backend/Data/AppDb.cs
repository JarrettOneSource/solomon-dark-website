using Microsoft.EntityFrameworkCore;

namespace SolomonDarkRevived.Data;

public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Mod> Mods => Set<Mod>();
    public DbSet<ModSubscription> ModSubscriptions => Set<ModSubscription>();
    public DbSet<ModDownloadEvent> ModDownloadEvents => Set<ModDownloadEvent>();
    public DbSet<ModTag> ModTags => Set<ModTag>();
    public DbSet<ModVersion> ModVersions => Set<ModVersion>();
    public DbSet<ModScreenshot> ModScreenshots => Set<ModScreenshot>();
    public DbSet<ModComment> ModComments => Set<ModComment>();
    public DbSet<WebGameSave> WebGameSaves => Set<WebGameSave>();
    public DbSet<GameLeaderboardEntry> GameLeaderboardEntries => Set<GameLeaderboardEntry>();
    public DbSet<BoneyardDraft> BoneyardDrafts => Set<BoneyardDraft>();
    public DbSet<DiagnosticLog> DiagnosticLogs => Set<DiagnosticLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(user => user.Username).UseCollation("NOCASE");
            entity.Property(user => user.Email).UseCollation("NOCASE");
            entity.HasIndex(user => user.Username).IsUnique();
            entity.HasIndex(user => user.Email).IsUnique();
        });

        modelBuilder.Entity<Mod>(entity =>
        {
            entity.HasIndex(mod => mod.Slug).IsUnique();
            entity.Property(mod => mod.PackageId).HasMaxLength(128).UseCollation("NOCASE");
            entity.HasIndex(mod => mod.PackageId).IsUnique();
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
            entity.HasMany(mod => mod.Subscriptions)
                .WithOne(subscription => subscription.Mod)
                .HasForeignKey(subscription => subscription.ModId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ModSubscription>(entity =>
        {
            entity.HasIndex(subscription => new { subscription.UserId, subscription.ModId })
                .IsUnique();
            entity.HasIndex(subscription => new { subscription.UserId, subscription.Enabled });
            entity.HasOne(subscription => subscription.User)
                .WithMany()
                .HasForeignKey(subscription => subscription.UserId)
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




        modelBuilder.Entity<WebGameSave>(entity =>
        {
            entity.Property(save => save.Revision).IsConcurrencyToken();
            entity.Property(save => save.Sha256).HasMaxLength(64);
            entity.HasIndex(save => new { save.UserId, save.Slot }).IsUnique();
            entity.HasOne(save => save.User)
                .WithMany()
                .HasForeignKey(save => save.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GameLeaderboardEntry>(entity =>
        {
            entity.Property(entry => entry.RunId).HasMaxLength(64);
            entity.Property(entry => entry.WizardName).HasMaxLength(32);
            entity.Property(entry => entry.Element).HasMaxLength(8);
            entity.Property(entry => entry.Discipline).HasMaxLength(8);
            entity.Property(entry => entry.AwesomestKill).HasMaxLength(64);
            entity.HasIndex(entry => new { entry.UserId, entry.RunId }).IsUnique();
            entity.HasIndex(entry => new { entry.Awesomeness, entry.Id });
            entity.HasIndex(entry => new { entry.Wave, entry.Id });
            entity.HasIndex(entry => new { entry.MonstersKilled, entry.Id });
            entity.HasIndex(entry => new { entry.ElapsedTicks, entry.Id });
            entity.HasOne(entry => entry.User)
                .WithMany()
                .HasForeignKey(entry => entry.UserId)
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
    }
}
