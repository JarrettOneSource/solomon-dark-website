using System.IO.Compression;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Data;

public static class SeedData
{
    public static async Task InitializeAsync(
        AppDb db,
        IPasswordHasher<User> passwordHasher,
        StorageService storage,
        string seedAssetsPath,
        bool devLogins,
        CancellationToken cancellationToken = default)
    {
        // Real registrations may predate seeding; the seed wizards themselves mark a seeded DB.
        if (await db.Users.AnyAsync(u => u.Username == "Luthacus", cancellationToken))
        {
            return;
        }

        // Outside development the seed accounts are display-only: nobody should
        // be able to log in as them on a public host.
        var seedPassword = devLogins
            ? "password123"
            : Convert.ToHexString(RandomNumberGenerator.GetBytes(24));

        // The scavenger and the witch — canon NPCs who are still alive to post.
        var now = DateTime.UtcNow;
        var luthacus = new User
        {
            Username = "Luthacus",
            Email = "luthacus@college.example",
            School = "fire",
            CreatedAtUtc = now.AddDays(-365)
        };
        luthacus.PasswordHash = passwordHasher.HashPassword(luthacus, seedPassword);

        var hagatha = new User
        {
            Username = "Hagatha",
            Email = "hagatha@college.example",
            School = "water",
            CreatedAtUtc = now.AddDays(-240)
        };
        hagatha.PasswordHash = passwordHasher.HashPassword(hagatha, seedPassword);

        db.Users.AddRange(luthacus, hagatha);
        await db.SaveChangesAsync(cancellationToken);

        // Skill, item, and place names below are the game's own (see the lore audit):
        // Prismatic Shock and Fleetfinger are real, Heck Hollow and Dratmoor are on
        // the map, and Karen You Scandalous Wench is — verbatim — a canon item.
        var modDefinitions = new[]
        {
            new SeedMod("prismatic-shock-rework", "Prismatic Shock Rework", "Makes every Prismatic Shock worthy of a banned wizard's grimoire.", "Rebalances the prismatic crackle without sanding away the dangerous edges.", "lua", 4200, 5, luthacus),
            new SeedMod("mount-awful-endless", "Mount Awful — Endless", "A Mount Awful run that does not stop, even when wiser wizards would.", "An endless Boneyard route with escalating waves and no planned final bell.", "boneyard", 843, 10, hagatha),
            new SeedMod("fleetfinger", "Fleetfinger", "Teaches your cursor the Fleetfinger's old dexterity.", "A restrained overlay for apprentices who lose the cursor during crowded waves.", "lua", 1875, 14, hagatha),
            new SeedMod("acid-rain-certified", "Acid Rain Certified", "Forecasts Dratmoor acid rain with unsettling confidence.", "Adds readable weather timing and a suitably caustic warning bell. The spell itself remains neither licensed nor certified.", "lua", 936, 27, luthacus),
            new SeedMod("heck-hollow-gauntlet", "The Heck Hollow Gauntlet", "A curated gauntlet through Heck Hollow's nastiest arrangements.", "A hand-picked sequence of Heck Hollow encounters tuned as a complete gauntlet.", "boneyard", 512, 34, luthacus),
            new SeedMod("iron-golem-plus", "Iron Golem Plus", "Teaches iron golems several new and impolite tricks.", "Extends golem behavior while keeping the old stone-headed temperament intact.", "lua", 611, 39, hagatha),
            new SeedMod("lua-bots", "Lua Bots", "Tiny scripted familiars for repetitive boneyard chores.", "A collection of readable Lua companions that haul, sort, and complain.", "lua", 1280, 51, luthacus),
            new SeedMod("karen-you-scandalous-wench", "Karen You Scandalous Wench", "Returns the College's most scandalous wand to honest circulation.", "Restores the item, its reputation, and the paperwork both generate.", "lua", 1543, 58, hagatha),
            new SeedMod("fast-start-waves", "Fast Start Waves", "Gets the first grim wave moving before the brandy goes cold.", "Shortens the quiet opening without changing late-wave difficulty.", "lua", 420, 64, hagatha),
            new SeedMod("dratmoor-after-dark", "Dratmoor, After Dark", "A harder remix of Dratmoor for wizards who found daylight too forgiving.", "Remixes the Dratmoor route with tougher waves, tighter supplies, and nightfall.", "boneyard", 268, 70, hagatha),
            new SeedMod("dark-cloud-sorter", "Dark Cloud Sorter", "Sorts Dark Clouds by omen, density, and probable doom.", "A clean overlay for readers whose cloud shelf has become indefensible.", "lua", 154, 77, luthacus),
            new SeedMod("custom-intro-stories", "Custom Intro Stories", "Lets each new wizard arrive with a different bad decision.", "Loads short custom prologues before the first trip to the College Solomon attended.", "lua", 37, 89, hagatha)
        };

        var seedMods = new Dictionary<string, Mod>(StringComparer.Ordinal);
        foreach (var definition in modDefinitions)
        {
            var createdAtUtc = now.AddDays(-definition.DaysAgo);
            var versions = new List<ModVersion>();
            foreach (var versionDefinition in VersionsFor(definition))
            {
                var zipBytes = CreatePlaceholderZip(definition.Name);
                await using var zipStream = new MemoryStream(zipBytes, writable: false);
                var storedFileName = await storage.SaveModFileAsync(
                    definition.Slug,
                    versionDefinition.Version,
                    zipStream,
                    cancellationToken);
                versions.Add(new ModVersion
                {
                    Version = versionDefinition.Version,
                    Changelog = versionDefinition.Changelog,
                    FileName = storedFileName,
                    FileSize = zipBytes.LongLength,
                    Downloads = versionDefinition.Downloads,
                    CreatedAtUtc = now.AddDays(-versionDefinition.DaysAgo)
                });
            }

            var mod = new Mod
            {
                Slug = definition.Slug,
                Name = definition.Name,
                Summary = definition.Summary,
                Description = definition.Description,
                Type = definition.Type,
                AuthorId = definition.Author.Id,
                Author = definition.Author,
                Downloads = definition.Downloads,
                CreatedAtUtc = createdAtUtc,
                UpdatedAtUtc = versions.Max(version => version.CreatedAtUtc),
                Versions = versions
            };
            db.Mods.Add(mod);
            seedMods.Add(mod.Slug, mod);
        }

        await db.SaveChangesAsync(cancellationToken);

        if (Directory.Exists(seedAssetsPath))
        {
            var screenshotDefinitions = new[]
            {
                new SeedScreenshots("prismatic-shock-rework", ["prismatic-shock-rework-1.png", "prismatic-shock-rework-2.png", "prismatic-shock-rework-3.png"]),
                new SeedScreenshots("fleetfinger", ["fleetfinger-1.png", "fleetfinger-2.png"]),
                new SeedScreenshots("mount-awful-endless", ["mount-awful-endless-1.png", "mount-awful-endless-2.png"]),
                new SeedScreenshots("dratmoor-after-dark", ["dratmoor-after-dark-1.png"])
            };

            foreach (var definition in screenshotDefinitions)
            {
                var mod = seedMods[definition.ModSlug];
                for (var index = 0; index < definition.FileNames.Length; index++)
                {
                    var sourcePath = Path.Combine(seedAssetsPath, "plates", definition.FileNames[index]);
                    if (!File.Exists(sourcePath))
                    {
                        continue;
                    }

                    await using var source = File.OpenRead(sourcePath);
                    var fileName = await storage.SaveScreenshotAsync(
                        mod.Id,
                        $"seed-{index + 1}",
                        "png",
                        source,
                        cancellationToken);
                    db.ModScreenshots.Add(new ModScreenshot
                    {
                        ModId = mod.Id,
                        FileName = fileName,
                        SortOrder = index
                    });
                }
            }
        }

        var commentDefinitions = new[]
        {
            new SeedComment("prismatic-shock-rework", hagatha, "Installed this before the exam. The exam was transformed. So was the examiner.", 2),
            new SeedComment("mount-awful-endless", luthacus, "An admirable demonstration that an ending is merely a failure of nerve.", 5),
            new SeedComment("fleetfinger", luthacus, "At last, my cursor wanders less than its owner.", 11),
            new SeedComment("acid-rain-certified", hagatha, "The forecast was exact. My umbrella has submitted a formal complaint.", 19),
            new SeedComment("heck-hollow-gauntlet", hagatha, "Elegant, severe, and entirely unsuitable for students with living relatives.", 31),
            new SeedComment("iron-golem-plus", luthacus, "The additional tricks are indeed impolite. One of them corrected my Latin.", 47),
            new SeedComment("karen-you-scandalous-wench", luthacus, "I dug the original out of a sealed vault. The seal was the correct decision.", 8),
            new SeedComment("lua-bots", hagatha, "They sort diligently and complain in complete sentences. Promotion seems inevitable.", 73),
            new SeedComment("dratmoor-after-dark", luthacus, "Night improves Dratmoor. It conceals the administrative neglect.", 101)
        };

        db.ModComments.AddRange(commentDefinitions.Select(definition => new ModComment
        {
            Mod = seedMods[definition.ModSlug],
            AuthorId = definition.Author.Id,
            Author = definition.Author,
            Body = definition.Body,
            CreatedAtUtc = now.AddHours(-definition.HoursAgo)
        }));

        var saveDefinitions = new[]
        {
            (Slot: 0, Name: "Before the Tower", Size: 192),
            (Slot: 1, Name: "halfway up — do not judge", Size: 320),
            (Slot: 2, Name: "post-Heartmonger", Size: 448)
        };

        foreach (var definition in saveDefinitions)
        {
            var bytes = RandomNumberGenerator.GetBytes(definition.Size);
            var sha256 = await storage.SaveCloudSaveAsync(
                luthacus.Id,
                definition.Slot,
                bytes,
                cancellationToken);
            db.CloudSaves.Add(new CloudSave
            {
                UserId = luthacus.Id,
                User = luthacus,
                Slot = definition.Slot,
                Name = definition.Name,
                Size = bytes.LongLength,
                Sha256 = sha256,
                UpdatedAtUtc = now.AddMinutes(-definition.Slot * 17)
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static byte[] CreatePlaceholderZip(string modName)
    {
        using var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            var entry = archive.CreateEntry("README.txt");
            using var writer = new StreamWriter(entry.Open());
            writer.Write($"{modName}\n\nDevelopment seed placeholder for Solomon Dark Revived.");
        }

        return stream.ToArray();
    }

    private static IReadOnlyList<SeedVersion> VersionsFor(SeedMod mod) => mod.Slug switch
    {
        "prismatic-shock-rework" =>
        [
            new("1.0.0", "First recovered edition.", 630, 5),
            new("1.1.0", "Rebalanced the third refraction. The prism no longer argues with its own reflections.", 1050, 3),
            new("1.2.0", "Fixed a crash when six shocks share one skeleton. The skeleton is not fine, which is the point.", 2520, 1)
        ],
        "fleetfinger" =>
        [
            new("1.0.0", "First recovered edition.", 563, 14),
            new("1.1.0", "The cursor now heels properly during crowded waves. Fewer apologies required.", 1312, 4)
        ],
        "mount-awful-endless" =>
        [
            new("1.0.0", "First recovered edition.", 253, 10),
            new("1.0.1", "Wave 41 no longer spawns inside the scenery. The scenery had lodged complaints.", 590, 6)
        ],
        _ => [new("1.0.0", "First recovered edition.", mod.Downloads, mod.DaysAgo)]
    };

    private sealed record SeedMod(
        string Slug,
        string Name,
        string Summary,
        string Description,
        string Type,
        int Downloads,
        int DaysAgo,
        User Author);

    private sealed record SeedVersion(
        string Version,
        string Changelog,
        int Downloads,
        int DaysAgo);

    private sealed record SeedScreenshots(string ModSlug, string[] FileNames);

    private sealed record SeedComment(
        string ModSlug,
        User Author,
        string Body,
        int HoursAgo);
}
