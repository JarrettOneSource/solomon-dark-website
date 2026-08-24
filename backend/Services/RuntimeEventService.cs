using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;

namespace SolomonDarkRevived.Services;

public sealed class RuntimeEventService(AppDb db)
{
    public static readonly TimeSpan Retention = TimeSpan.FromMinutes(30);
    public const int MaximumRows = 2_000;
    public const int MaximumDetailsBytes = 12 * 1024;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task AppendAsync(
        string source,
        string component,
        string eventName,
        string message,
        object details,
        DateTime? occurredAtUtc = null,
        CancellationToken cancellationToken = default)
    {
        var detailsJson = details is JsonElement jsonElement
            ? jsonElement.GetRawText()
            : JsonSerializer.Serialize(details, JsonOptions);
        if (Encoding.UTF8.GetByteCount(detailsJson) > MaximumDetailsBytes)
        {
            throw new ArgumentException("Runtime event details are too large.", nameof(details));
        }

        var occurred = DateTime.SpecifyKind(occurredAtUtc ?? DateTime.UtcNow, DateTimeKind.Utc);
        db.RuntimeEvents.Add(new RuntimeEvent
        {
            Source = source,
            Component = component,
            EventName = eventName,
            Message = message,
            DetailsJson = detailsJson,
            OccurredAtUtc = occurred,
            ExpiresAtUtc = occurred + Retention
        });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class RuntimeEventCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<RuntimeEventCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await PruneAsync(stoppingToken);
        using var timer = new PeriodicTimer(CleanupInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await PruneAsync(stoppingToken);
        }
    }

    private async Task PruneAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDb>();
            await db.RuntimeEvents
                .Where(runtimeEvent => runtimeEvent.ExpiresAtUtc <= DateTime.UtcNow)
                .ExecuteDeleteAsync(cancellationToken);
            var oldestRetainedId = await db.RuntimeEvents
                .OrderByDescending(runtimeEvent => runtimeEvent.Id)
                .Skip(RuntimeEventService.MaximumRows - 1)
                .Select(runtimeEvent => runtimeEvent.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (oldestRetainedId > 0)
            {
                await db.RuntimeEvents
                    .Where(runtimeEvent => runtimeEvent.Id < oldestRetainedId)
                    .ExecuteDeleteAsync(cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Expired runtime events could not be pruned.");
        }
    }
}

public sealed class WebsiteVisitEventMiddleware(
    RequestDelegate next,
    ILogger<WebsiteVisitEventMiddleware> logger)
{
    private static readonly string[] AutomatedUserAgentMarkers =
    [
        "bot",
        "crawler",
        "headless",
        "monitor",
        "spider",
        "uptime",
        "wget",
        "curl"
    ];

    public async Task InvokeAsync(HttpContext context, RuntimeEventService events)
    {
        if (!IsDocumentRequest(context.Request))
        {
            await next(context);
            return;
        }

        var started = Stopwatch.GetTimestamp();
        var originalPath = context.Request.Path.Value ?? "/";
        await next(context);
        if (context.Response.StatusCode is < 200 or >= 400)
        {
            return;
        }

        var request = context.Request;
        var userAgent = BoundedHeader(request.Headers.UserAgent.ToString(), 320);
        try
        {
            await events.AppendAsync(
                "website",
                "website",
                "website.visited",
                "A browser visited the Solomon Dark website.",
                new Dictionary<string, object?>
                {
                    ["acceptLanguage"] = BoundedHeader(
                        request.Headers.AcceptLanguage.ToString(),
                        160),
                    ["durationMs"] = Math.Max(
                        0,
                        Math.Round(Stopwatch.GetElapsedTime(started).TotalMilliseconds)),
                    ["host"] = request.Host.Value,
                    ["likelyBot"] = IsLikelyAutomated(userAgent),
                    ["path"] = originalPath,
                    ["referer"] = BoundedHeader(request.Headers.Referer.ToString(), 320),
                    ["remoteAddress"] = context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    ["requestId"] = context.TraceIdentifier,
                    ["statusCode"] = context.Response.StatusCode,
                    ["userAgent"] = userAgent
                },
                cancellationToken: context.RequestAborted);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Website visit event {RequestId} could not be retained.",
                context.TraceIdentifier);
        }
    }

    private static bool IsDocumentRequest(HttpRequest request)
    {
        if (!HttpMethods.IsGet(request.Method))
        {
            return false;
        }

        var destination = request.Headers["Sec-Fetch-Dest"].ToString();
        if (!string.IsNullOrEmpty(destination) &&
            !string.Equals(destination, "document", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return request.GetTypedHeaders().Accept?.Any(mediaType =>
            string.Equals(
                mediaType.MediaType.Value,
                "text/html",
                StringComparison.OrdinalIgnoreCase)) == true;
    }

    private static bool IsLikelyAutomated(string userAgent) =>
        AutomatedUserAgentMarkers.Any(marker =>
            userAgent.Contains(marker, StringComparison.OrdinalIgnoreCase));

    private static string BoundedHeader(string value, int maximumLength) =>
        value.Length <= maximumLength ? value : value[..maximumLength];
}
