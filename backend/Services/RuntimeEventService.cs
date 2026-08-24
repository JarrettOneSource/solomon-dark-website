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
