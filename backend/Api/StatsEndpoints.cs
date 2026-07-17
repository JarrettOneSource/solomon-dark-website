using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;

namespace SolomonDarkRevived.Api;

public static class StatsEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/stats", GetAsync);
    }

    private static async Task<IResult> GetAsync(
        AppDb db,
        CancellationToken cancellationToken)
    {
        var liveCutoff = DateTime.UtcNow.AddSeconds(-120);
        var matchesLive = await db.Matches.CountAsync(
            match => match.LastSeenUtc >= liveCutoff,
            cancellationToken);
        var wizardsOnline = await db.Matches
            .Where(match => match.LastSeenUtc >= liveCutoff)
            .SumAsync(match => (int?)match.Players, cancellationToken) ?? 0;
        var tomes = await db.Mods.CountAsync(cancellationToken);
        var savesSynced = await db.CloudSaves.CountAsync(cancellationToken);
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
