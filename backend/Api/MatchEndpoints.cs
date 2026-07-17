using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SolomonDarkRevived.Data;
using HttpJsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace SolomonDarkRevived.Api;

public static class MatchEndpoints
{
    private const int LiveSeconds = 120;

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/matches/announce", AnnounceAsync)
            .RequireRateLimiting("match-announcements");
        app.MapDelete("/api/matches/announce", DelistAsync);
        app.MapGet("/api/matches/game", ListForGameAsync);
        app.MapGet("/api/matches/events", StreamEventsAsync);
        app.MapGet("/api/matches", ListAsync);
    }

    private static async Task<IResult> AnnounceAsync(
        AnnounceRequest request,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var sessionKey = request.SessionKey?.Trim() ?? string.Empty;
        if (sessionKey.Length is 0 or > 64)
        {
            return ApiErrors.BadRequest("Session keys are required and may not exceed 64 characters.");
        }

        var hostPlayer = request.HostPlayer?.Trim() ?? string.Empty;
        if (hostPlayer.Length is 0 or > 32)
        {
            return ApiErrors.BadRequest("Host player names are required and may not exceed 32 characters.");
        }

        var boneyard = request.Boneyard?.Trim() ?? string.Empty;
        if (boneyard.Length is 0 or > 60)
        {
            return ApiErrors.BadRequest("Boneyard names are required and may not exceed 60 characters.");
        }

        if (request.Players < 0)
        {
            return ApiErrors.BadRequest("Player counts cannot be negative.");
        }

        if (request.MaxPlayers is < 1 or > 64)
        {
            return ApiErrors.BadRequest("Maximum players must be between 1 and 64.");
        }

        var status = request.Status?.Trim() ?? string.Empty;
        if (status is not ("hub" or "session"))
        {
            return ApiErrors.BadRequest("Status must be either 'hub' or 'session'.");
        }

        var now = DateTime.UtcNow;
        await DeleteExpiredMatchesAsync(db, now, cancellationToken);

        var match = await db.Matches.SingleOrDefaultAsync(
            candidate => candidate.SessionKey == sessionKey,
            cancellationToken);
        if (match is null)
        {
            match = new MatchSession
            {
                SessionKey = sessionKey,
                FirstSeenUtc = now
            };
            db.Matches.Add(match);
        }

        match.HostPlayer = hostPlayer;
        match.Boneyard = boneyard;
        match.Players = Math.Min(request.Players, request.MaxPlayers);
        match.MaxPlayers = request.MaxPlayers;
        match.Status = status;
        match.LastSeenUtc = now;
        await db.SaveChangesAsync(cancellationToken);

        return Results.Ok(new { match.Id, expiresInSeconds = LiveSeconds });
    }

    private static async Task<IResult> DelistAsync(
        [FromBody] DelistRequest request,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var sessionKey = request.SessionKey?.Trim() ?? string.Empty;
        if (sessionKey.Length is 0 or > 64)
        {
            return ApiErrors.BadRequest("A valid session key is required to delist a match.");
        }

        await db.Matches
            .Where(match => match.SessionKey == sessionKey)
            .ExecuteDeleteAsync(cancellationToken);

        return Results.NoContent();
    }

    private static async Task<IResult> ListAsync(
        AppDb db,
        CancellationToken cancellationToken)
    {
        var response = await GetListAsync(db, cancellationToken);
        return Results.Ok(response);
    }

    private static async Task<IResult> ListForGameAsync(
        AppDb db,
        CancellationToken cancellationToken)
    {
        await DeleteExpiredMatchesAsync(db, DateTime.UtcNow, cancellationToken);
        var matches = await db.Matches.AsNoTracking()
            .OrderByDescending(match => match.Players)
            .Select(match => new GameMatchItem(
                match.SessionKey,
                match.HostPlayer,
                match.Boneyard,
                match.Players,
                match.MaxPlayers,
                match.Status))
            .ToArrayAsync(cancellationToken);

        return Results.Ok(matches);
    }

    private static async Task StreamEventsAsync(
        HttpContext context,
        AppDb db,
        IOptions<HttpJsonOptions> jsonOptions,
        CancellationToken cancellationToken)
    {
        context.Response.ContentType = "text/event-stream";
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.Headers["X-Accel-Buffering"] = "no";
        context.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        try
        {
            var current = await GetListAsync(db, cancellationToken);
            var fingerprint = CreateFingerprint(current);
            await WriteMatchesEventAsync(
                context.Response,
                current,
                jsonOptions.Value.SerializerOptions,
                cancellationToken);

            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(3));
            var checksSinceKeepalive = 0;
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                var next = await GetListAsync(db, cancellationToken);
                var nextFingerprint = CreateFingerprint(next);
                if (nextFingerprint != fingerprint)
                {
                    fingerprint = nextFingerprint;
                    await WriteMatchesEventAsync(
                        context.Response,
                        next,
                        jsonOptions.Value.SerializerOptions,
                        cancellationToken);
                }

                checksSinceKeepalive++;
                if (checksSinceKeepalive == 5)
                {
                    await context.Response.WriteAsync(": keepalive\n\n", cancellationToken);
                    await context.Response.Body.FlushAsync(cancellationToken);
                    checksSinceKeepalive = 0;
                }
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (IOException)
        {
            // Client disconnects can surface as a broken response stream before cancellation propagates.
        }
    }

    private static async Task<MatchListResponse> GetListAsync(
        AppDb db,
        CancellationToken cancellationToken)
    {
        await DeleteExpiredMatchesAsync(db, DateTime.UtcNow, cancellationToken);
        var items = await db.Matches.AsNoTracking()
            .OrderByDescending(match => match.Players)
            .Select(match => new MatchItem(
                match.Id,
                match.SessionKey,
                match.HostPlayer,
                match.Boneyard,
                match.Players,
                match.MaxPlayers,
                match.Status))
            .ToArrayAsync(cancellationToken);

        return new MatchListResponse(items, items.Sum(match => match.Players));
    }

    private static Task<int> DeleteExpiredMatchesAsync(
        AppDb db,
        DateTime now,
        CancellationToken cancellationToken) =>
        db.Matches
            .Where(match => match.LastSeenUtc < now.AddSeconds(-LiveSeconds))
            .ExecuteDeleteAsync(cancellationToken);

    // Fingerprint the exact payload so status and per-match player changes
    // cannot hide behind an unchanged aggregate player count.
    private static string CreateFingerprint(MatchListResponse matches) =>
        JsonSerializer.Serialize(matches);

    private static async Task WriteMatchesEventAsync(
        HttpResponse response,
        MatchListResponse matches,
        JsonSerializerOptions jsonOptions,
        CancellationToken cancellationToken)
    {
        await response.WriteAsync("event: matches\ndata: ", cancellationToken);
        await JsonSerializer.SerializeAsync(
            response.Body,
            matches,
            jsonOptions,
            cancellationToken);
        await response.WriteAsync("\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    public sealed record AnnounceRequest(
        string? SessionKey,
        string? HostPlayer,
        string? Boneyard,
        int Players,
        int MaxPlayers,
        string? Status);

    public sealed record DelistRequest(string? SessionKey);

    private sealed record MatchListResponse(
        MatchItem[] Items,
        int PlayerCount);

    private sealed record MatchItem(
        int Id,
        string SessionKey,
        string HostPlayer,
        string Boneyard,
        int Players,
        int MaxPlayers,
        string Status);

    private sealed record GameMatchItem(
        string SessionKey,
        string HostPlayer,
        string Boneyard,
        int Players,
        int MaxPlayers,
        string Status);
}
