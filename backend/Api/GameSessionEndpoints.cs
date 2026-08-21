using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class GameSessionEndpoints
{
    private const string SessionHeader = "X-Solomon-Dark-Session";

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/game/sessions", ProvisionAsync)
            .RequireRateLimiting("game-sessions");
        app.MapPost("/api/game/hub", EnterHubAsync)
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

    private static async Task<IResult> EnterHubAsync(
        HttpContext context,
        GameSessionProvisioner provisioner,
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
            var endpoint = await provisioner.AdmitSharedHubAsync(cancellationToken);
            return Results.Created("/api/game/hub", new
            {
                kind = "remote",
                endpoint.Url,
                endpoint.Credential
            });
        }
        catch (GameSessionUnavailableException exception)
        {
            logger.LogWarning(exception, "A shared Hub admission could not be issued.");
            return HubUnavailable(context);
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
}
