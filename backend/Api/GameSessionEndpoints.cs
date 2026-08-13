using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class GameSessionEndpoints
{
    private const string HostCredentialHeader = "X-Solomon-Dark-Host-Credential";
    private const string SessionHeader = "X-Solomon-Dark-Session";

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/game/sessions", ProvisionAsync)
            .RequireRateLimiting("game-sessions");
        app.MapGet("/api/game/lobbies", ListLobbiesAsync);
        app.MapPost("/api/game/lobbies", CreateLobbyAsync)
            .RequireRateLimiting("game-sessions");
        app.MapPost("/api/game/lobbies/{lobbyId}/join", JoinLobbyAsync)
            .RequireRateLimiting("game-sessions");
        app.MapDelete("/api/game/lobbies/{lobbyId}", CancelLobbyAsync)
            .RequireRateLimiting("game-sessions");
    }

    private static async Task<IResult> ProvisionAsync(
        HttpContext context,
        GameSessionProvisioner provisioner,
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
            var endpoint = await provisioner.ProvisionAsync(cancellationToken);
            return Results.Ok(new
            {
                kind = "remote",
                endpoint.Url,
                endpoint.Credential
            });
        }
        catch (GameSessionUnavailableException exception)
        {
            logger.LogWarning(exception, "A browser game session could not be provisioned.");
            return PrivateSessionUnavailable(context);
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

    private static async Task<IResult> ListLobbiesAsync(
        HttpContext context,
        GameSessionProvisioner provisioner,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        try
        {
            var items = await provisioner.ListLobbiesAsync(cancellationToken);
            return Results.Ok(new { items });
        }
        catch (GameLobbyUnavailableException exception)
        {
            logger.LogWarning(exception, "The web game lobby directory could not be read.");
            return LobbyFailure(context, exception);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "The game session supervisor could not be reached.");
            return LobbyUnavailable(context);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "The game session supervisor timed out.");
            return LobbyUnavailable(context);
        }
    }

    private static async Task<IResult> CreateLobbyAsync(
        CreateLobbyRequest request,
        HttpContext context,
        GameSessionProvisioner provisioner,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!HeaderMatches(context, "create-lobby"))
        {
            return ApiErrors.BadRequest("The web playtest request is invalid.");
        }
        var hostPlayer = NormalizeHostPlayer(request.HostPlayer);
        if (hostPlayer is null)
        {
            return ApiErrors.BadRequest("A host player name is required.");
        }
        try
        {
            var created = await provisioner.CreateLobbyAsync(hostPlayer, cancellationToken);
            return Results.Created($"/api/game/lobbies/{created.LobbyId}", new
            {
                created.LobbyId,
                kind = "remote",
                created.Endpoint.Url,
                created.Endpoint.Credential
            });
        }
        catch (GameLobbyUnavailableException exception)
        {
            logger.LogWarning(exception, "A web game lobby could not be created.");
            return LobbyFailure(context, exception);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "The game session supervisor could not be reached.");
            return LobbyUnavailable(context);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "The game session supervisor timed out.");
            return LobbyUnavailable(context);
        }
    }

    private static async Task<IResult> JoinLobbyAsync(
        string lobbyId,
        HttpContext context,
        GameSessionProvisioner provisioner,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!HeaderMatches(context, "join-lobby"))
        {
            return ApiErrors.BadRequest("The web playtest request is invalid.");
        }
        if (!GameSessionProvisioner.IsValidLobbyId(lobbyId))
        {
            return ApiErrors.BadRequest("The web playtest lobby id is invalid.");
        }
        try
        {
            var endpoint = await provisioner.JoinLobbyAsync(lobbyId, cancellationToken);
            return Results.Ok(new
            {
                kind = "remote",
                endpoint.Url,
                endpoint.Credential
            });
        }
        catch (GameLobbyUnavailableException exception)
        {
            logger.LogWarning(exception, "A web game lobby could not be joined.");
            return LobbyFailure(context, exception);
        }
        catch (GameSessionUnavailableException exception)
        {
            logger.LogWarning(exception, "The web game lobby returned an invalid endpoint.");
            return LobbyUnavailable(context);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "The game session supervisor could not be reached.");
            return LobbyUnavailable(context);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "The game session supervisor timed out.");
            return LobbyUnavailable(context);
        }
    }

    private static async Task<IResult> CancelLobbyAsync(
        string lobbyId,
        HttpContext context,
        GameSessionProvisioner provisioner,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!GameSessionProvisioner.IsValidLobbyId(lobbyId))
        {
            return ApiErrors.BadRequest("The web playtest lobby id is invalid.");
        }
        var hostCredential = context.Request.Headers[HostCredentialHeader].ToString();
        if (string.IsNullOrEmpty(hostCredential) || hostCredential.Length > 512)
        {
            return ApiErrors.BadRequest("The web playtest host credential is required.");
        }
        try
        {
            await provisioner.CancelLobbyAsync(lobbyId, hostCredential, cancellationToken);
            return Results.NoContent();
        }
        catch (GameLobbyUnavailableException exception)
        {
            logger.LogWarning(exception, "A web game lobby could not be cancelled.");
            return LobbyFailure(context, exception);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "The game session supervisor could not be reached.");
            return LobbyUnavailable(context);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "The game session supervisor timed out.");
            return LobbyUnavailable(context);
        }
    }

    private static string? NormalizeHostPlayer(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrEmpty(normalized) ||
               normalized.Length > 64 ||
               normalized.Any(char.IsControl)
            ? null
            : normalized;
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

    private static IResult LobbyFailure(
        HttpContext context,
        GameLobbyUnavailableException exception)
    {
        if (exception.StatusCode == StatusCodes.Status503ServiceUnavailable)
        {
            context.Response.Headers.RetryAfter = "5";
        }
        return Results.Json(
            new { error = exception.PublicMessage },
            statusCode: exception.StatusCode);
    }

    private static IResult LobbyUnavailable(HttpContext context)
    {
        context.Response.Headers.RetryAfter = "5";
        return Results.Json(
            new { error = "Web rebuild playtests are not available right now." },
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    private sealed record CreateLobbyRequest(string? HostPlayer);
}
