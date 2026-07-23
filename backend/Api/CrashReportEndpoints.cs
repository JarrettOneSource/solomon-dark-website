using System.IO.Compression;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class CrashReportEndpoints
{
    private const long MaxArchiveBytes = 128L * 1024 * 1024;
    private const long UploadRequestLimit = MaxArchiveBytes + (2L * 1024 * 1024);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/crash-reports", SubmitAsync)
            .RequireAuthorization("crash-submitter")
            .RequireRateLimiting("crash-reports")
            .WithMetadata(new RequestFormLimitsAttribute
            {
                MultipartBodyLengthLimit = UploadRequestLimit
            })
            .WithMetadata(new RequestSizeLimitAttribute(UploadRequestLimit));
    }

    private static async Task<IResult> SubmitAsync(
        HttpContext context,
        AppDb db,
        StorageService storage,
        CancellationToken cancellationToken)
    {
        if (!context.Request.HasFormContentType)
        {
            return ApiErrors.UnsupportedMediaType(
                "Crash reports must use multipart/form-data.");
        }

        IFormCollection form;
        try
        {
            form = await context.Request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException)
        {
            return ApiErrors.BadRequest("The crash-report upload could not be read.");
        }

        CrashReportMetadata? metadata;
        try
        {
            metadata = JsonSerializer.Deserialize<CrashReportMetadata>(
                form["metadata"].ToString(),
                JsonOptions);
        }
        catch (JsonException)
        {
            return ApiErrors.BadRequest("Crash-report metadata is not valid JSON.");
        }

        var metadataError = ValidateMetadata(metadata);
        if (metadataError is not null)
        {
            return ApiErrors.BadRequest(metadataError);
        }

        var archive = form.Files.GetFile("archive");
        if (archive is null || archive.Length == 0)
        {
            return ApiErrors.BadRequest("Choose a non-empty crash-report archive.");
        }
        if (archive.Length > MaxArchiveBytes)
        {
            return ApiErrors.BadRequest("Crash-report archives may not exceed 128 MiB.");
        }
        if (!string.Equals(
                archive.ContentType,
                "application/zip",
                StringComparison.OrdinalIgnoreCase))
        {
            return ApiErrors.UnsupportedMediaType("Crash reports must be ZIP archives.");
        }

        var userId = TokenService.GetUserId(context.User);
        var steamSessionId = TokenService.GetSteamSessionId(context.User);
        User? submitter = null;
        if (userId is { } accountId)
        {
            submitter = await db.Users.SingleOrDefaultAsync(
                user => user.Id == accountId,
                cancellationToken);
        }
        else if (steamSessionId is not null)
        {
            submitter = await db.Users.SingleOrDefaultAsync(
                user => user.SteamId == steamSessionId,
                cancellationToken);
        }
        if (submitter is null && steamSessionId is null)
        {
            return ApiErrors.Unauthorized(
                "The crash report has no authenticated website or Steam identity.");
        }

        var clientReportId = metadata!.ClientReportId.ToString("D");
        var existing = await db.CrashReports.AsNoTracking().SingleOrDefaultAsync(
            report => report.ClientReportId == clientReportId,
            cancellationToken);
        if (existing is not null)
        {
            var sameSubmitter = existing.SubmitterUserId == submitter?.Id &&
                                string.Equals(
                                    existing.SubmitterSteamId,
                                    steamSessionId ?? submitter?.SteamId,
                                    StringComparison.Ordinal);
            return sameSubmitter
                ? Results.Ok(ToReceipt(existing))
                : ApiErrors.Conflict("That crash-report id has already been submitted.");
        }

        var submittedAtUtc = DateTime.UtcNow;
        var publicId = Guid.NewGuid().ToString("D");
        StoredCrashReportFile? stored = null;
        try
        {
            await using var archiveStream = archive.OpenReadStream();
            stored = await storage.SaveCrashReportAsync(
                submittedAtUtc,
                publicId,
                archiveStream,
                cancellationToken);
            if (!IsValidArchive(
                    storage.GetCrashReportPath(stored.RelativePath),
                    metadata.Artifacts))
            {
                storage.DeleteCrashReport(stored.RelativePath);
                stored = null;
                return ApiErrors.BadRequest(
                    "The crash-report ZIP does not match its artifact manifest.");
            }
            var report = new CrashReport
            {
                PublicId = publicId,
                ClientReportId = clientReportId,
                SubmitterUserId = submitter?.Id,
                SubmitterSteamId = steamSessionId ?? submitter?.SteamId,
                SubmittedAtUtc = submittedAtUtc,
                CrashedAtUtc = metadata.CrashedAtUtc.UtcDateTime,
                LaunchToken = metadata.LaunchToken,
                ExitCode = metadata.ExitCode,
                LauncherVersion = metadata.LauncherVersion,
                LoaderVersion = metadata.LoaderVersion,
                GameVersion = metadata.GameVersion,
                RuntimeProfile = metadata.RuntimeProfile,
                EnabledModsJson = JsonSerializer.Serialize(metadata.EnabledMods, JsonOptions),
                MetadataJson = JsonSerializer.Serialize(metadata, JsonOptions),
                HasCrashLog = metadata.HasCrashLog,
                MinidumpCount = metadata.MinidumpCount,
                ArchivePath = stored.RelativePath,
                ArchiveSize = stored.Size,
                ArchiveSha256 = stored.Sha256
            };
            db.CrashReports.Add(report);
            await db.SaveChangesAsync(cancellationToken);
            return Results.Json(ToReceipt(report), statusCode: StatusCodes.Status201Created);
        }
        catch
        {
            if (stored is not null)
            {
                storage.DeleteCrashReport(stored.RelativePath);
            }
            throw;
        }
    }

    private static string? ValidateMetadata(CrashReportMetadata? metadata)
    {
        if (metadata is null || metadata.ClientReportId == Guid.Empty)
        {
            return "Crash-report metadata must include a clientReportId.";
        }
        if (metadata.LaunchToken.Length != 32 ||
            metadata.LaunchToken.Any(character =>
                character is not (>= '0' and <= '9') and
                not (>= 'a' and <= 'f')))
        {
            return "Crash-report metadata has an invalid launchToken.";
        }
        if (metadata.StartedAtUtc == default || metadata.CrashedAtUtc == default ||
            metadata.StartedAtUtc > metadata.CrashedAtUtc.AddMinutes(5))
        {
            return "Crash-report timestamps are invalid.";
        }
        if (!IsShortValue(metadata.LauncherVersion, 64) ||
            !IsShortValue(metadata.LoaderVersion, 64) ||
            !IsShortValue(metadata.GameVersion, 32) ||
            !IsShortValue(metadata.RuntimeProfile, 64) ||
            !IsShortValue(metadata.OperatingSystem, 256) ||
            !IsShortValue(metadata.ProcessArchitecture, 32) ||
            !IsShortValue(metadata.DotnetRuntime, 128))
        {
            return "Crash-report version or runtime metadata is invalid.";
        }
        if (metadata.MinidumpCount is < 0 or > 16 ||
            metadata.EnabledMods is null or { Length: > 128 } ||
            metadata.Artifacts is null or { Length: > 32 })
        {
            return "Crash-report artifact or mod counts are invalid.";
        }
        if (metadata.EnabledMods.Any(mod =>
                mod is null ||
                !IsShortValue(mod.Id, 128) ||
                !IsShortValue(mod.Version, 64)))
        {
            return "Crash-report mod metadata is invalid.";
        }
        if (metadata.Artifacts.Any(path => !IsArchiveEntryName(path)))
        {
            return "Crash-report artifact metadata is invalid.";
        }
        return null;
    }

    private static bool IsShortValue(string? value, int maxLength) =>
        value is { Length: > 0 } &&
        value.Length <= maxLength &&
        value.All(character => !char.IsControl(character));

    private static bool IsArchiveEntryName(string? value) =>
        IsShortValue(value, 256) &&
        !value!.StartsWith('/') &&
        !value.Contains('\\') &&
        !value.Split('/').Contains("..");

    private static bool IsValidArchive(
        string archivePath,
        IReadOnlyCollection<string> expectedArtifacts)
    {
        try
        {
            using var stream = File.OpenRead(archivePath);
            using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
            if (archive.Entries.Count != expectedArtifacts.Count + 1)
            {
                return false;
            }

            var names = new HashSet<string>(StringComparer.Ordinal);
            long totalUncompressedSize = 0;
            foreach (var entry in archive.Entries)
            {
                if (!IsArchiveEntryName(entry.FullName) || !names.Add(entry.FullName))
                {
                    return false;
                }
                totalUncompressedSize = checked(totalUncompressedSize + entry.Length);
            }

            return totalUncompressedSize <= 512L * 1024 * 1024 &&
                   names.Contains("report.json") &&
                   expectedArtifacts.All(names.Contains);
        }
        catch (Exception exception) when (exception is InvalidDataException or
                                          IOException or
                                          OverflowException)
        {
            return false;
        }
    }

    private static object ToReceipt(CrashReport report) => new
    {
        reportId = report.PublicId,
        submittedAtUtc = report.SubmittedAtUtc
    };

    private sealed record CrashReportMetadata(
        Guid ClientReportId,
        string LaunchToken,
        DateTimeOffset StartedAtUtc,
        DateTimeOffset CrashedAtUtc,
        int? ExitCode,
        string LauncherVersion,
        string LoaderVersion,
        string GameVersion,
        string RuntimeProfile,
        string OperatingSystem,
        string ProcessArchitecture,
        string DotnetRuntime,
        CrashReportMod[] EnabledMods,
        bool HasCrashLog,
        int MinidumpCount,
        string[] Artifacts);

    private sealed record CrashReportMod(string Id, string Version);
}
