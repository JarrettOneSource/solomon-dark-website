using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class GameContentEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/game/content/{sha256}", GetAsync);
    }

    private static IResult GetAsync(
        string sha256,
        HttpContext context,
        StorageService storage)
    {
        string path;
        try
        {
            path = storage.GetGameContentPath(sha256);
        }
        catch (ArgumentException)
        {
            return ApiErrors.NotFound("That game content is unavailable.");
        }
        if (!File.Exists(path))
        {
            return ApiErrors.NotFound("That game content is unavailable.");
        }
        string contentType;
        try
        {
            contentType = storage.GetGameContentType(sha256);
        }
        catch (FileNotFoundException)
        {
            return ApiErrors.NotFound("That game content is unavailable.");
        }
        context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        context.Response.Headers.ETag = $"\"{sha256}\"";
        return Results.File(path, contentType, enableRangeProcessing: false);
    }
}
