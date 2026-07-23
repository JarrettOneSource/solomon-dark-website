using System.IO.Compression;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class DiagnosticLogEndpoints
{
    private const long MaxArchiveBytes = 128L * 1024 * 1024;
    private const long UploadRequestLimit = MaxArchiveBytes + (2L * 1024 * 1024);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/diagnostics/logs", SubmitAsync)
            .RequireAuthorization("crash-submitter")
            .RequireRateLimiting("diagnostic-logs")
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
                "Diagnostic logs must use multipart/form-data.");
        }

        IFormCollection form;
        try
        {
            form = await context.Request.ReadFormAsync(cancellationToken);
        }
        catch (InvalidDataException)
        {
            return ApiErrors.BadRequest("The diagnostic-log upload could not be read.");
        }

        DiagnosticLogMetadata? metadata;
        try
        {
            metadata = JsonSerializer.Deserialize<DiagnosticLogMetadata>(
                form["metadata"].ToString(),
                JsonOptions);
        }
        catch (JsonException)
        {
            return ApiErrors.BadRequest("Diagnostic-log metadata is not valid JSON.");
        }

        var metadataError = ValidateMetadata(metadata);
        if (metadataError is not null)
        {
            return ApiErrors.BadRequest(metadataError);
        }

        var archive = form.Files.GetFile("archive");
        if (archive is null || archive.Length == 0)
        {
            return ApiErrors.BadRequest("Choose a non-empty diagnostic-log archive.");
        }
        if (archive.Length > MaxArchiveBytes)
        {
            return ApiErrors.BadRequest("Diagnostic-log archives may not exceed 128 MiB.");
        }
        if (!string.Equals(
                archive.ContentType,
                "application/zip",
                StringComparison.OrdinalIgnoreCase))
        {
            return ApiErrors.UnsupportedMediaType("Diagnostic logs must be ZIP archives.");
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
                "The diagnostic log has no authenticated website or Steam identity.");
        }

        var clientLogId = metadata!.ClientLogId.ToString("D");
        var existing = await db.DiagnosticLogs.AsNoTracking().SingleOrDefaultAsync(
            log => log.ClientLogId == clientLogId,
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
                : ApiErrors.Conflict("That diagnostic-log id has already been submitted.");
        }

        var submittedAtUtc = DateTime.UtcNow;
        var publicId = Guid.NewGuid().ToString("D");
        StoredCrashReportFile? stored = null;
        try
        {
            await using var archiveStream = archive.OpenReadStream();
            stored = await storage.SaveDiagnosticLogAsync(
                submittedAtUtc,
                publicId,
                archiveStream,
                cancellationToken);
            if (!IsReadableArchive(storage.GetDiagnosticLogPath(stored.RelativePath)))
            {
                storage.DeleteDiagnosticLog(stored.RelativePath);
                stored = null;
                return ApiErrors.BadRequest(
                    "The diagnostic-log upload is not a readable ZIP archive.");
            }
            var log = new DiagnosticLog
            {
                PublicId = publicId,
                ClientLogId = clientLogId,
                SubmitterUserId = submitter?.Id,
                SubmitterSteamId = steamSessionId ?? submitter?.SteamId,
                SubmittedAtUtc = submittedAtUtc,
                CapturedAtUtc = metadata.CapturedAtUtc.UtcDateTime,
                LauncherVersion = metadata.LauncherVersion ?? string.Empty,
                LaunchToken = metadata.LaunchToken,
                MetadataJson = JsonSerializer.Serialize(metadata, JsonOptions),
                ArchivePath = stored.RelativePath,
                ArchiveSize = stored.Size,
                ArchiveSha256 = stored.Sha256
            };
            db.DiagnosticLogs.Add(log);
            await db.SaveChangesAsync(cancellationToken);
            return Results.Json(ToReceipt(log), statusCode: StatusCodes.Status201Created);
        }
        catch
        {
            if (stored is not null)
            {
                storage.DeleteDiagnosticLog(stored.RelativePath);
            }
            throw;
        }
    }

    private static string? ValidateMetadata(DiagnosticLogMetadata? metadata)
    {
        if (metadata is null || metadata.ClientLogId == Guid.Empty)
        {
            return "Diagnostic-log metadata must include a clientLogId.";
        }
        if (metadata.CapturedAtUtc == default ||
            metadata.CapturedAtUtc > DateTimeOffset.UtcNow.AddMinutes(5))
        {
            return "Diagnostic-log timestamps are invalid.";
        }
        if (metadata.LaunchToken is not null &&
            (metadata.LaunchToken.Length != 32 ||
             metadata.LaunchToken.Any(character =>
                 character is not (>= '0' and <= '9') and
                 not (>= 'a' and <= 'f'))))
        {
            return "Diagnostic-log metadata has an invalid launchToken.";
        }
        if (!IsShortValue(metadata.LauncherVersion, 64) ||
            !IsShortValue(metadata.OperatingSystem, 256) ||
            !IsShortValue(metadata.ProcessArchitecture, 32) ||
            !IsShortValue(metadata.DotnetRuntime, 128))
        {
            return "Diagnostic-log version or runtime metadata is invalid.";
        }
        if (metadata.Artifacts is not { Length: <= 64 })
        {
            return "Diagnostic-log artifact counts are invalid.";
        }
        return null;
    }

    private static bool IsShortValue(string? value, int maximumLength) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= maximumLength;

    private static bool IsReadableArchive(string path)
    {
        try
        {
            using var archive = ZipFile.OpenRead(path);
            return archive.Entries.Count > 0;
        }
        catch (InvalidDataException)
        {
            return false;
        }
    }

    private static object ToReceipt(DiagnosticLog log) => new
    {
        logId = log.PublicId,
        submittedAtUtc = new DateTimeOffset(log.SubmittedAtUtc, TimeSpan.Zero)
    };

    private sealed record DiagnosticLogMetadata(
        Guid ClientLogId,
        DateTimeOffset CapturedAtUtc,
        string? LauncherVersion,
        string? OperatingSystem,
        string? ProcessArchitecture,
        string? DotnetRuntime,
        string? LaunchToken,
        string[]? Artifacts);
}
