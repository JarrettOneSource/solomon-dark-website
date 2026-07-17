using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SolomonDarkRevived.Data;
using SolomonDarkRevived.Services;
using HttpJsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace SolomonDarkRevived.Api;

public static class LobbyEndpoints
{
    private const int LiveSeconds = 120;
    private const int MaximumPlayers = 4;
    private const string SecretHeader = "X-SDR-Lobby-Secret";
    private const string PasswordAlgorithm = "pbkdf2-sha256";
    private const int PasswordIterations = 210_000;
    private static readonly JsonSerializerOptions StorageJsonOptions = new(JsonSerializerDefaults.Web);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/lobbies/announce", AnnounceAsync)
            .RequireRateLimiting("lobby-announcements");
        app.MapDelete("/api/lobbies/{lobbyId}", DelistAsync);
        app.MapPost("/api/lobbies/{id:int}/authorize", AuthorizeAsync)
            .RequireAuthorization("lobby-viewer")
            .RequireRateLimiting("lobby-passwords");
        app.MapGet("/api/lobbies/events", StreamEventsAsync);
        app.MapGet("/api/lobbies", ListAsync);
    }

    private static async Task<IResult> AnnounceAsync(
        AnnounceRequest request,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var secret = NormalizeHex(context.Request.Headers[SecretHeader].ToString(), 64);
        if (secret is null)
        {
            return ApiErrors.Unauthorized("A valid lobby publisher secret is required.");
        }

        if (!TryNormalizeSteamId(request.LobbyId, out var lobbyId) ||
            !TryNormalizeSteamId(request.HostSteamId, out var hostSteamId))
        {
            return ApiErrors.BadRequest("Lobby and host Steam ids must be positive 64-bit integers.");
        }

        var hostPlayer = NormalizeOptionalText(request.HostPlayer, 64);
        if (hostPlayer is null)
        {
            return ApiErrors.BadRequest("Host player names are required and may not exceed 64 characters.");
        }

        if (request.Privacy is not ("public" or "passwordProtected" or "friendsOnly"))
        {
            return ApiErrors.BadRequest("Privacy must be public, passwordProtected, or friendsOnly.");
        }

        var passwordError = ValidatePassword(request.Privacy, request.Password);
        if (passwordError is not null)
        {
            return ApiErrors.BadRequest(passwordError);
        }

        if (request.Players is < 1 or > MaximumPlayers ||
            request.MaxPlayers is < 2 or > MaximumPlayers ||
            request.Players > request.MaxPlayers)
        {
            return ApiErrors.BadRequest("Lobby player counts must fit within the supported 2–4 player capacity.");
        }

        var buildError = ValidateBuild(request.Build);
        if (buildError is not null)
        {
            return ApiErrors.BadRequest(buildError);
        }

        var gameError = ValidateGame(request.Game);
        if (gameError is not null)
        {
            return ApiErrors.BadRequest(gameError);
        }

        var friendSteamIds = NormalizeFriendSteamIds(request.FriendSteamIds, hostSteamId);
        if (friendSteamIds is null)
        {
            return ApiErrors.BadRequest("Friend Steam ids must be unique positive 64-bit integers (maximum 5000).");
        }

        var now = DateTime.UtcNow;
        await DeleteExpiredLobbiesAsync(db, now, cancellationToken);
        var lobby = await db.Lobbies.SingleOrDefaultAsync(
            candidate => candidate.LobbyId == lobbyId,
            cancellationToken);
        if (lobby is null)
        {
            lobby = new LobbySession
            {
                LobbyId = lobbyId,
                Secret = secret,
                FirstSeenUtc = now
            };
            db.Lobbies.Add(lobby);
        }
        else if (!FixedTimeEquals(lobby.Secret, secret))
        {
            return ApiErrors.Forbidden("That Steam lobby is owned by another publisher secret.");
        }

        lobby.HostSteamId = hostSteamId;
        lobby.HostPlayer = hostPlayer;
        lobby.Privacy = request.Privacy;
        lobby.PasswordSalt = request.Password?.Salt;
        lobby.PasswordHash = request.Password?.Hash;
        lobby.FriendSteamIdsJson = JsonSerializer.Serialize(friendSteamIds, StorageJsonOptions);
        lobby.Players = request.Players;
        lobby.MaxPlayers = request.MaxPlayers;
        lobby.AppId = request.Build!.AppId;
        lobby.ProtocolVersion = request.Build.ProtocolVersion;
        lobby.ManifestSha256 = request.Build.ManifestSha256!.ToLowerInvariant();
        lobby.LoaderVersion = request.Build.LoaderVersion!.Trim();
        lobby.Phase = request.Game!.Phase;
        lobby.BoneyardId = NormalizeOptionalText(request.Game.BoneyardId, 64);
        lobby.BoneyardName = NormalizeOptionalText(request.Game.BoneyardName, 80);
        lobby.BoneyardSha256 = NormalizeHex(request.Game.BoneyardSha256, 64);
        lobby.Wave = request.Game.Wave;
        lobby.Difficulty = NormalizeOptionalText(request.Game.Difficulty, 32);
        lobby.ElapsedSeconds = request.Game.ElapsedSeconds;
        lobby.StatusText = NormalizeOptionalText(request.Game.StatusText, 120);
        lobby.LastSeenUtc = now;

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            return ApiErrors.Conflict("That Steam lobby was announced concurrently; retry the heartbeat.");
        }

        return Results.Ok(new { lobby.Id, expiresInSeconds = LiveSeconds });
    }

    private static async Task<IResult> DelistAsync(
        string lobbyId,
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        if (!TryNormalizeSteamId(lobbyId, out var normalizedLobbyId))
        {
            return ApiErrors.BadRequest("A valid Steam lobby id is required.");
        }

        var secret = NormalizeHex(context.Request.Headers[SecretHeader].ToString(), 64);
        var lobby = await db.Lobbies.SingleOrDefaultAsync(
            candidate => candidate.LobbyId == normalizedLobbyId,
            cancellationToken);
        if (lobby is null)
        {
            return Results.NoContent();
        }
        if (secret is null || !FixedTimeEquals(lobby.Secret, secret))
        {
            return ApiErrors.Forbidden("That Steam lobby is owned by another publisher secret.");
        }

        db.Lobbies.Remove(lobby);
        await db.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ListAsync(
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "private, no-store";
        context.Response.Headers.Vary = "Authorization";
        return Results.Ok(await GetListAsync(context, db, cancellationToken));
    }

    private static async Task<IResult> AuthorizeAsync(
        int id,
        PasswordAuthorizationRequest request,
        HttpContext context,
        AppDb db,
        LobbyJoinTicketService tickets,
        CancellationToken cancellationToken)
    {
        context.Response.Headers.CacheControl = "no-store";
        var steamId = await ResolveViewerSteamIdAsync(
            context.User,
            db,
            cancellationToken);
        if (steamId is null)
        {
            return ApiErrors.Forbidden(
                "A linked website account or verified launcher Steam session is required.");
        }

        await DeleteExpiredLobbiesAsync(db, DateTime.UtcNow, cancellationToken);
        var lobby = await db.Lobbies.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (lobby is null)
        {
            return ApiErrors.NotFound("That lobby is no longer available.");
        }
        if (lobby.Privacy != "passwordProtected" || lobby.PasswordHash is null)
        {
            return ApiErrors.BadRequest("That lobby does not use website password authorization.");
        }
        if (lobby.Players >= lobby.MaxPlayers)
        {
            return ApiErrors.Conflict("That lobby is full.");
        }

        var submittedHash = NormalizeHex(request.PasswordHash, 64);
        if (submittedHash is null || !FixedTimeEquals(lobby.PasswordHash, submittedHash))
        {
            return ApiErrors.Forbidden("That lobby password is incorrect.");
        }

        var ticket = tickets.Issue(lobby.Secret, lobby.LobbyId, steamId);
        var launchUri = $"sdr://join/{lobby.LobbyId}?ticket={Uri.EscapeDataString(ticket.Value)}";
        return Results.Ok(new
        {
            lobbyId = lobby.LobbyId,
            steamId,
            ticket = ticket.Value,
            ticket.ExpiresAtUtc,
            launchUri
        });
    }

    private static async Task StreamEventsAsync(
        HttpContext context,
        AppDb db,
        IOptions<HttpJsonOptions> jsonOptions,
        CancellationToken cancellationToken)
    {
        context.Response.ContentType = "text/event-stream";
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.Headers.Vary = "Authorization";
        context.Response.Headers["X-Accel-Buffering"] = "no";
        context.Features.Get<IHttpResponseBodyFeature>()?.DisableBuffering();

        try
        {
            var current = await GetListAsync(context, db, cancellationToken);
            var fingerprint = JsonSerializer.Serialize(current, StorageJsonOptions);
            await WriteEventAsync(context.Response, current, jsonOptions.Value.SerializerOptions, cancellationToken);

            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(3));
            var checksSinceKeepalive = 0;
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                var next = await GetListAsync(context, db, cancellationToken);
                var nextFingerprint = JsonSerializer.Serialize(next, StorageJsonOptions);
                if (nextFingerprint != fingerprint)
                {
                    fingerprint = nextFingerprint;
                    await WriteEventAsync(
                        context.Response,
                        next,
                        jsonOptions.Value.SerializerOptions,
                        cancellationToken);
                }

                if (++checksSinceKeepalive == 5)
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
        }
    }

    private static async Task<LobbyListResponse> GetListAsync(
        HttpContext context,
        AppDb db,
        CancellationToken cancellationToken)
    {
        await DeleteExpiredLobbiesAsync(db, DateTime.UtcNow, cancellationToken);
        var viewerSteamId = await ResolveViewerSteamIdAsync(
            context.User,
            db,
            cancellationToken);

        var lobbies = await db.Lobbies.AsNoTracking()
            .OrderByDescending(lobby => lobby.Players)
            .ThenBy(lobby => lobby.Id)
            .ToArrayAsync(cancellationToken);
        var items = lobbies
            .Where(lobby => lobby.Privacy != "friendsOnly" ||
                (viewerSteamId is not null &&
                    (lobby.HostSteamId == viewerSteamId || IsFriend(lobby, viewerSteamId))))
            .Select(MapLobby)
            .ToArray();
        return new LobbyListResponse(items, items.Sum(item => item.Players));
    }

    private static async Task<string?> ResolveViewerSteamIdAsync(
        System.Security.Claims.ClaimsPrincipal principal,
        AppDb db,
        CancellationToken cancellationToken)
    {
        var userId = TokenService.GetUserId(principal);
        if (userId is not null)
        {
            return await db.Users
                .Where(user => user.Id == userId.Value)
                .Select(user => user.SteamId)
                .SingleOrDefaultAsync(cancellationToken);
        }

        return TokenService.GetSteamSessionId(principal);
    }

    private static LobbyItem MapLobby(LobbySession lobby)
    {
        var canJoinDirectly = lobby.Privacy is "public" or "friendsOnly";
        return new LobbyItem(
            lobby.Id,
            lobby.HostPlayer,
            lobby.HostSteamId,
            lobby.Privacy,
            lobby.Privacy switch
            {
                "friendsOnly" => "friend",
                "passwordProtected" => "password",
                _ => "public"
            },
            lobby.Players,
            lobby.MaxPlayers,
            lobby.LastSeenUtc,
            lobby.LastSeenUtc.AddSeconds(LiveSeconds),
            new LobbyBuild(
                lobby.AppId,
                lobby.ProtocolVersion,
                lobby.ManifestSha256,
                lobby.LoaderVersion),
            new LobbyGame(
                lobby.Phase,
                lobby.BoneyardId,
                lobby.BoneyardName,
                lobby.BoneyardSha256,
                lobby.Wave,
                lobby.Difficulty,
                lobby.ElapsedSeconds,
                lobby.StatusText),
            lobby.Privacy == "passwordProtected"
                ? new LobbyPassword(PasswordAlgorithm, PasswordIterations, lobby.PasswordSalt!)
                : null,
            canJoinDirectly
                ? new LobbyJoin(lobby.LobbyId, $"sdr://join/{lobby.LobbyId}")
                : null);
    }

    private static bool IsFriend(LobbySession lobby, string viewerSteamId)
    {
        var friendIds = JsonSerializer.Deserialize<string[]>(
            lobby.FriendSteamIdsJson,
            StorageJsonOptions) ?? [];
        return friendIds.Contains(viewerSteamId, StringComparer.Ordinal);
    }

    private static async Task WriteEventAsync(
        HttpResponse response,
        LobbyListResponse lobbies,
        JsonSerializerOptions jsonOptions,
        CancellationToken cancellationToken)
    {
        await response.WriteAsync("event: lobbies\ndata: ", cancellationToken);
        await JsonSerializer.SerializeAsync(response.Body, lobbies, jsonOptions, cancellationToken);
        await response.WriteAsync("\n\n", cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }

    private static Task<int> DeleteExpiredLobbiesAsync(
        AppDb db,
        DateTime now,
        CancellationToken cancellationToken) =>
        db.Lobbies
            .Where(lobby => lobby.LastSeenUtc < now.AddSeconds(-LiveSeconds))
            .ExecuteDeleteAsync(cancellationToken);

    private static string? ValidatePassword(string privacy, PasswordDescriptor? password)
    {
        if (privacy != "passwordProtected")
        {
            return password is null
                ? null
                : "Password metadata is only valid for passwordProtected lobbies.";
        }

        if (password is null || password.Algorithm != PasswordAlgorithm ||
            password.Iterations != PasswordIterations ||
            NormalizeHex(password.Salt, 32) is null ||
            NormalizeHex(password.Hash, 64) is null)
        {
            return "Password-protected lobbies require PBKDF2-SHA256, 210000 iterations, a 16-byte salt, and a 32-byte hash.";
        }
        return null;
    }

    private static string? ValidateBuild(BuildDescriptor? build)
    {
        if (build is null || build.AppId is <= 0 or > uint.MaxValue ||
            build.ProtocolVersion is <= 0 or > ushort.MaxValue ||
            NormalizeHex(build.ManifestSha256, 64) is null ||
            NormalizeOptionalText(build.LoaderVersion, 64) is null)
        {
            return "Build metadata requires a valid AppID, protocol version, manifest SHA-256, and loader version.";
        }
        return null;
    }

    private static string? ValidateGame(GameDescriptor? game)
    {
        if (game is null || game.Phase is not ("hub" or "loading" or "session" or "results"))
        {
            return "Game phase must be hub, loading, session, or results.";
        }
        if (game.BoneyardId?.Trim().Length > 64 || game.BoneyardName?.Trim().Length > 80 ||
            (game.BoneyardSha256 is not null && NormalizeHex(game.BoneyardSha256, 64) is null) ||
            game.Wave is < 0 or > 100_000 || game.Difficulty?.Trim().Length > 32 ||
            game.ElapsedSeconds is < 0 or > 604_800 || game.StatusText?.Trim().Length > 120)
        {
            return "Game status metadata is outside the supported contract limits.";
        }
        return null;
    }

    private static string[]? NormalizeFriendSteamIds(string[]? values, string hostSteamId)
    {
        values ??= [];
        if (values.Length > 5000)
        {
            return null;
        }
        var normalized = new HashSet<string>(StringComparer.Ordinal);
        foreach (var value in values)
        {
            if (!TryNormalizeSteamId(value, out var steamId))
            {
                return null;
            }
            if (steamId != hostSteamId)
            {
                normalized.Add(steamId);
            }
        }
        return normalized.Order(StringComparer.Ordinal).ToArray();
    }

    private static bool TryNormalizeSteamId(string? value, out string normalized)
    {
        value = value?.Trim();
        if (ulong.TryParse(value, out var steamId) && steamId != 0)
        {
            normalized = steamId.ToString();
            return true;
        }
        normalized = string.Empty;
        return false;
    }

    private static string? NormalizeOptionalText(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }
        value = value.Trim();
        return value.Length <= maxLength ? value : null;
    }

    private static string? NormalizeHex(string? value, int length)
    {
        if (value is null)
        {
            return null;
        }
        value = value.Trim().ToLowerInvariant();
        return value.Length == length && value.All(character =>
            character is >= '0' and <= '9' or >= 'a' and <= 'f')
            ? value
            : null;
    }

    private static bool FixedTimeEquals(string expected, string actual)
    {
        if (expected.Length != actual.Length)
        {
            return false;
        }
        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(expected),
            Encoding.ASCII.GetBytes(actual));
    }

    public sealed record AnnounceRequest(
        string? LobbyId,
        string? HostSteamId,
        string? HostPlayer,
        string? Privacy,
        PasswordDescriptor? Password,
        string[]? FriendSteamIds,
        int Players,
        int MaxPlayers,
        BuildDescriptor? Build,
        GameDescriptor? Game);

    public sealed record PasswordDescriptor(
        string? Algorithm,
        int Iterations,
        string? Salt,
        string? Hash);

    public sealed record BuildDescriptor(
        long AppId,
        int ProtocolVersion,
        string? ManifestSha256,
        string? LoaderVersion);

    public sealed record GameDescriptor(
        string Phase,
        string? BoneyardId,
        string? BoneyardName,
        string? BoneyardSha256,
        int? Wave,
        string? Difficulty,
        int? ElapsedSeconds,
        string? StatusText);

    public sealed record PasswordAuthorizationRequest(string? PasswordHash);

    private sealed record LobbyListResponse(LobbyItem[] Items, int PlayerCount);
    private sealed record LobbyItem(
        int Id,
        string HostPlayer,
        string HostSteamId,
        string Privacy,
        string Access,
        int Players,
        int MaxPlayers,
        DateTime LastSeenUtc,
        DateTime ExpiresAtUtc,
        LobbyBuild Build,
        LobbyGame Game,
        LobbyPassword? Password,
        LobbyJoin? Join);
    private sealed record LobbyBuild(
        long AppId,
        int ProtocolVersion,
        string ManifestSha256,
        string LoaderVersion);
    private sealed record LobbyGame(
        string Phase,
        string? BoneyardId,
        string? BoneyardName,
        string? BoneyardSha256,
        int? Wave,
        string? Difficulty,
        int? ElapsedSeconds,
        string? StatusText);
    private sealed record LobbyPassword(string Algorithm, int Iterations, string Salt);
    private sealed record LobbyJoin(string LobbyId, string LaunchUri);
}
