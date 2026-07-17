using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;

namespace SolomonDarkRevived.Api;

public static class SteamAuthEndpoints
{
    private static readonly TimeSpan LinkLifetime = TimeSpan.FromMinutes(10);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/auth/steam/link", StartLinkAsync).RequireAuthorization();
        app.MapGet("/api/auth/steam/callback", CompleteLinkAsync);
        app.MapDelete("/api/auth/steam", UnlinkAsync).RequireAuthorization();
    }

    private static async Task<IResult> StartLinkAsync(
        StartSteamLinkRequest request,
        HttpContext context,
        AppDb db,
        SteamOpenIdService steam,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        var userId = TokenService.GetUserId(context.User);
        if (userId is null || !await db.Users.AnyAsync(
                user => user.Id == userId.Value,
                cancellationToken))
        {
            return ApiErrors.Unauthorized("The Annals could not identify this bearer.");
        }

        var returnPath = NormalizeReturnPath(request.ReturnPath);
        if (returnPath is null)
        {
            return ApiErrors.BadRequest("Steam link return paths must be relative site paths.");
        }

        var state = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var stateHash = HashState(state);
        var now = DateTime.UtcNow;
        await db.SteamLinkAttempts
            .Where(attempt => attempt.ExpiresAtUtc < now || attempt.UserId == userId.Value)
            .ExecuteDeleteAsync(cancellationToken);
        db.SteamLinkAttempts.Add(new SteamLinkAttempt
        {
            UserId = userId.Value,
            StateHash = stateHash,
            ReturnPath = returnPath,
            ExpiresAtUtc = now.Add(LinkLifetime)
        });
        await db.SaveChangesAsync(cancellationToken);

        var origin = GetOrigin(context.Request);
        var callback = $"{origin}/api/auth/steam/callback?state={Uri.EscapeDataString(state)}";
        var authorizationUrl = steam.CreateAuthorizationUrl(origin + "/", callback);
        return Results.Ok(new
        {
            authorizationUrl,
            expiresAtUtc = now.Add(LinkLifetime)
        });
    }

    private static async Task<IResult> CompleteLinkAsync(
        string? state,
        HttpContext context,
        AppDb db,
        SteamOpenIdService steam,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (string.IsNullOrWhiteSpace(state) || state.Length != 64)
        {
            return ApiErrors.BadRequest("The Steam link state is invalid or expired.");
        }

        var stateHash = HashState(state);
        var attempt = await db.SteamLinkAttempts
            .Include(candidate => candidate.User)
            .SingleOrDefaultAsync(
                candidate => candidate.StateHash == stateHash,
                cancellationToken);
        if (attempt is null || attempt.ExpiresAtUtc < DateTime.UtcNow)
        {
            return ApiErrors.BadRequest("The Steam link state is invalid or expired.");
        }

        var origin = GetOrigin(context.Request);
        var expectedReturnTo = $"{origin}/api/auth/steam/callback?state={Uri.EscapeDataString(state)}";
        var steamId = await steam.ValidateAsync(
            context.Request.Query,
            expectedReturnTo,
            cancellationToken);
        if (steamId is null)
        {
            db.SteamLinkAttempts.Remove(attempt);
            await db.SaveChangesAsync(cancellationToken);
            return Results.Redirect(AppendResult(attempt.ReturnPath, "failed"));
        }

        var alreadyLinked = await db.Users.AnyAsync(
            user => user.SteamId == steamId && user.Id != attempt.UserId,
            cancellationToken);
        if (alreadyLinked)
        {
            db.SteamLinkAttempts.Remove(attempt);
            await db.SaveChangesAsync(cancellationToken);
            return Results.Redirect(AppendResult(attempt.ReturnPath, "conflict"));
        }

        attempt.User.SteamId = steamId;
        db.SteamLinkAttempts.Remove(attempt);
        await db.SaveChangesAsync(cancellationToken);
        return Results.Redirect(AppendResult(attempt.ReturnPath, "linked"));
    }

    private static async Task<IResult> UnlinkAsync(
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var userId = TokenService.GetUserId(context.User);
        var user = userId is null
            ? null
            : await db.Users.SingleOrDefaultAsync(
                candidate => candidate.Id == userId.Value,
                cancellationToken);
        if (user is null)
        {
            return ApiErrors.Unauthorized("The Annals could not identify this bearer.");
        }

        user.SteamId = null;
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static string GetOrigin(HttpRequest request) =>
        $"{request.Scheme}://{request.Host}";

    private static string HashState(string state) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(state))).ToLowerInvariant();

    private static string? NormalizeReturnPath(string? value)
    {
        value = string.IsNullOrWhiteSpace(value) ? "/account" : value.Trim();
        return value.Length <= 256 &&
               value.StartsWith('/') &&
               !value.StartsWith("//") &&
               !value.Contains('\\') &&
               value.All(character => !char.IsControl(character))
            ? value
            : null;
    }

    private static string AppendResult(string returnPath, string result) =>
        returnPath + (returnPath.Contains('?') ? '&' : '?') + "steamLink=" + result;

    public sealed record StartSteamLinkRequest(string? ReturnPath);
}
