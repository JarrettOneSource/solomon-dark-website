using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;

namespace SolomonDarkRevived.Services;

public sealed record ModPublicationRequest(
    int AuthorId,
    string Name,
    string Summary,
    string Description,
    string? Slug,
    string? Version,
    IReadOnlyList<string> Tags,
    string Changelog);

public sealed record ModPackageSource(Stream Stream, long Length);

public sealed record ModScreenshotUpload(
    string Extension,
    Func<Stream> OpenReadStream);

public sealed class ModPublishingException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public sealed class ModPublishingService(AppDb db, StorageService storage)
{
    public const int MaxNameLength = 60;
    public const int MaxSummaryLength = 160;
    public const int MaxDescriptionLength = 10_000;

    private const long MaxModBytes = 100L * 1024 * 1024;
    private const int MaxTagsPerMod = 5;

    public async Task<string> PublishBoneyardAsync(
        BoneyardDraft draft,
        int authorId,
        string name,
        string? slug,
        string summary,
        string description,
        string version,
        string changelog,
        ReadOnlyMemory<byte> boneyard,
        CancellationToken cancellationToken = default)
    {
        if (draft.UserId != authorId)
        {
            throw new ModPublishingException(
                StatusCodes.Status403Forbidden,
                "Only the draft owner may publish this Boneyard.");
        }

        using (var stream = new MemoryStream(boneyard.ToArray(), writable: false))
        {
            BoneyardFileInspector.Validate(stream, "compiled draft");
        }

        if (draft.PublishedModId is { } publishedModId)
        {
            return await PublishBoneyardRevisionAsync(
                publishedModId,
                authorId,
                name,
                summary,
                description,
                version,
                changelog,
                boneyard,
                cancellationToken);
        }

        var mod = await PublishNewAsync(
                new ModPublicationRequest(
                    authorId,
                    name,
                    summary,
                    description,
                    slug,
                    version,
                    ["boneyard"],
                    changelog),
                resolvedSlug =>
                {
                    var package = BoneyardPackageBuilder.Create(
                        resolvedSlug,
                        name.Trim(),
                        resolvedSlug,
                        version,
                        boneyard.Span);
                    return new ModPackageSource(package, package.Length);
                },
                [],
                draft,
                cancellationToken);
        return mod.Slug;
    }

    public async Task<string> PublishAsync(
        ModPublicationRequest request,
        Func<string, ModPackageSource> createPackage,
        IReadOnlyList<ModScreenshotUpload> screenshots,
        CancellationToken cancellationToken = default) =>
        (await PublishNewAsync(
            request,
            createPackage,
            screenshots,
            publishedDraft: null,
            cancellationToken)).Slug;

    private async Task<Mod> PublishNewAsync(
        ModPublicationRequest request,
        Func<string, ModPackageSource> createPackage,
        IReadOnlyList<ModScreenshotUpload> screenshots,
        BoneyardDraft? publishedDraft,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        var summary = request.Summary.Trim();
        ValidateMetadata(name, summary, request.Description);
        var tags = NormalizeTags(request.Tags);

        if (!await db.Users.AnyAsync(user => user.Id == request.AuthorId, cancellationToken))
        {
            throw new ModPublishingException(
                StatusCodes.Status401Unauthorized,
                "The Annals could not identify this mod author.");
        }

        var slug = await ResolveSlugAsync(request.Slug, name, cancellationToken);
        var packageSource = createPackage(slug);
        await using var packageStream = packageSource.Stream;
        if (packageSource.Length <= 0)
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                "Choose a non-empty mod zip.");
        }

        if (packageSource.Length > MaxModBytes)
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                "Mod files may not exceed 100 MiB.");
        }

        var package = await ModPackageInspector.InspectAsync(packageStream, cancellationToken);
        var versionName = request.Version?.Trim();
        if (string.IsNullOrEmpty(versionName))
        {
            versionName = package.ManifestVersion;
        }

        if (!SemanticVersion.TryParse(versionName, out _))
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                "Versions must use semantic versioning, for example 1.2.0 or 1.2.0-beta.1.");
        }

        if (!string.Equals(versionName, package.ManifestVersion, StringComparison.Ordinal))
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                "The upload version must exactly match manifest.version.");
        }

        if (await db.Mods.AnyAsync(
                candidate => candidate.LauncherModId == package.LauncherModId,
                cancellationToken))
        {
            throw new ModPublishingException(
                StatusCodes.Status409Conflict,
                $"A website mod already uses manifest.id '{package.LauncherModId}'.");
        }

        var now = DateTime.UtcNow;
        var mod = new Mod
        {
            Slug = slug,
            Name = name,
            Summary = summary,
            Description = request.Description,
            LauncherModId = package.LauncherModId,
            AuthorId = request.AuthorId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            Tags = tags.Select(tag => new ModTag { Name = tag }).ToList()
        };
        var version = new ModVersion
        {
            Version = versionName,
            ManifestVersion = package.ManifestVersion,
            PackageSha256 = package.PackageSha256,
            ContentSha256 = package.ContentSha256,
            Changelog = request.Changelog,
            FileSize = packageSource.Length,
            CreatedAtUtc = now
        };
        mod.Versions.Add(version);

        var screenshotNames = new List<string>();
        try
        {
            packageStream.Position = 0;
            version.FileName = await storage.SaveModFileAsync(
                slug,
                versionName,
                packageStream,
                cancellationToken);

            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            db.Mods.Add(mod);
            await db.SaveChangesAsync(cancellationToken);
            if (publishedDraft is not null)
            {
                publishedDraft.PublishedModId = mod.Id;
            }

            for (var index = 0; index < screenshots.Count; index++)
            {
                var screenshot = screenshots[index];
                await using var source = screenshot.OpenReadStream();
                var fileName = await storage.SaveScreenshotAsync(
                    mod.Id,
                    Guid.NewGuid().ToString("N")[..8],
                    screenshot.Extension,
                    source,
                    cancellationToken);
                screenshotNames.Add(fileName);
                mod.Screenshots.Add(new ModScreenshot
                {
                    FileName = fileName,
                    SortOrder = index
                });
            }

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            storage.DeleteModDirectory(slug);
            foreach (var screenshotName in screenshotNames)
            {
                storage.DeleteScreenshot(screenshotName);
            }

            throw;
        }

        return mod;
    }

    private async Task<string> PublishBoneyardRevisionAsync(
        int modId,
        int authorId,
        string name,
        string summary,
        string description,
        string versionName,
        string changelog,
        ReadOnlyMemory<byte> boneyard,
        CancellationToken cancellationToken)
    {
        name = name.Trim();
        summary = summary.Trim();
        versionName = versionName.Trim();
        ValidateMetadata(name, summary, description);
        if (!SemanticVersion.TryParse(versionName, out var nextVersion))
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                "Versions must use semantic versioning, for example 1.2.0 or 1.2.0-beta.1.");
        }

        var mod = await db.Mods
            .Include(candidate => candidate.Versions)
            .SingleOrDefaultAsync(candidate => candidate.Id == modId, cancellationToken);
        if (mod is null || mod.AuthorId != authorId || string.IsNullOrWhiteSpace(mod.LauncherModId))
        {
            throw new ModPublishingException(
                StatusCodes.Status409Conflict,
                "The published Boneyard is no longer available to revise.");
        }

        var currentVersion = HighestSemanticVersion(mod.Versions);
        if (nextVersion!.CompareTo(currentVersion) <= 0)
        {
            throw new ModPublishingException(
                StatusCodes.Status409Conflict,
                $"New editions must be newer than v{currentVersion.Value}.");
        }

        await using var packageStream = BoneyardPackageBuilder.Create(
            mod.LauncherModId,
            name,
            mod.Slug,
            versionName,
            boneyard.Span);
        var packageLength = packageStream.Length;
        var package = await ModPackageInspector.InspectAsync(packageStream, cancellationToken);
        if (!string.Equals(package.LauncherModId, mod.LauncherModId, StringComparison.Ordinal) ||
            !string.Equals(package.ManifestVersion, versionName, StringComparison.Ordinal))
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                "The Boneyard package identity changed while publishing.");
        }

        var now = DateTime.UtcNow;
        var version = new ModVersion
        {
            Version = versionName,
            ManifestVersion = package.ManifestVersion,
            PackageSha256 = package.PackageSha256,
            ContentSha256 = package.ContentSha256,
            Changelog = changelog,
            FileSize = packageLength,
            CreatedAtUtc = now
        };

        try
        {
            packageStream.Position = 0;
            version.FileName = await storage.SaveModFileAsync(
                mod.Slug,
                versionName,
                packageStream,
                cancellationToken);
            mod.Name = name;
            mod.Summary = summary;
            mod.Description = description;
            mod.UpdatedAtUtc = now;
            mod.Versions.Add(version);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            if (version.FileName.Length > 0)
            {
                storage.DeleteModFile(version.FileName);
            }
            throw;
        }

        return mod.Slug;
    }

    private static SemanticVersion HighestSemanticVersion(IEnumerable<ModVersion> versions)
    {
        SemanticVersion? highest = null;
        foreach (var version in versions)
        {
            if (!SemanticVersion.TryParse(version.Version, out var parsed))
            {
                throw new ModPublishingException(
                    StatusCodes.Status409Conflict,
                    $"Stored mod version is not semantic: {version.Version}");
            }

            if (highest is null || parsed!.CompareTo(highest) > 0)
            {
                highest = parsed;
            }
        }

        return highest ?? throw new ModPublishingException(
            StatusCodes.Status409Conflict,
            "The published Boneyard has no editions.");
    }

    public static void ValidateMetadata(string name, string summary, string description)
    {
        if (name.Length < 3 || name.Length > MaxNameLength)
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                $"Mod names must be 3-{MaxNameLength} characters.");
        }

        if (summary.Length > MaxSummaryLength)
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                $"Summaries may not exceed {MaxSummaryLength} characters.");
        }

        if (description.Length > MaxDescriptionLength)
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                $"Descriptions may not exceed {MaxDescriptionLength:N0} characters.");
        }
    }

    private async Task<string> ResolveSlugAsync(
        string? requestedSlug,
        string name,
        CancellationToken cancellationToken)
    {
        if (requestedSlug is not null)
        {
            var slug = requestedSlug.Trim();
            if (!IsSafeSlug(slug))
            {
                throw new ModPublishingException(
                    StatusCodes.Status400BadRequest,
                    "Slugs must be 1-80 lowercase letters, numbers, or single hyphen-separated words.");
            }

            if (await db.Mods.AnyAsync(mod => mod.Slug == slug, cancellationToken))
            {
                throw new ModPublishingException(
                    StatusCodes.Status409Conflict,
                    "That slug is already in the library.");
            }

            return slug;
        }

        var baseSlug = Slugify(name);
        var candidate = baseSlug;
        var suffix = 2;
        while (await db.Mods.AnyAsync(mod => mod.Slug == candidate, cancellationToken))
        {
            candidate = $"{baseSlug}-{suffix}";
            suffix++;
        }

        return candidate;
    }

    private static string[] NormalizeTags(IEnumerable<string> rawTags)
    {
        var tags = rawTags
            .Select(NormalizeTag)
            .Where(tag => tag.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        if (tags.Length > MaxTagsPerMod)
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                "A tome carries at most five tags. The Librarian's patience is finite.");
        }

        if (tags.Any(tag => !IsValidTag(tag)))
        {
            throw new ModPublishingException(
                StatusCodes.Status400BadRequest,
                "Tags are 2-24 plain characters: letters, numbers, spaces, and hyphens.");
        }

        return tags;
    }

    private static string NormalizeTag(string rawTag)
    {
        var normalized = rawTag.Trim().ToLowerInvariant();
        var builder = new StringBuilder(normalized.Length);
        var pendingSpace = false;
        foreach (var character in normalized)
        {
            if (char.IsWhiteSpace(character))
            {
                pendingSpace = true;
                continue;
            }

            if (pendingSpace && builder.Length > 0)
            {
                builder.Append(' ');
            }

            builder.Append(character);
            pendingSpace = false;
        }

        return builder.ToString();
    }

    private static bool IsValidTag(string tag) =>
        tag.Length is >= 2 and <= 24 &&
        IsTagLetterOrDigit(tag[0]) &&
        IsTagLetterOrDigit(tag[^1]) &&
        tag.All(character => IsTagLetterOrDigit(character) || character is ' ' or '-');

    private static bool IsTagLetterOrDigit(char character) =>
        character is >= 'a' and <= 'z' or >= '0' and <= '9';

    private static bool IsSafeSlug(string slug) =>
        slug.Length is >= 1 and <= 80 &&
        slug[0] is >= 'a' and <= 'z' or >= '0' and <= '9' &&
        slug[^1] is >= 'a' and <= 'z' or >= '0' and <= '9' &&
        !slug.Contains("--", StringComparison.Ordinal) &&
        slug.All(character => character is >= 'a' and <= 'z' or >= '0' and <= '9' or '-');

    private static string Slugify(string name)
    {
        var builder = new StringBuilder();
        var pendingHyphen = false;
        foreach (var character in name.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (character is >= 'A' and <= 'Z')
            {
                if (pendingHyphen && builder.Length > 0)
                {
                    builder.Append('-');
                }

                builder.Append(char.ToLowerInvariant(character));
                pendingHyphen = false;
            }
            else if (character is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                if (pendingHyphen && builder.Length > 0)
                {
                    builder.Append('-');
                }

                builder.Append(character);
                pendingHyphen = false;
            }
            else
            {
                pendingHyphen = true;
            }
        }

        return builder.Length == 0 ? "mod" : builder.ToString();
    }
}
