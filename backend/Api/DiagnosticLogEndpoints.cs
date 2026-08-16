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
    private const long BrowserGameRequestLimit = 1024L * 1024;
    private const string BrowserGameSubmissionHeader = "X-Solomon-Dark-Diagnostics";
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
        app.MapPost("/api/game/diagnostics", SubmitBrowserGameAsync)
            .AllowAnonymous()
            .RequireRateLimiting("diagnostic-logs")
            .WithMetadata(new RequestSizeLimitAttribute(BrowserGameRequestLimit));
    }

    private static async Task<IResult> SubmitBrowserGameAsync(
        HttpContext context,
        AppDb db,
        StorageService storage,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(
                context.Request.Headers[BrowserGameSubmissionHeader],
                "browser-game",
                StringComparison.Ordinal))
        {
            return ApiErrors.BadRequest("The browser game diagnostic request is invalid.");
        }
        if (context.Request.ContentType?.StartsWith(
                "application/json",
                StringComparison.OrdinalIgnoreCase) != true)
        {
            return ApiErrors.UnsupportedMediaType(
                "Browser game diagnostics must use application/json.");
        }

        BrowserGameDiagnosticReport? report;
        try
        {
            report = await context.Request.ReadFromJsonAsync<BrowserGameDiagnosticReport>(
                JsonOptions,
                cancellationToken);
        }
        catch (JsonException)
        {
            return ApiErrors.BadRequest("The browser game diagnostic report is not valid JSON.");
        }
        catch (BadHttpRequestException)
        {
            return ApiErrors.BadRequest("The browser game diagnostic report could not be read.");
        }

        var validationError = ValidateBrowserGameReport(report);
        if (validationError is not null)
        {
            return ApiErrors.BadRequest(validationError);
        }

        var clientLogId = report!.ClientLogId.ToString("D");
        var existing = await db.DiagnosticLogs.AsNoTracking().SingleOrDefaultAsync(
            log => log.ClientLogId == clientLogId,
            cancellationToken);
        if (existing is not null)
        {
            return existing.LauncherVersion.StartsWith(
                "browser-game/",
                StringComparison.Ordinal)
                ? Results.Ok(ToReceipt(existing))
                : ApiErrors.Conflict("That diagnostic-log id has already been submitted.");
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

        var submittedAtUtc = DateTime.UtcNow;
        var publicId = Guid.NewGuid().ToString("D");
        var logger = loggerFactory.CreateLogger("BrowserGameDiagnostics");
        StoredCrashReportFile? stored = null;
        try
        {
            await using var archiveStream = await CreateBrowserGameArchiveAsync(
                report,
                cancellationToken);
            stored = await storage.SaveDiagnosticLogAsync(
                submittedAtUtc,
                publicId,
                archiveStream,
                cancellationToken);
            var log = new DiagnosticLog
            {
                PublicId = publicId,
                ClientLogId = clientLogId,
                SubmitterUserId = submitter?.Id,
                SubmitterSteamId = steamSessionId ?? submitter?.SteamId,
                SubmittedAtUtc = submittedAtUtc,
                CapturedAtUtc = report.CapturedAtUtc.UtcDateTime,
                LauncherVersion = $"browser-game/{report.ProtocolVersion}",
                LaunchToken = null,
                MetadataJson = JsonSerializer.Serialize(report, JsonOptions),
                ArchivePath = stored.RelativePath,
                ArchiveSize = stored.Size,
                ArchiveSha256 = stored.Sha256
            };
            db.DiagnosticLogs.Add(log);
            await db.SaveChangesAsync(cancellationToken);
            logger.LogInformation(
                "Stored browser game diagnostics {DiagnosticLogId} for session {GameSessionId} after {FailureCode}.",
                publicId,
                report.SessionId ?? "none",
                report.Failure!.Code);
            return Results.Json(ToReceipt(log), statusCode: StatusCodes.Status201Created);
        }
        catch (Exception exception)
        {
            if (stored is not null)
            {
                storage.DeleteDiagnosticLog(stored.RelativePath);
            }
            logger.LogError(
                exception,
                "Browser game diagnostics {DiagnosticLogId} could not be stored.",
                publicId);
            throw;
        }
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

    private static string? ValidateBrowserGameReport(BrowserGameDiagnosticReport? report)
    {
        if (report is null || report.SchemaVersion != 1 || report.ClientLogId == Guid.Empty)
        {
            return "Browser game diagnostics must include a supported schema and clientLogId.";
        }
        var now = DateTimeOffset.UtcNow;
        if (report.CapturedAtUtc == default || report.CapturedAtUtc > now.AddMinutes(5))
        {
            return "Browser game diagnostic timestamps are invalid.";
        }
        if (report.ProtocolVersion is < 1 or > 10_000 ||
            report.DroppedEntries is < 0 or > 1_000_000 ||
            !IsBrowserPageUrl(report.PageUrl) ||
            !IsBrowserText(report.UserAgent, 512) ||
            !IsBrowserSessionId(report.SessionId))
        {
            return "Browser game diagnostic environment metadata is invalid.";
        }
        if (report.Failure is null ||
            !IsBrowserEventName(report.Failure.Code, 64) ||
            !IsBrowserText(report.Failure.Explanation, 512) ||
            !IsOptionalBrowserText(report.Failure.TechnicalDetail, 2_048) ||
            report.Failure.TransportCode is < 1 or > 4_999 ||
            !IsOptionalBrowserText(report.Failure.TransportReason, 512))
        {
            return "Browser game diagnostic failure metadata is invalid.";
        }
        if (report.Entries is not { Length: > 0 and <= 96 })
        {
            return "Browser game diagnostics must contain between 1 and 96 log entries.";
        }
        var earliest = report.CapturedAtUtc.AddDays(-7);
        foreach (var entry in report.Entries)
        {
            if (entry is null ||
                entry.AtUtc < earliest ||
                entry.AtUtc > report.CapturedAtUtc.AddMinutes(5) ||
                entry.Level is not ("error" or "info" or "warning") ||
                !IsBrowserEventName(entry.Event, 96) ||
                !IsBrowserText(entry.Message, 512) ||
                !IsOptionalBrowserText(entry.Detail, 2_048))
            {
                return "Browser game diagnostic log entries are invalid.";
            }
        }
        return null;
    }

    private static async Task<MemoryStream> CreateBrowserGameArchiveAsync(
        BrowserGameDiagnosticReport report,
        CancellationToken cancellationToken)
    {
        var stream = new MemoryStream();
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true))
        {
            var entry = archive.CreateEntry(
                "browser/game-client.json",
                CompressionLevel.Fastest);
            await using var entryStream = entry.Open();
            await JsonSerializer.SerializeAsync(
                entryStream,
                report,
                JsonOptions,
                cancellationToken);
        }
        stream.Position = 0;
        return stream;
    }

    private static bool IsBrowserPageUrl(string? value)
    {
        if (!IsBrowserText(value, 512) ||
            !Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return false;
        }
        return uri.Scheme is "http" or "https" && string.IsNullOrEmpty(uri.UserInfo);
    }

    private static bool IsBrowserSessionId(string? value) =>
        value is null ||
        (value.Length == 32 && value.All(character =>
            char.IsAsciiLetterOrDigit(character) || character is '_' or '-'));

    private static bool IsBrowserEventName(string? value, int maximumLength) =>
        value is { Length: > 0 } &&
        value.Length <= maximumLength &&
        value.All(character =>
            char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-');

    private static bool IsOptionalBrowserText(string? value, int maximumLength) =>
        value is null || IsBrowserText(value, maximumLength, allowEmpty: true);

    private static bool IsBrowserText(
        string? value,
        int maximumLength,
        bool allowEmpty = false) =>
        value is not null &&
        value.Length <= maximumLength &&
        (allowEmpty || value.Length > 0) &&
        value.All(character =>
            !char.IsControl(character) || character is '\r' or '\n' or '\t');

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

    private sealed record BrowserGameDiagnosticReport(
        int SchemaVersion,
        Guid ClientLogId,
        DateTimeOffset CapturedAtUtc,
        int ProtocolVersion,
        string? PageUrl,
        string? SessionId,
        bool Online,
        string? UserAgent,
        int DroppedEntries,
        BrowserGameDiagnosticFailure? Failure,
        BrowserGameDiagnosticEntry[]? Entries);

    private sealed record BrowserGameDiagnosticFailure(
        string? Code,
        string? Explanation,
        string? TechnicalDetail,
        int? TransportCode,
        string? TransportReason,
        bool? TransportWasClean);

    private sealed record BrowserGameDiagnosticEntry(
        DateTimeOffset AtUtc,
        string? Level,
        string? Event,
        string? Message,
        string? Detail);
}
