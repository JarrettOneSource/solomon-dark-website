using Microsoft.EntityFrameworkCore;

namespace SolomonDarkRevived.Data;

public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Mod> Mods => Set<Mod>();
    public DbSet<ModVersion> ModVersions => Set<ModVersion>();
    public DbSet<ModScreenshot> ModScreenshots => Set<ModScreenshot>();
    public DbSet<ModComment> ModComments => Set<ModComment>();
    public DbSet<MatchSession> Matches => Set<MatchSession>();
    public DbSet<CloudSave> CloudSaves => Set<CloudSave>();

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
            entity.HasOne(mod => mod.Author)
                .WithMany()
                .HasForeignKey(mod => mod.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);
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

        modelBuilder.Entity<ModComment>(entity =>
        {
            entity.Property(comment => comment.Body).HasMaxLength(1000);
            entity.HasIndex(comment => new { comment.ModId, comment.CreatedAtUtc });
            entity.HasOne(comment => comment.Author)
                .WithMany()
                .HasForeignKey(comment => comment.AuthorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MatchSession>(entity =>
        {
            entity.ToTable("Matches");
            entity.Property(match => match.SessionKey).HasMaxLength(64);
            entity.Property(match => match.HostPlayer).HasMaxLength(32);
            entity.Property(match => match.Boneyard).HasMaxLength(60);
            entity.Property(match => match.Status).HasMaxLength(7);
            entity.HasIndex(match => match.SessionKey).IsUnique();
        });

        modelBuilder.Entity<CloudSave>(entity =>
        {
            entity.HasIndex(save => new { save.UserId, save.Slot }).IsUnique();
            entity.HasOne(save => save.User)
                .WithMany()
                .HasForeignKey(save => save.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
