using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class GameSessionEndpoints
{
    private const string SessionHeader = "X-Solomon-Dark-Session";

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/game/parties", ListPublicPartiesAsync);
        app.MapGet("/api/game/players", ListConnectedPlayersAsync);
        app.MapGet("/api/game/matches", ListActiveMatchesAsync);
        app.MapPost("/api/game/observe", ObserveMatchAsync)
            .RequireRateLimiting("game-observers");
        app.MapPost("/api/game/sessions", ProvisionAsync)
            .RequireRateLimiting("game-sessions");
        app.MapPost("/api/game/hub", EnterHubAsync)
            .RequireRateLimiting("game-sessions");
        app.MapPost("/api/game/join/resolve", ResolvePartyCodeAsync)
            .RequireRateLimiting("party-joins");
        app.MapPost("/api/game/join/public", ResolvePublicPartyAsync)
            .RequireRateLimiting("party-joins");
        app.MapPost("/api/game/join/requests", RequestPartyJoinAsync)
            .RequireRateLimiting("party-joins");
        app.MapGet("/api/game/join/requests/{requestToken}", GetPartyJoinRequestAsync)
            .RequireRateLimiting("party-join-status");
        app.MapPost("/api/game/join/admit", AdmitPartyJoinAsync)
            .RequireRateLimiting("party-joins");
        app.MapPost("/api/game/rejoin", RejoinPartyAsync)
            .RequireRateLimiting("party-joins");
    }

    private static async Task<IResult> ListPublicPartiesAsync(
        HttpContext context,
        GameSessionProvisioner provisioner,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        try
        {
            return Results.Ok(new
            {
                items = await provisioner.ListPublicPartiesAsync(cancellationToken)
            });
        }
        catch (Exception exception) when (exception is
            GameSessionUnavailableException or HttpRequestException or OperationCanceledException)
        {
            logger.LogWarning(exception, "The public party directory could not be read.");
            context.Response.Headers.RetryAfter = "5";
            return Results.Json(
                new { error = "The public party directory is not available right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> ListConnectedPlayersAsync(
        HttpContext context,
        GameSessionProvisioner provisioner,
        DeveloperAccessPolicy developerAccess,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        // Live presence across every connected player is developer-only
        // telemetry: anyone else gets the same 404 an unmapped path produces,
        // and the supervisor is never queried on their behalf.
        if (!developerAccess.Allows(TokenService.GetUserId(context.User)))
        {
            return Results.NotFound();
        }
        try
        {
            return Results.Ok(new
            {
                items = await provisioner.ListConnectedPlayersAsync(cancellationToken)
            });
        }
        catch (Exception exception) when (exception is
            GameSessionUnavailableException or HttpRequestException or OperationCanceledException)
        {
            logger.LogWarning(exception, "The connected player directory could not be read.");
            context.Response.Headers.RetryAfter = "5";
            return Results.Json(
                new { error = "The connected player directory is not available right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> ListActiveMatchesAsync(
        HttpContext context,
        GameSessionProvisioner provisioner,
        DeveloperAccessPolicy developerAccess,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!developerAccess.Allows(TokenService.GetUserId(context.User)))
        {
            return Results.NotFound();
        }
        try
        {
            return Results.Ok(new
            {
                items = await provisioner.ListActiveMatchesAsync(cancellationToken)
            });
        }
        catch (Exception exception) when (exception is
            GameSessionUnavailableException or HttpRequestException or OperationCanceledException)
        {
            logger.LogWarning(exception, "The active match directory could not be read.");
            context.Response.Headers.RetryAfter = "5";
            return Results.Json(
                new { error = "The active match directory is not available right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> ObserveMatchAsync(
        ObserveMatchRequest request,
        HttpContext context,
        GameSessionProvisioner provisioner,
        DeveloperAccessPolicy developerAccess,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        var userId = TokenService.GetUserId(context.User);
        if (!developerAccess.Allows(userId) || userId is null)
        {
            return Results.NotFound();
        }
        var matchId = request.MatchId?.Trim() ?? string.Empty;
        if (matchId.Length is < 8 or > 256 || matchId.Any(character =>
                !char.IsAsciiLetterOrDigit(character) && character is not ('_' or '-')))
        {
            return ApiErrors.BadRequest("Choose a valid active match to observe.");
        }
        try
        {
            var endpoint = await provisioner.ObserveMatchAsync(
                matchId,
                userId.Value,
                context.User.Identity?.Name ?? $"developer-{userId.Value}",
                cancellationToken);
            return Results.Created("/api/game/observe", new
            {
                kind = "remote",
                observer = true,
                endpoint.Url,
                endpoint.Credential,
                endpoint.SessionKind
            });
        }
        catch (GamePartyJoinException exception)
        {
            return PartyError(exception);
        }
        catch (Exception exception) when (exception is
            GameSessionUnavailableException or HttpRequestException or OperationCanceledException)
        {
            return Results.Json(
                new { error = "That match is not available to observe right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> ProvisionAsync(
        HttpContext context,
        GameSessionProvisioner provisioner,
        DeveloperAccessPolicy developerAccess,
        WebModContentService contentService,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!HeaderMatches(context, "provision"))
        {
            return ApiErrors.BadRequest("The game session request is invalid.");
        }
        try
        {
            var userId = TokenService.GetUserId(context.User);
            var resolution = await contentService.ResolveAsync(
                userId,
                recordDownloads: true,
                cancellationToken: cancellationToken);
            var endpoint = await provisioner.ProvisionAsync(
                resolution.Content,
                userId,
                developerAccess.Allows(userId),
                cancellationToken);
            return Results.Ok(new
            {
                kind = "remote",
                endpoint.Url,
                endpoint.Credential,
                endpoint.SessionKind
            });
        }
        catch (GameSessionUnavailableException exception)
        {
            logger.LogWarning(exception, "A browser game session could not be provisioned.");
            return PrivateSessionUnavailable(context);
        }
        catch (WebModContentException exception)
        {
            return Results.Conflict(new { error = exception.Message });
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "The game session supervisor could not be reached.");
            return PrivateSessionUnavailable(context);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "The game session supervisor timed out.");
            return PrivateSessionUnavailable(context);
        }
    }

    private static async Task<IResult> EnterHubAsync(
        HttpContext context,
        GameSessionProvisioner provisioner,
        DeveloperAccessPolicy developerAccess,
        WebModContentService contentService,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!HeaderMatches(context, "enter-hub"))
        {
            return ApiErrors.BadRequest("The shared Hub request is invalid.");
        }
        try
        {
            var userId = TokenService.GetUserId(context.User);
            var resolution = await contentService.ResolveAsync(
                userId,
                recordDownloads: true,
                cancellationToken: cancellationToken);
            var content = resolution.Content;
            if (content.Mods.Count > 0)
            {
                return Results.Conflict(new
                {
                    error = "Mods use private Colleges. Continue locally or disable active mods."
                });
            }
            var endpoint = await provisioner.AdmitSharedHubAsync(
                content,
                userId,
                developerAccess.Allows(userId),
                cancellationToken);
            return Results.Created("/api/game/hub", new
            {
                kind = "remote",
                endpoint.Url,
                endpoint.Credential,
                endpoint.SessionKind
            });
        }
        catch (GameSessionUnavailableException exception)
        {
            logger.LogWarning(exception, "A shared Hub admission could not be issued.");
            return HubUnavailable(context);
        }
        catch (WebModContentException exception)
        {
            return Results.Conflict(new { error = exception.Message });
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "The game session supervisor could not be reached.");
            return HubUnavailable(context);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "The game session supervisor timed out.");
            return HubUnavailable(context);
        }
    }

    private static async Task<IResult> ResolvePartyCodeAsync(
        ResolvePartyCodeRequest request,
        GameSessionProvisioner provisioner,
        CancellationToken cancellationToken) =>
        await PartyOperationAsync(
            () => provisioner.ResolvePartyCodeAsync(request.Code ?? string.Empty, cancellationToken));

    private static async Task<IResult> ResolvePublicPartyAsync(
        ResolvePublicPartyRequest request,
        GameSessionProvisioner provisioner,
        CancellationToken cancellationToken) =>
        await PartyOperationAsync(
            () => provisioner.ResolvePublicPartyAsync(
                request.ListingId ?? string.Empty,
                cancellationToken));

    private static async Task<IResult> RequestPartyJoinAsync(
        RequestPartyJoinRequest request,
        HttpContext context,
        GameSessionProvisioner provisioner,
        CancellationToken cancellationToken)
    {
        var displayName = request.DisplayName?.Trim() ?? string.Empty;
        var requesterId = request.RequesterId?.Trim() ?? string.Empty;
        if (displayName.Length is < 1 or > 64 || requesterId.Length is < 8 or > 128)
        {
            return ApiErrors.BadRequest("Choose a valid wizard identity before requesting to join.");
        }
        var accountUsername = TokenService.GetUserId(context.User) is null
            ? null
            : context.User.Identity?.Name;
        return await PartyOperationAsync(() => provisioner.RequestPartyJoinAsync(
            request.ListingId ?? string.Empty,
            new GamePartyJoinRequester(accountUsername, displayName, requesterId),
            cancellationToken));
    }

    private static async Task<IResult> GetPartyJoinRequestAsync(
        string requestToken,
        GameSessionProvisioner provisioner,
        CancellationToken cancellationToken) =>
        await PartyOperationAsync(
            () => provisioner.GetPartyJoinRequestAsync(requestToken, cancellationToken));

    private static async Task<IResult> AdmitPartyJoinAsync(
        AdmitPartyJoinRequest request,
        HttpContext context,
        GameSessionProvisioner provisioner,
        DeveloperAccessPolicy developerAccess,
        AppDb db,
        CancellationToken cancellationToken)
    {
        try
        {
            var userId = TokenService.GetUserId(context.User);
            var activeMods = userId is not null && await db.ModSubscriptions
                .AnyAsync(
                    subscription => subscription.UserId == userId.Value && subscription.Enabled,
                    cancellationToken);
            var content = new WebSessionContent(new string('0', 64), []);
            var endpoint = await provisioner.AdmitPartyJoinAsync(
                request.IntentId ?? string.Empty,
                content,
                activeMods,
                userId,
                developerAccess.Allows(userId),
                cancellationToken);
            return Results.Created("/api/game/join/admit", new
            {
                kind = "remote",
                endpoint.Url,
                endpoint.Credential,
                endpoint.SessionKind
            });
        }
        catch (GamePartyJoinException exception)
        {
            return PartyError(exception);
        }
        catch (Exception exception) when (exception is
            GameSessionUnavailableException or HttpRequestException or OperationCanceledException)
        {
            return Results.Json(
                new { error = "That party is not available right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> RejoinPartyAsync(
        RejoinPartyRequest request,
        HttpContext context,
        GameSessionProvisioner provisioner,
        DeveloperAccessPolicy developerAccess,
        WebModContentService contentService,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        try
        {
            var userId = TokenService.GetUserId(context.User);
            var resolution = await contentService.ResolveAsync(
                userId,
                recordDownloads: false,
                cancellationToken: cancellationToken);
            var endpoint = await provisioner.RejoinPartyAsync(
                request.Token ?? string.Empty,
                request.Save ?? string.Empty,
                resolution.Content,
                userId,
                developerAccess.Allows(userId),
                cancellationToken);
            return Results.Created("/api/game/rejoin", new
            {
                kind = "remote",
                endpoint.Url,
                endpoint.Credential,
                endpoint.SessionKind
            });
        }
        catch (GamePartyJoinException exception)
        {
            return PartyError(exception);
        }
        catch (WebModContentException exception)
        {
            return Results.Conflict(new { error = exception.Message });
        }
        catch (Exception exception) when (exception is
            GameSessionUnavailableException or HttpRequestException or OperationCanceledException)
        {
            return Results.Json(
                new { error = "That active party run is not available right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> PartyOperationAsync<T>(Func<Task<T>> operation)
    {
        try
        {
            return Results.Ok(await operation());
        }
        catch (GamePartyJoinException exception)
        {
            return PartyError(exception);
        }
        catch (Exception exception) when (exception is
            GameSessionUnavailableException or HttpRequestException or OperationCanceledException)
        {
            return Results.Json(
                new { error = "That party is not available right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static IResult PartyError(GamePartyJoinException exception)
    {
        var statusCode = exception.StatusCode is 400 or 404 or 409 or 429
            ? exception.StatusCode
            : StatusCodes.Status503ServiceUnavailable;
        return Results.Json(new { error = exception.Message }, statusCode: statusCode);
    }

    private static bool HeaderMatches(HttpContext context, string value) =>
        string.Equals(
            context.Request.Headers[SessionHeader],
            value,
            StringComparison.Ordinal);

    private static IResult PrivateSessionUnavailable(HttpContext context)
    {
        context.Response.Headers.RetryAfter = "5";
        return Results.Json(
            new { error = "A private game session is not available right now." },
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    private static IResult HubUnavailable(HttpContext context)
    {
        context.Response.Headers.RetryAfter = "5";
        return Results.Json(
            new { error = "The shared Hub is not available right now." },
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    public sealed record ResolvePartyCodeRequest(string? Code);
    public sealed record ResolvePublicPartyRequest(string? ListingId);
    public sealed record RequestPartyJoinRequest(
        string? ListingId,
        string? DisplayName,
        string? RequesterId);
    public sealed record AdmitPartyJoinRequest(string? IntentId);
    public sealed record RejoinPartyRequest(string? Token, string? Save);
    public sealed record ObserveMatchRequest(string? MatchId);
}
