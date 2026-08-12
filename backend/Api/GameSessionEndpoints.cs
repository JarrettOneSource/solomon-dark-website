using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class GameSessionEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/game/sessions", ProvisionAsync)
            .RequireRateLimiting("game-sessions");
    }

    private static async Task<IResult> ProvisionAsync(
        HttpContext context,
        GameSessionProvisioner provisioner,
        ILogger<GameSessionProvisioner> logger,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (!string.Equals(
                context.Request.Headers["X-Solomon-Dark-Session"],
                "provision",
                StringComparison.Ordinal))
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
            context.Response.Headers.RetryAfter = "5";
            return Results.Json(
                new { error = "A private game session is not available right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "The game session supervisor could not be reached.");
            context.Response.Headers.RetryAfter = "5";
            return Results.Json(
                new { error = "A private game session is not available right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "The game session supervisor timed out.");
            context.Response.Headers.RetryAfter = "5";
            return Results.Json(
                new { error = "A private game session is not available right now." },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }
}
