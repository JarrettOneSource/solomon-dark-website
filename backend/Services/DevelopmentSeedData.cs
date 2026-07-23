using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;

namespace SolomonDarkRevived.Services;

public static class DevelopmentSeedData
{
    private const string SurvivalName = "The Survival Grounds, As Shipped";
    private const string SurvivalSlug = "the-survival-grounds-as-shipped";
    private const string SurvivalSummary =
        "The stock survival boneyard, byte for byte from the 0.72.5 beta. The yard re-rolls itself every time you visit; the file is the recipe, not the furniture.";
    private const string SurvivalSha256 =
        "fe2e01b0ab62f644c3e5bf53f71df3a41968b95c8e22fa44c1d1250ba08cdb5b";
    private const string SurvivalDescription =
        "Extracted from the preserved 0.72.5 beta data.\n\n" +
        "SHA-256: " + SurvivalSha256 + ".\n\n" +
        "The retail BoneyardGenerator decorates this recipe shell at load with a fresh random seed.\n\n" +
        "Staged install path: sandbox/DarkCloud/mylevels/The Survival Grounds, As Shipped.boneyard.\n\n" +
        "Original level (c) Raptisoft.";

    public static async Task InitializeAsync(
        AppDb db,
        IPasswordHasher<User> passwordHasher,
        StorageService storage,
        ModPublishingService publisher,
        string survivalBoneyardPath,
        CancellationToken cancellationToken = default)
    {
        var luthacus = await EnsureUserAsync(
            db,
            passwordHasher,
            "Luthacus",
            "luthacus@college.example",
            "fire",
            cancellationToken);
        var hagatha = await EnsureUserAsync(
            db,
            passwordHasher,
            "Hagatha",
            "hagatha@college.example",
            "water",
            cancellationToken);

        var survival = await File.ReadAllBytesAsync(survivalBoneyardPath, cancellationToken);
        if (!string.Equals(StorageService.Sha256(survival), SurvivalSha256, StringComparison.Ordinal))
        {
            throw new InvalidDataException("The development survival Boneyard does not match its recorded SHA-256.");
        }

        await EnsureDraftAsync(
            db,
            storage,
            luthacus,
            "Survival Recipe Notes",
            JsonSerializer.SerializeToUtf8Bytes(new
            {
                schemaVersion = 1,
                title = "Survival Recipe Notes",
                source = "data/levels/survival.boneyard",
                notes = new[]
                {
                    "Six monster recipes.",
                    "One timeline.",
                    "The generator supplies the furniture."
                }
            }),
            survival,
            cancellationToken);
        await EnsureDraftAsync(
            db,
            storage,
            hagatha,
            "Dratmoor Margin Study",
            JsonSerializer.SerializeToUtf8Bytes(new
            {
                schemaVersion = 1,
                title = "Dratmoor Margin Study",
                source = "new",
                notes = new[]
                {
                    "Roads require fewer apologies than fences.",
                    "Keep the first wave clear of the entrance."
                }
            }),
            null,
            cancellationToken);

        if (!await db.Mods.AnyAsync(
                mod => mod.Slug == SurvivalSlug || mod.LauncherModId == SurvivalSlug,
                cancellationToken))
        {
            var draft = await db.BoneyardDrafts.SingleAsync(
                candidate => candidate.UserId == luthacus.Id &&
                             candidate.Name == "Survival Recipe Notes",
                cancellationToken);
            await publisher.PublishBoneyardAsync(
                draft,
                luthacus.Id,
                SurvivalName,
                SurvivalSlug,
                SurvivalSummary,
                SurvivalDescription,
                "1.0.0",
                "Published from the Boneyard editor.",
                survival,
                cancellationToken);
        }
    }

    private static async Task<User> EnsureUserAsync(
        AppDb db,
        IPasswordHasher<User> passwordHasher,
        string username,
        string email,
        string school,
        CancellationToken cancellationToken)
    {
        var existing = await db.Users.SingleOrDefaultAsync(
            user => user.Username == username,
            cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var user = new User
        {
            Username = username,
            Email = email,
            School = school,
            CreatedAtUtc = DateTime.UtcNow
        };
        user.PasswordHash = passwordHasher.HashPassword(user, "password123");
        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        return user;
    }

    private static async Task EnsureDraftAsync(
        AppDb db,
        StorageService storage,
        User user,
        string name,
        byte[] document,
        byte[]? compiled,
        CancellationToken cancellationToken)
    {
        if (await db.BoneyardDrafts.AnyAsync(
                draft => draft.UserId == user.Id && draft.Name == name,
                cancellationToken))
        {
            return;
        }

        var now = DateTime.UtcNow;
        var draft = new BoneyardDraft
        {
            UserId = user.Id,
            Name = name,
            DocumentSize = document.LongLength,
            CompiledSize = compiled?.LongLength,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };
        db.BoneyardDrafts.Add(draft);
        await db.SaveChangesAsync(cancellationToken);

        try
        {
            await storage.SaveBoneyardDraftDocumentAsync(
                draft.UserId,
                draft.Id,
                document,
                cancellationToken);
            if (compiled is not null)
            {
                await storage.SaveBoneyardDraftCompiledAsync(
                    draft.UserId,
                    draft.Id,
                    compiled,
                    cancellationToken);
            }
        }
        catch
        {
            db.BoneyardDrafts.Remove(draft);
            await db.SaveChangesAsync(cancellationToken);
            storage.DeleteBoneyardDraft(draft.UserId, draft.Id);
            throw;
        }
    }
}
