using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class ModEndpoints
{
    private const long MaxModBytes = 100L * 1024 * 1024;
    private const long MaxScreenshotBytes = 2L * 1024 * 1024;
    private const int MaxScreenshotsPerMod = 10;
    private const int MaxTagsPerMod = 5;
    private const long UploadRequestLimit = 120L * 1024 * 1024;
    private const string InvalidTagError =
        "Tags are 2–24 plain characters: letters, numbers, spaces, hyphens. The filing system predates punctuation.";
    private const string TooManyTagsError =
        "A tome carries at most five tags. The Librarian's patience is finite.";

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/mods", ListAsync);
        app.MapPost("/api/mods/resolve", ResolveAsync);
        app.MapPost("/api/mods/updates", UpdatesAsync);
        app.MapGet("/api/tags", ListTagsAsync);
        app.MapGet("/api/mods/popular", PopularAsync);
        app.MapGet("/api/mods/{slug}", DetailAsync);
        app.MapGet("/api/mods/{slug}/comments", ListCommentsAsync);
        app.MapPost("/api/mods/{slug}/comments", CreateCommentAsync)
            .RequireAuthorization()
            .RequireRateLimiting("mod-comments");
        app.MapDelete("/api/mods/{slug}/comments/{id:int}", DeleteCommentAsync)
            .RequireAuthorization();
        app.MapGet("/api/users/{username}", PublicProfileAsync);
        app.MapPost("/api/mods", CreateAsync)
            .RequireAuthorization()
            .WithMetadata(new RequestSizeLimitAttribute(UploadRequestLimit));
        app.MapPost("/api/mods/{slug}/versions", AddVersionAsync)
            .RequireAuthorization()
            .WithMetadata(new RequestSizeLimitAttribute(UploadRequestLimit));
        app.MapPost("/api/mods/{slug}/screenshots", AddScreenshotsAsync)
            .RequireAuthorization()
            .WithMetadata(new RequestSizeLimitAttribute(UploadRequestLimit));
        app.MapDelete("/api/mods/{slug}/screenshots/{id:int}", DeleteScreenshotAsync)
            .RequireAuthorization();
        app.MapPut("/api/mods/{slug}/screenshots/order", ReorderScreenshotsAsync)
            .RequireAuthorization();
        app.MapPatch("/api/mods/{slug}", PatchAsync).RequireAuthorization();
        app.MapDelete("/api/mods/{slug}", DeleteAsync).RequireAuthorization();
        app.MapGet("/api/mods/{slug}/download", DownloadLatestAsync);
        app.MapGet("/api/mods/{slug}/versions/{versionId:int}/download", DownloadVersionAsync);
    }

    private static async Task<IResult> ResolveAsync(
        ResolveModsRequest request,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var required = request.Mods ?? [];
        if (required.Length > 128)
        {
            return ApiErrors.BadRequest("At most 128 exact mods may be resolved at once.");
        }

        var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var mod in required)
        {
            if (mod is null ||
                !IsValidLauncherModId(mod.Id) ||
                !StorageService.IsSafeVersion(mod.Version ?? string.Empty) ||
                !IsSha256(mod.ContentSha256))
            {
                return ApiErrors.BadRequest(
                    "Every requested mod must include a valid id, version, and contentSha256.");
            }

            if (!seenIds.Add(mod.Id!))
            {
                return ApiErrors.BadRequest($"The requested mod id is duplicated: {mod.Id}");
            }
        }

        var requestedIds = required.Select(mod => mod.Id!).ToArray();
        var candidates = await db.Mods.AsNoTracking()
            .Where(mod => mod.LauncherModId != null && requestedIds.Contains(mod.LauncherModId))
            .Include(mod => mod.Versions)
            .ToArrayAsync(cancellationToken);

        var resolved = new List<object>();
        var missing = new List<object>();
        foreach (var requirement in required)
        {
            var mod = candidates.SingleOrDefault(candidate => string.Equals(
                candidate.LauncherModId,
                requirement.Id,
                StringComparison.OrdinalIgnoreCase));
            var version = mod?.Versions.SingleOrDefault(candidate =>
                string.Equals(candidate.ManifestVersion, requirement.Version, StringComparison.Ordinal) &&
                string.Equals(candidate.ContentSha256, requirement.ContentSha256, StringComparison.OrdinalIgnoreCase) &&
                candidate.PackageSha256 is not null);
            if (mod is null || version is null)
            {
                missing.Add(new
                {
                    id = requirement.Id,
                    version = requirement.Version,
                    contentSha256 = requirement.ContentSha256?.ToLowerInvariant()
                });
                continue;
            }

            resolved.Add(new
            {
                id = mod.LauncherModId,
                version = version.ManifestVersion,
                contentSha256 = version.ContentSha256,
                packageSha256 = version.PackageSha256,
                mod.Slug,
                mod.Name,
                versionId = version.Id,
                version.FileSize,
                downloadUrl = $"api/mods/{mod.Slug}/versions/{version.Id}/download"
            });
        }

        return Results.Ok(new
        {
            mods = resolved,
            missing
        });
    }

    private static async Task<IResult> UpdatesAsync(
        UpdateModsRequest request,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var installed = request.Mods ?? [];
        if (installed.Length > 128)
        {
            return ApiErrors.BadRequest("At most 128 installed mods may be checked at once.");
        }

        var seenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var parsedVersions = new Dictionary<string, SemanticVersion>(
            StringComparer.OrdinalIgnoreCase);
        foreach (var mod in installed)
        {
            if (mod is null ||
                !IsValidLauncherModId(mod.Id) ||
                !SemanticVersion.TryParse(mod.Version, out var parsed))
            {
                return ApiErrors.BadRequest(
                    "Every installed mod must include a valid id and semantic version.");
            }

            if (!seenIds.Add(mod.Id!))
            {
                return ApiErrors.BadRequest($"The installed mod id is duplicated: {mod.Id}");
            }
            parsedVersions.Add(mod.Id!, parsed!);
        }

        var installedIds = installed.Select(mod => mod!.Id!).ToArray();
        var candidates = await db.Mods.AsNoTracking()
            .Where(mod => mod.LauncherModId != null && installedIds.Contains(mod.LauncherModId))
            .Include(mod => mod.Versions)
            .ToArrayAsync(cancellationToken);

        var updates = new List<object>();
        foreach (var mod in candidates)
        {
            var latest = HighestDownloadableVersion(mod.Versions);
            if (latest is null ||
                !SemanticVersion.TryParse(latest.ManifestVersion, out var latestVersion) ||
                latestVersion!.CompareTo(parsedVersions[mod.LauncherModId!]) <= 0)
            {
                continue;
            }

            updates.Add(new
            {
                id = mod.LauncherModId,
                version = latest.ManifestVersion,
                contentSha256 = latest.ContentSha256,
                packageSha256 = latest.PackageSha256,
                mod.Slug,
                versionId = latest.Id,
                latest.FileSize,
                downloadUrl = $"api/mods/{mod.Slug}/versions/{latest.Id}/download"
            });
        }

        return Results.Ok(new { updates });
    }

    private static async Task<IResult> ListAsync(
        HttpRequest request,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var search = request.Query["search"].ToString().Trim();
        var tagFilters = request.Query["tag"]
            .SelectMany(value => (value ?? string.Empty).Split(','))
            .Select(NormalizeTag)
            .Where(value => value.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .Take(MaxTagsPerMod)
            .ToArray();
        var sort = request.Query["sort"].ToString().Trim().ToLowerInvariant();
        var page = Math.Max(ParseInt(request.Query["page"].ToString(), 1), 1);
        var pageSize = Math.Clamp(ParseInt(request.Query["pageSize"].ToString(), 20), 1, 50);

        IQueryable<Mod> query = db.Mods.AsNoTracking();
        if (search.Length > 0)
        {
            var pattern = $"%{search}%";
            query = query.Where(mod =>
                EF.Functions.Like(mod.Name, pattern) ||
                EF.Functions.Like(mod.Summary, pattern));
        }

        foreach (var value in tagFilters)
        {
            query = query.Where(mod => mod.Tags.Any(tag => tag.Name == value));
        }

        var total = await query.CountAsync(cancellationToken);
        query = sort switch
        {
            "downloads" => query.OrderByDescending(mod => mod.Downloads)
                .ThenByDescending(mod => mod.CreatedAtUtc),
            "updated" => query.OrderByDescending(mod => mod.UpdatedAtUtc)
                .ThenByDescending(mod => mod.Id),
            "name" => query.OrderBy(mod => EF.Functions.Collate(mod.Name, "NOCASE"))
                .ThenBy(mod => mod.Id),
            _ => query.OrderByDescending(mod => mod.CreatedAtUtc)
                .ThenByDescending(mod => mod.Id)
        };

        var mods = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(mod => mod.Author)
            .Include(mod => mod.Tags)
            .Include(mod => mod.Versions)
            .Include(mod => mod.Screenshots)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        return Results.Ok(new
        {
            items = mods.Select(mod => ToItem(mod)).ToArray(),
            total,
            page,
            pageSize
        });
    }

    private static async Task<IResult> PopularAsync(
        HttpRequest request,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var days = ParseInt(request.Query["days"].ToString(), 30);
        if (days is not (30 or 60 or 90))
        {
            days = 30;
        }

        var since = DateTime.UtcNow.AddDays(-days);
        var counts = await db.ModDownloadEvents.AsNoTracking()
            .Where(e => e.DownloadedAtUtc >= since)
            .GroupBy(e => e.ModId)
            .Select(g => new { ModId = g.Key, Count = g.Count() })
            .OrderByDescending(g => g.Count)
            .Take(8)
            .ToArrayAsync(cancellationToken);

        var countsById = counts.ToDictionary(count => count.ModId, count => count.Count);
        var modIds = countsById.Keys.ToArray();
        var mods = await db.Mods.AsNoTracking()
            .Where(mod => modIds.Contains(mod.Id))
            .Include(mod => mod.Author)
            .Include(mod => mod.Tags)
            .Include(mod => mod.Versions)
            .Include(mod => mod.Screenshots)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);

        var ordered = mods
            .OrderByDescending(mod => countsById[mod.Id])
            .ThenByDescending(mod => mod.Downloads)
            .ThenByDescending(mod => mod.CreatedAtUtc);

        return Results.Ok(new
        {
            days,
            items = ordered.Select(mod => ToItem(mod, countsById[mod.Id])).ToArray()
        });
    }

    private static async Task<IResult> ListTagsAsync(
        AppDb db,
        CancellationToken cancellationToken)
    {
        var items = await db.ModTags.AsNoTracking()
            .GroupBy(tag => tag.Name)
            .Select(group => new { tag = group.Key, count = group.Count() })
            .OrderByDescending(entry => entry.count)
            .ThenBy(entry => entry.tag)
            .ToArrayAsync(cancellationToken);
        return Results.Ok(new { items });
    }

    private static async Task<IResult> DetailAsync(
        string slug,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var mod = await LoadModAsync(db, slug, cancellationToken);
        return mod is null
            ? ApiErrors.NotFound("That tome is missing from the library.")
            : Results.Ok(ToDetail(mod));
    }

    private static async Task<IResult> ListCommentsAsync(
        string slug,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var modId = await db.Mods.AsNoTracking()
            .Where(mod => mod.Slug == slug)
            .Select(mod => (int?)mod.Id)
            .SingleOrDefaultAsync(cancellationToken);
        if (modId is null)
        {
            return ApiErrors.NotFound("That tome is missing from the library.");
        }

        var query = db.ModComments.AsNoTracking()
            .Where(comment => comment.ModId == modId.Value);
        var total = await query.CountAsync(cancellationToken);
        var comments = await query
            .OrderByDescending(comment => comment.CreatedAtUtc)
            .ThenByDescending(comment => comment.Id)
            .Take(100)
            .Include(comment => comment.Author)
            .ToArrayAsync(cancellationToken);

        return Results.Ok(new
        {
            items = comments.Select(ToComment).ToArray(),
            total
        });
    }

    private static async Task<IResult> CreateCommentAsync(
        string slug,
        CommentRequest request,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var mod = await db.Mods.SingleOrDefaultAsync(
            candidate => candidate.Slug == slug,
            cancellationToken);
        if (mod is null)
        {
            return ApiErrors.NotFound("That tome is missing from the library.");
        }

        var body = request.Body?.Trim() ?? string.Empty;
        if (body.Length == 0)
        {
            return ApiErrors.BadRequest("Blank parchment is not marginalia.");
        }

        if (body.Length > 1000)
        {
            return ApiErrors.BadRequest("The margin permits 1,000 characters. Procure a smaller quill.");
        }

        var userId = TokenService.GetUserId(context.User);
        var author = userId is null
            ? null
            : await db.Users.SingleOrDefaultAsync(
                user => user.Id == userId.Value,
                cancellationToken);
        if (author is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this scribe.");
        }

        var comment = new ModComment
        {
            ModId = mod.Id,
            AuthorId = author.Id,
            Author = author,
            Body = body,
            CreatedAtUtc = DateTime.UtcNow
        };
        db.ModComments.Add(comment);
        await db.SaveChangesAsync(cancellationToken);

        return Results.Json(ToComment(comment), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> DeleteCommentAsync(
        string slug,
        int id,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var comment = await db.ModComments
            .Include(candidate => candidate.Mod)
            .SingleOrDefaultAsync(
                candidate => candidate.Id == id && candidate.Mod.Slug == slug,
                cancellationToken);
        if (comment is null)
        {
            return ApiErrors.NotFound("That marginal note is missing from the tome.");
        }

        var userId = TokenService.GetUserId(context.User);
        if (userId != comment.AuthorId && userId != comment.Mod.AuthorId)
        {
            return ApiErrors.Forbidden("Only the note's author or the tome's owner may erase it.");
        }

        db.ModComments.Remove(comment);
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> PublicProfileAsync(
        string username,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Username == username, cancellationToken);
        if (user is null)
        {
            return ApiErrors.NotFound("No wizard by that name appears in the Annals.");
        }

        var authoredMods = db.Mods.AsNoTracking().Where(mod => mod.AuthorId == user.Id);
        var modCount = await authoredMods.CountAsync(cancellationToken);
        var downloadsTotal = await authoredMods
            .SumAsync(mod => (int?)mod.Downloads, cancellationToken) ?? 0;
        var mods = await authoredMods
            .OrderByDescending(mod => mod.CreatedAtUtc)
            .ThenByDescending(mod => mod.Id)
            .Take(50)
            .Include(mod => mod.Author)
            .Include(mod => mod.Tags)
            .Include(mod => mod.Versions)
            .Include(mod => mod.Screenshots)
            .AsSplitQuery()
            .ToArrayAsync(cancellationToken);

        return Results.Ok(new
        {
            user = new { user.Id, user.Username, user.School, user.CreatedAtUtc },
            modCount,
            downloadsTotal,
            mods = mods.Select(mod => ToItem(mod)).ToArray()
        });
    }

    private static async Task<IResult> CreateAsync(
        HttpContext context,
        AppDb db,
        ModPublishingService publisher,
        CancellationToken cancellationToken)
    {
        if (!context.Request.HasFormContentType)
        {
            return ApiErrors.UnsupportedMediaType("Mod uploads must use multipart/form-data.");
        }

        IFormCollection form;
        try
        {
            form = await context.Request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException)
        {
            return ApiErrors.BadRequest("The multipart upload could not be read.");
        }

        var name = form["name"].ToString().Trim();
        var summary = form["summary"].ToString().Trim();
        var description = form["description"].ToString();
        var rawTags = form["tags"].ToString();
        var versionName = form["version"].ToString().Trim();

        var validationError = ValidateModFields(name, summary, description);
        if (validationError is not null)
        {
            return ApiErrors.BadRequest(validationError);
        }

        var tagValidationError = ParseTags(rawTags, out var tags);
        if (tagValidationError is not null)
        {
            return ApiErrors.BadRequest(tagValidationError);
        }

        var file = form.Files.GetFile("file");
        if (file is null || file.Length == 0)
        {
            return ApiErrors.BadRequest("Choose a non-empty mod zip.");
        }

        if (!string.Equals(Path.GetExtension(file.FileName), ".zip", StringComparison.OrdinalIgnoreCase))
        {
            return ApiErrors.BadRequest("Mod files must be .zip archives.");
        }

        if (file.Length > MaxModBytes)
        {
            return ApiErrors.BadRequest("Mod files may not exceed 100 MiB.");
        }

        var screenshots = form.Files.GetFiles("screenshots").ToArray();
        if (screenshots.Length > MaxScreenshotsPerMod)
        {
            return ApiErrors.BadRequest($"A tome may display at most {MaxScreenshotsPerMod} screenshots.");
        }

        var screenshotValidationError = ValidateScreenshots(screenshots);
        if (screenshotValidationError is not null)
        {
            return ApiErrors.BadRequest(screenshotValidationError);
        }

        var userId = TokenService.GetUserId(context.User);
        if (userId is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this mod author.");
        }

        try
        {
            var uploads = screenshots.Select(screenshot => new ModScreenshotUpload(
                ScreenshotExtension(screenshot.FileName)!,
                screenshot.OpenReadStream)).ToArray();
            var slug = await publisher.PublishAsync(
                new ModPublicationRequest(
                    userId.Value,
                    name,
                    summary,
                    description,
                    null,
                    versionName,
                    tags,
                    ""),
                _ => new ModPackageSource(file.OpenReadStream(), file.Length),
                uploads,
                cancellationToken);
            var created = await LoadModAsync(db, slug, cancellationToken);
            return Results.Json(ToDetail(created!), statusCode: StatusCodes.Status201Created);
        }
        catch (ModPackageValidationException exception)
        {
            return ApiErrors.BadRequest(exception.Message);
        }
        catch (ModPublishingException exception)
        {
            return ApiErrors.Error(exception.StatusCode, exception.Message);
        }
    }

    private static async Task<IResult> AddScreenshotsAsync(
        string slug,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        if (!context.Request.HasFormContentType)
        {
            return ApiErrors.UnsupportedMediaType("Screenshot uploads must use multipart/form-data.");
        }

        IFormCollection form;
        try
        {
            form = await context.Request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException)
        {
            return ApiErrors.BadRequest("The multipart upload could not be read.");
        }

        var mod = await db.Mods
            .Include(candidate => candidate.Screenshots)
            .SingleOrDefaultAsync(candidate => candidate.Slug == slug, cancellationToken);
        if (mod is null)
        {
            return ApiErrors.NotFound("That tome is missing from the library.");
        }

        if (TokenService.GetUserId(context.User) != mod.AuthorId)
        {
            return ApiErrors.Forbidden("Only the tome's author may add screenshots.");
        }

        var screenshots = form.Files.GetFiles("screenshots").ToArray();
        if (screenshots.Length == 0)
        {
            return ApiErrors.BadRequest("Choose at least one non-empty screenshot.");
        }

        if (mod.Screenshots.Count + screenshots.Length > MaxScreenshotsPerMod)
        {
            return ApiErrors.BadRequest($"A tome may display at most {MaxScreenshotsPerMod} screenshots.");
        }

        var validationError = ValidateScreenshots(screenshots);
        if (validationError is not null)
        {
            return ApiErrors.BadRequest(validationError);
        }

        var nextSortOrder = mod.Screenshots.Count == 0
            ? 0
            : mod.Screenshots.Max(screenshot => screenshot.SortOrder) + 1;
        var screenshotNames = new List<string>();
        try
        {
            for (var index = 0; index < screenshots.Length; index++)
            {
                var screenshot = screenshots[index];
                await using var source = screenshot.OpenReadStream();
                var fileName = await storage.SaveScreenshotAsync(
                    mod.Id,
                    Guid.NewGuid().ToString("N")[..8],
                    ScreenshotExtension(screenshot.FileName)!,
                    source,
                    cancellationToken);
                screenshotNames.Add(fileName);
                mod.Screenshots.Add(new ModScreenshot
                {
                    FileName = fileName,
                    SortOrder = nextSortOrder + index
                });
            }

            await db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            foreach (var screenshotName in screenshotNames)
            {
                storage.DeleteScreenshot(screenshotName);
            }

            throw;
        }

        var updated = await LoadModAsync(db, slug, cancellationToken);
        return Results.Json(ToDetail(updated!), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> DeleteScreenshotAsync(
        string slug,
        int id,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        var mod = await db.Mods
            .Include(candidate => candidate.Screenshots)
            .SingleOrDefaultAsync(candidate => candidate.Slug == slug, cancellationToken);
        if (mod is null)
        {
            return ApiErrors.NotFound("That tome is missing from the library.");
        }

        if (TokenService.GetUserId(context.User) != mod.AuthorId)
        {
            return ApiErrors.Forbidden("Only the tome's author may remove screenshots.");
        }

        var screenshot = mod.Screenshots.SingleOrDefault(candidate => candidate.Id == id);
        if (screenshot is null)
        {
            return ApiErrors.NotFound("That screenshot is missing from the tome.");
        }

        db.ModScreenshots.Remove(screenshot);
        var remaining = mod.Screenshots
            .Where(candidate => candidate.Id != id)
            .OrderBy(candidate => candidate.SortOrder)
            .ThenBy(candidate => candidate.Id)
            .ToArray();
        for (var index = 0; index < remaining.Length; index++)
        {
            remaining[index].SortOrder = index;
        }

        await db.SaveChangesAsync(cancellationToken);
        storage.DeleteScreenshot(screenshot.FileName);
        return Results.NoContent();
    }

    private static async Task<IResult> ReorderScreenshotsAsync(
        string slug,
        ReorderScreenshotsRequest request,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var mod = await db.Mods
            .Include(candidate => candidate.Screenshots)
            .SingleOrDefaultAsync(candidate => candidate.Slug == slug, cancellationToken);
        if (mod is null)
        {
            return ApiErrors.NotFound("That tome is missing from the library.");
        }

        if (TokenService.GetUserId(context.User) != mod.AuthorId)
        {
            return ApiErrors.Forbidden("Only the tome's author may reorder screenshots.");
        }

        var ids = request.Ids;
        var currentIds = mod.Screenshots.Select(screenshot => screenshot.Id).ToHashSet();
        if (ids is null ||
            ids.Length != currentIds.Count ||
            ids.Distinct().Count() != ids.Length ||
            !currentIds.SetEquals(ids))
        {
            return ApiErrors.BadRequest("The screenshot order must name every plate exactly once.");
        }

        var screenshotsById = mod.Screenshots.ToDictionary(screenshot => screenshot.Id);
        for (var index = 0; index < ids.Length; index++)
        {
            screenshotsById[ids[index]].SortOrder = index;
        }

        await db.SaveChangesAsync(cancellationToken);
        var updated = await LoadModAsync(db, slug, cancellationToken);
        return Results.Ok(ToDetail(updated!));
    }

    private static async Task<IResult> AddVersionAsync(
        string slug,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        if (!context.Request.HasFormContentType)
        {
            return ApiErrors.UnsupportedMediaType("Version uploads must use multipart/form-data.");
        }

        IFormCollection form;
        try
        {
            form = await context.Request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException)
        {
            return ApiErrors.BadRequest("The multipart upload could not be read.");
        }

        var mod = await db.Mods
            .Include(candidate => candidate.Versions)
            .SingleOrDefaultAsync(candidate => candidate.Slug == slug, cancellationToken);
        if (mod is null)
        {
            return ApiErrors.NotFound("That tome is missing from the library.");
        }

        if (TokenService.GetUserId(context.User) != mod.AuthorId)
        {
            return ApiErrors.Forbidden("Only the tome's author may add a version.");
        }

        var versionName = form["version"].ToString().Trim();
        var file = form.Files.GetFile("file");
        if (file is null || file.Length == 0)
        {
            return ApiErrors.BadRequest("Choose a non-empty mod zip.");
        }

        if (!string.Equals(Path.GetExtension(file.FileName), ".zip", StringComparison.OrdinalIgnoreCase))
        {
            return ApiErrors.BadRequest("Mod files must be .zip archives.");
        }

        if (file.Length > MaxModBytes)
        {
            return ApiErrors.BadRequest("Mod files may not exceed 100 MiB.");
        }

        ModPackageInspection package;
        try
        {
            await using var source = file.OpenReadStream();
            package = await ModPackageInspector.InspectAsync(source, cancellationToken);
        }
        catch (ModPackageValidationException exception)
        {
            return ApiErrors.BadRequest(exception.Message);
        }

        if (versionName.Length == 0)
        {
            versionName = package.ManifestVersion;
        }

        if (!SemanticVersion.TryParse(versionName, out var nextVersion))
        {
            return ApiErrors.BadRequest(
                "Versions must use semantic versioning, for example 1.2.0 or 1.2.0-beta.1.");
        }

        if (!string.Equals(versionName, package.ManifestVersion, StringComparison.Ordinal))
        {
            return ApiErrors.BadRequest(
                "The upload version must exactly match manifest.version.");
        }

        var currentVersion = HighestSemanticVersion(mod.Versions);
        if (nextVersion!.CompareTo(currentVersion) <= 0)
        {
            return ApiErrors.Conflict(
                $"New editions must be newer than v{currentVersion.Value}.");
        }

        if (mod.LauncherModId is null)
        {
            if (await db.Mods.AnyAsync(
                    candidate => candidate.Id != mod.Id &&
                                 candidate.LauncherModId == package.LauncherModId,
                    cancellationToken))
            {
                return ApiErrors.Conflict(
                    $"A website mod already uses manifest.id '{package.LauncherModId}'.");
            }

            mod.LauncherModId = package.LauncherModId;
        }
        else if (!string.Equals(
                     mod.LauncherModId,
                     package.LauncherModId,
                     StringComparison.Ordinal))
        {
            return ApiErrors.BadRequest(
                $"Every version of this website mod must use manifest.id '{mod.LauncherModId}'.");
        }

        var now = DateTime.UtcNow;
        var version = new ModVersion
        {
            Version = versionName,
            ManifestVersion = package.ManifestVersion,
            PackageSha256 = package.PackageSha256,
            ContentSha256 = package.ContentSha256,
            Changelog = form["changelog"].ToString(),
            FileSize = file.Length,
            CreatedAtUtc = now
        };

        try
        {
            await using var source = file.OpenReadStream();
            version.FileName = await storage.SaveModFileAsync(
                mod.Slug,
                versionName,
                source,
                cancellationToken);
            mod.Versions.Add(version);
            mod.UpdatedAtUtc = now;
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

        var updated = await LoadModAsync(db, slug, cancellationToken);
        return Results.Json(ToDetail(updated!), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> PatchAsync(
        string slug,
        PatchModRequest request,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var mod = await db.Mods
            .Include(candidate => candidate.Tags)
            .SingleOrDefaultAsync(candidate => candidate.Slug == slug, cancellationToken);
        if (mod is null)
        {
            return ApiErrors.NotFound("That tome is missing from the library.");
        }

        if (TokenService.GetUserId(context.User) != mod.AuthorId)
        {
            return ApiErrors.Forbidden("Only the tome's author may revise it.");
        }

        var name = request.Name?.Trim();
        var summary = request.Summary?.Trim();
        if (name is not null && (name.Length < 3 || name.Length > 60))
        {
            return ApiErrors.BadRequest("Mod names must be 3–60 characters.");
        }

        if (summary is not null && summary.Length > ModPublishingService.MaxSummaryLength)
        {
            return ApiErrors.BadRequest(
                $"Summaries may not exceed {ModPublishingService.MaxSummaryLength} characters.");
        }

        if (request.Description is not null && request.Description.Length > 10_000)
        {
            return ApiErrors.BadRequest("Descriptions may not exceed 10,000 characters.");
        }

        string[]? tags = null;
        if (request.Tags is not null)
        {
            var tagValidationError = ParseTags(request.Tags, out tags);
            if (tagValidationError is not null)
            {
                return ApiErrors.BadRequest(tagValidationError);
            }
        }

        if (name is not null)
        {
            mod.Name = name;
        }

        if (summary is not null)
        {
            mod.Summary = summary;
        }

        if (request.Description is not null)
        {
            mod.Description = request.Description;
        }

        if (tags is not null)
        {
            mod.Tags.Clear();
            foreach (var tag in tags)
            {
                mod.Tags.Add(new ModTag { Name = tag });
            }
        }

        mod.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var updated = await LoadModAsync(db, slug, cancellationToken);
        return Results.Ok(ToDetail(updated!));
    }

    private static async Task<IResult> DeleteAsync(
        string slug,
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        var mod = await db.Mods
            .Include(candidate => candidate.Screenshots)
            .SingleOrDefaultAsync(candidate => candidate.Slug == slug, cancellationToken);
        if (mod is null)
        {
            return ApiErrors.NotFound("That tome is missing from the library.");
        }

        if (TokenService.GetUserId(context.User) != mod.AuthorId)
        {
            return ApiErrors.Forbidden("Only the tome's author may remove it.");
        }

        var screenshotNames = mod.Screenshots.Select(screenshot => screenshot.FileName).ToArray();
        await db.BoneyardDrafts
            .Where(draft => draft.PublishedModId == mod.Id)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(draft => draft.PublishedModId, (int?)null),
                cancellationToken);
        db.Mods.Remove(mod);
        await db.SaveChangesAsync(cancellationToken);

        storage.DeleteModDirectory(mod.Slug);
        foreach (var screenshotName in screenshotNames)
        {
            storage.DeleteScreenshot(screenshotName);
        }

        return Results.NoContent();
    }

    private static Task<IResult> DownloadLatestAsync(
        string slug,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken) =>
        DownloadAsync(slug, null, db, storage, cancellationToken);

    private static Task<IResult> DownloadVersionAsync(
        string slug,
        int versionId,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken) =>
        DownloadAsync(slug, versionId, db, storage, cancellationToken);

    private static async Task<IResult> DownloadAsync(
        string slug,
        int? versionId,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        var mod = await db.Mods
            .Include(candidate => candidate.Versions)
            .SingleOrDefaultAsync(candidate => candidate.Slug == slug, cancellationToken);
        if (mod is null)
        {
            return ApiErrors.NotFound("That tome is missing from the library.");
        }

        var version = versionId is null
            ? LatestVersion(mod)
            : mod.Versions.SingleOrDefault(candidate => candidate.Id == versionId.Value);
        if (version is null)
        {
            return ApiErrors.NotFound("That version is missing from the library.");
        }

        var path = storage.GetModFilePath(version.FileName);
        if (!File.Exists(path))
        {
            return ApiErrors.NotFound("The archive for that version is missing.");
        }

        version.Downloads++;
        mod.Downloads++;
        db.ModDownloadEvents.Add(new ModDownloadEvent
        {
            ModId = mod.Id,
            DownloadedAtUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);

        var pruneBefore = DateTime.UtcNow.AddDays(-100);
        await db.ModDownloadEvents
            .Where(e => e.DownloadedAtUtc < pruneBefore)
            .ExecuteDeleteAsync(cancellationToken);

        return Results.File(
            path,
            contentType: "application/zip",
            fileDownloadName: $"{mod.Slug}-{version.Version}.zip",
            enableRangeProcessing: true);
    }

    internal static async Task<Mod?> LoadModAsync(
        AppDb db,
        string slug,
        CancellationToken cancellationToken) =>
        await db.Mods.AsNoTracking()
            .Include(mod => mod.Author)
            .Include(mod => mod.Tags)
            .Include(mod => mod.Versions)
            .Include(mod => mod.Screenshots)
            .AsSplitQuery()
            .SingleOrDefaultAsync(mod => mod.Slug == slug, cancellationToken);

    private static object ToItem(Mod mod, int? recentDownloads = null)
    {
        var latest = LatestVersion(mod);
        var thumbnail = mod.Screenshots.OrderBy(screenshot => screenshot.SortOrder).FirstOrDefault();
        return new
        {
            mod.Id,
            mod.Slug,
            mod.Name,
            mod.Summary,
            mod.LauncherModId,
            tags = mod.Tags.Select(tag => tag.Name).OrderBy(name => name, StringComparer.Ordinal).ToArray(),
            author = new { mod.Author.Id, mod.Author.Username, mod.Author.School },
            latestVersion = latest?.Version,
            mod.Downloads,
            recentDownloads,
            thumbnailUrl = thumbnail is null ? null : ScreenshotUrl(thumbnail.FileName),
            mod.CreatedAtUtc,
            mod.UpdatedAtUtc
        };
    }

    internal static object ToDetail(Mod mod)
    {
        var latest = LatestVersion(mod);
        var thumbnail = mod.Screenshots.OrderBy(screenshot => screenshot.SortOrder).FirstOrDefault();
        return new
        {
            mod.Id,
            mod.Slug,
            mod.Name,
            mod.Summary,
            mod.LauncherModId,
            tags = mod.Tags.Select(tag => tag.Name).OrderBy(name => name, StringComparer.Ordinal).ToArray(),
            author = new { mod.Author.Id, mod.Author.Username, mod.Author.School },
            latestVersion = latest?.Version,
            mod.Downloads,
            thumbnailUrl = thumbnail is null ? null : ScreenshotUrl(thumbnail.FileName),
            mod.CreatedAtUtc,
            mod.UpdatedAtUtc,
            mod.Description,
            screenshots = mod.Screenshots
                .OrderBy(screenshot => screenshot.SortOrder)
                .Select(screenshot => new
                {
                    screenshot.Id,
                    url = ScreenshotUrl(screenshot.FileName),
                    screenshot.SortOrder
                })
                .ToArray(),
            versions = mod.Versions
                .OrderByDescending(version => version.CreatedAtUtc)
                .ThenByDescending(version => version.Id)
                .Select(version => new
                {
                    version.Id,
                    version.Version,
                    version.ManifestVersion,
                    version.PackageSha256,
                    version.ContentSha256,
                    version.Changelog,
                    version.FileSize,
                    version.Downloads,
                    version.CreatedAtUtc
                })
                .ToArray()
        };
    }

    private static object ToComment(ModComment comment) => new
    {
        comment.Id,
        comment.Body,
        comment.CreatedAtUtc,
        author = new { comment.Author.Id, comment.Author.Username, comment.Author.School }
    };

    private static ModVersion? LatestVersion(Mod mod) =>
        mod.Versions
            .OrderByDescending(version => version.CreatedAtUtc)
            .ThenByDescending(version => version.Id)
            .FirstOrDefault();

    private static ModVersion? HighestDownloadableVersion(IEnumerable<ModVersion> versions)
    {
        ModVersion? highest = null;
        SemanticVersion? highestVersion = null;
        foreach (var version in versions)
        {
            if (version.ManifestVersion is null ||
                version.PackageSha256 is null ||
                version.ContentSha256 is null)
            {
                continue;
            }
            if (!SemanticVersion.TryParse(version.ManifestVersion, out var parsed))
            {
                throw new InvalidOperationException(
                    $"Stored mod version is not semantic: {version.ManifestVersion}");
            }
            if (highestVersion is null || parsed!.CompareTo(highestVersion) > 0)
            {
                highest = version;
                highestVersion = parsed;
            }
        }

        return highest;
    }

    private static SemanticVersion HighestSemanticVersion(IEnumerable<ModVersion> versions)
    {
        SemanticVersion? highest = null;
        foreach (var version in versions)
        {
            if (!SemanticVersion.TryParse(version.Version, out var parsed))
            {
                throw new InvalidOperationException(
                    $"Stored mod version is not semantic: {version.Version}");
            }

            if (highest is null || parsed!.CompareTo(highest) > 0)
            {
                highest = parsed;
            }
        }

        return highest ?? throw new InvalidOperationException(
            "A published mod has no versions.");
    }

    private static string ScreenshotUrl(string fileName) => $"/uploads/screenshots/{fileName}";

    private static string? ParseTags(string rawTags, out string[] tags) =>
        ParseTags(rawTags.Split(','), out tags);

    private static string? ParseTags(IEnumerable<string> rawTags, out string[] tags)
    {
        tags = rawTags
            .Select(NormalizeTag)
            .Where(tag => tag.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        if (tags.Length > MaxTagsPerMod)
        {
            return TooManyTagsError;
        }

        return tags.Any(tag => !IsValidTag(tag)) ? InvalidTagError : null;
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

    private static string? ValidateModFields(
        string name,
        string summary,
        string description)
    {
        if (name.Length < 3 || name.Length > 60)
        {
            return "Mod names must be 3–60 characters.";
        }

        if (summary.Length > ModPublishingService.MaxSummaryLength)
        {
            return $"Summaries may not exceed {ModPublishingService.MaxSummaryLength} characters.";
        }

        if (description.Length > 10_000)
        {
            return "Descriptions may not exceed 10,000 characters.";
        }

        return null;
    }

    private static string? ScreenshotExtension(string fileName)
    {
        var extension = Path.GetExtension(fileName);
        if (string.Equals(extension, ".png", StringComparison.OrdinalIgnoreCase))
        {
            return "png";
        }

        return string.Equals(extension, ".jpg", StringComparison.OrdinalIgnoreCase) ? "jpg" : null;
    }

    private static string? ValidateScreenshots(IEnumerable<IFormFile> screenshots)
    {
        foreach (var screenshot in screenshots)
        {
            if (screenshot.Length == 0)
            {
                return "Choose non-empty screenshots.";
            }

            if (screenshot.Length > MaxScreenshotBytes)
            {
                return "Each screenshot may not exceed 2 MiB.";
            }

            if (ScreenshotExtension(screenshot.FileName) is null)
            {
                return "Screenshots must be .png or .jpg files.";
            }
        }

        return null;
    }

    private static int ParseInt(string value, int fallback) =>
        int.TryParse(value, out var parsed) ? parsed : fallback;

    private static bool IsValidLauncherModId(string? value) =>
        value is { Length: >= 1 and <= 128 } &&
        char.IsAsciiLetterOrDigit(value[0]) &&
        value.All(character => char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-');

    private static bool IsSha256(string? value) =>
        value is { Length: 64 } && value.All(character =>
            character is >= '0' and <= '9' or >= 'a' and <= 'f' or >= 'A' and <= 'F');

    public sealed record PatchModRequest(
        string? Name,
        string? Summary,
        string? Description,
        string[]? Tags);

    public sealed record ReorderScreenshotsRequest(int[]? Ids);

    public sealed record CommentRequest(string? Body);

    public sealed record ResolveModsRequest(ResolveModRequest[]? Mods);

    public sealed record ResolveModRequest(string? Id, string? Version, string? ContentSha256);

    public sealed record UpdateModsRequest(InstalledModRequest[]? Mods);

    public sealed record InstalledModRequest(string? Id, string? Version);
}
