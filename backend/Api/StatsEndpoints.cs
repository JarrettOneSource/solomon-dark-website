using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class StatsEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/stats", GetAsync);
    }

    private static async Task<IResult> GetAsync(
        AppDb db,
        GameSessionProvisioner provisioner,
        CancellationToken cancellationToken)
    {
        SharedHubStats sharedHub;
        try
        {
            sharedHub = await provisioner.GetSharedHubStatsAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is
            GameSessionUnavailableException or HttpRequestException or OperationCanceledException)
        {
            sharedHub = new SharedHubStats(0, 0, 0);
        }
        var matchesLive = sharedHub.Parties;
        var wizardsOnline = sharedHub.Players;
        var tomes = await db.Mods.CountAsync(cancellationToken);
        var savesSynced = await db.WebGameSaves.CountAsync(cancellationToken);
        var enrolled = await db.Users.CountAsync(cancellationToken);
        var downloadsTotal = await db.Mods
            .SumAsync(mod => (long?)mod.Downloads, cancellationToken) ?? 0;

        return Results.Ok(new
        {
            matchesLive,
            wizardsOnline,
            tomes,
            savesSynced,
            enrolled,
            downloadsTotal
        });
    }
}
