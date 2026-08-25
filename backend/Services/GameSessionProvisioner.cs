using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SolomonDarkRevived.Services;

public sealed partial class GameSessionProvisioner
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly string? adminSecret;
    private readonly HttpClient httpClient;
    private readonly Uri? publicWebSocketOrigin;
    private readonly Uri? supervisorUrl;

    public GameSessionProvisioner(HttpClient httpClient, IConfiguration configuration)
    {
        this.httpClient = httpClient;
        adminSecret = configuration["GameSessions:AdminSecret"]?.Trim();
        supervisorUrl = ParseAbsoluteUri(configuration["GameSessions:SupervisorUrl"], "http");
        publicWebSocketOrigin = ParseAbsoluteUri(
            configuration["GameSessions:PublicWebSocketOrigin"],
            "wss");
    }

    public async Task<ProvisionedGameEndpoint> ProvisionAsync(
        WebSessionContent content,
        int? leaderboardUserId,
        bool developerAccess,
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Post, "/admin/sessions");
        request.Content = JsonContent.Create(new { content, developerAccess, leaderboardUserId });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GameSessionUnavailableException(
                $"The game session supervisor returned {(int)response.StatusCode}.");
        }

        var provisioned = await ReadPrivateProvisionResponseAsync(response, cancellationToken);
        if (!string.Equals(provisioned.SessionKind, "private-college", StringComparison.Ordinal))
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid private College endpoint.");
        }
        return BuildEndpoint(
            provisioned.Path,
            provisioned.Credential,
            "private-college",
            GameSessionPath());
    }

    public async Task<ProvisionedGameEndpoint> AdmitSharedHubAsync(
        WebSessionContent content,
        int? leaderboardUserId,
        bool developerAccess,
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Post, "/admin/hub/tickets");
        request.Content = JsonContent.Create(new { content, developerAccess, leaderboardUserId });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GameSessionUnavailableException(
                $"The game session supervisor returned {(int)response.StatusCode}.");
        }

        var provisioned = await ReadPrivateProvisionResponseAsync(response, cancellationToken);
        if (!string.Equals(provisioned.Path, "/game-hub", StringComparison.Ordinal) ||
            !string.Equals(provisioned.SessionKind, "global-hub", StringComparison.Ordinal))
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid shared Hub endpoint.");
        }
        return BuildEndpoint(
            provisioned.Path,
            provisioned.Credential,
            "global-hub",
            GameHubPath());
    }

    public async Task<SharedHubStats> GetSharedHubStatsAsync(
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Get, "/health");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GameSessionUnavailableException(
                $"The game session supervisor returned {(int)response.StatusCode}.");
        }
        try
        {
            return await response.Content.ReadFromJsonAsync<SharedHubStats>(
                    JsonOptions,
                    cancellationToken)
                ?? throw new JsonException("The response was empty.");
        }
        catch (JsonException exception)
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned invalid shared Hub stats.",
                exception);
        }
    }

    public Task<GamePartyJoinResolution> ResolvePartyCodeAsync(
        string code,
        CancellationToken cancellationToken) =>
        PostPartyAsync<GamePartyJoinResolution>(
            "/admin/join/resolve",
            new { code },
            ValidatePartyJoinResolution,
            cancellationToken);

    public Task<GamePartyJoinResolution> ResolvePublicPartyAsync(
        string listingId,
        CancellationToken cancellationToken) =>
        PostPartyAsync<GamePartyJoinResolution>(
            "/admin/join/public",
            new { listingId },
            ValidatePartyJoinResolution,
            cancellationToken);

    public Task<GamePartyJoinRequestReceipt> RequestPartyJoinAsync(
        string listingId,
        GamePartyJoinRequester requester,
        CancellationToken cancellationToken) =>
        PostPartyAsync<GamePartyJoinRequestReceipt>(
            "/admin/join/requests",
            new { listingId, requester },
            value => value.Status == "pending" && ValidToken(value.RequestToken),
            cancellationToken);

    public async Task<GamePartyJoinRequestStatus> GetPartyJoinRequestAsync(
        string requestToken,
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        if (!ValidToken(requestToken))
        {
            throw new GamePartyJoinException("That join request is invalid.", 400);
        }
        using var request = CreateAdminRequest(
            HttpMethod.Get,
            $"/admin/join/requests/{Uri.EscapeDataString(requestToken)}");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        return await ReadPartyResponseAsync<GamePartyJoinRequestStatus>(
            response,
            value => value.Status switch
            {
                "pending" or "denied" => value.IntentId is null && value.Target is null,
                "accepted" => ValidToken(value.IntentId) && value.Target is not null &&
                    ValidatePartyJoinTarget(value.Target),
                _ => false
            },
            cancellationToken);
    }

    public async Task<ProvisionedGameEndpoint> AdmitPartyJoinAsync(
        string intentId,
        WebSessionContent content,
        bool activeMods,
        int? leaderboardUserId,
        bool developerAccess,
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        if (!ValidToken(intentId))
        {
            throw new GamePartyJoinException("That party join is invalid.", 400);
        }
        using var request = CreateAdminRequest(HttpMethod.Post, "/admin/join/admit");
        request.Content = JsonContent.Create(new
        {
            activeMods,
            content,
            developerAccess,
            intentId,
            leaderboardUserId
        });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var provisioned = await ReadPartyResponseAsync<SupervisorProvisionResponse>(
            response,
            value => value.SessionKind is "global-hub" or "private-college",
            cancellationToken);
        return provisioned.SessionKind switch
        {
            "global-hub" => BuildEndpoint(
                provisioned.Path,
                provisioned.Credential,
                provisioned.SessionKind,
                GameHubPath()),
            "private-college" => BuildEndpoint(
                provisioned.Path,
                provisioned.Credential,
                provisioned.SessionKind,
                GameSessionPath()),
            _ => throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid party endpoint.")
        };
    }

    public async Task<ProvisionedGameEndpoint> RejoinPartyAsync(
        string token,
        string save,
        WebSessionContent content,
        int? leaderboardUserId,
        bool developerAccess,
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        if (token.Length > 8_192 || !PartyRejoinTokenRegex().IsMatch(token))
        {
            throw new GamePartyJoinException("That active-party rejoin is invalid.", 400);
        }
        if (string.IsNullOrEmpty(save) || Encoding.UTF8.GetByteCount(save) > WebGameSaveInspector.MaxDocumentBytes)
        {
            throw new GamePartyJoinException("That active-party save is invalid.", 400);
        }
        using var request = CreateAdminRequest(HttpMethod.Post, "/admin/rejoin");
        request.Content = JsonContent.Create(new
        {
            content,
            developerAccess,
            leaderboardUserId,
            save,
            token
        });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var provisioned = await ReadPartyResponseAsync<SupervisorProvisionResponse>(
            response,
            value => value.SessionKind is "global-hub" or "private-college",
            cancellationToken);
        return provisioned.SessionKind switch
        {
            "global-hub" => BuildEndpoint(
                provisioned.Path,
                provisioned.Credential,
                provisioned.SessionKind,
                GameHubPath()),
            "private-college" => BuildEndpoint(
                provisioned.Path,
                provisioned.Credential,
                provisioned.SessionKind,
                GameSessionPath()),
            _ => throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid rejoin endpoint.")
        };
    }

    public async Task<IReadOnlyList<PublicGameParty>> ListPublicPartiesAsync(
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Get, "/admin/hub/parties");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GameSessionUnavailableException(
                $"The game session supervisor returned {(int)response.StatusCode}.");
        }
        try
        {
            var directory = await response.Content.ReadFromJsonAsync<PublicGamePartyDirectory>(
                    JsonOptions,
                    cancellationToken)
                ?? throw new JsonException("The response was empty.");
            if (!ValidPublicPartyDirectory(directory.Items))
            {
                throw new JsonException("The public party directory was invalid.");
            }
            return directory.Items;
        }
        catch (JsonException exception)
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid public party directory.",
                exception);
        }
    }

    public async Task<IReadOnlyList<ConnectedGamePlayer>> ListConnectedPlayersAsync(
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Get, "/admin/presence");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GameSessionUnavailableException(
                $"The game session supervisor returned {(int)response.StatusCode}.");
        }
        try
        {
            var directory = await response.Content.ReadFromJsonAsync<ConnectedGamePlayerDirectory>(
                    JsonOptions,
                    cancellationToken)
                ?? throw new JsonException("The response was empty.");
            if (!ValidConnectedPlayerDirectory(directory.Items))
            {
                throw new JsonException("The connected player directory was invalid.");
            }
            return directory.Items;
        }
        catch (JsonException exception)
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid connected player directory.",
                exception);
        }
    }

    public async Task<IReadOnlyList<DeveloperGameMatch>> ListActiveMatchesAsync(
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Get, "/admin/matches");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GameSessionUnavailableException(
                $"The game session supervisor returned {(int)response.StatusCode}.");
        }
        try
        {
            var directory = await response.Content.ReadFromJsonAsync<DeveloperGameMatchDirectory>(
                    JsonOptions,
                    cancellationToken)
                ?? throw new JsonException("The response was empty.");
            if (!ValidActiveMatchDirectory(directory.Items))
            {
                throw new JsonException("The active match directory was invalid.");
            }
            return directory.Items;
        }
        catch (JsonException exception)
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid active match directory.",
                exception);
        }
    }

    public async Task<ProvisionedGameEndpoint> ObserveMatchAsync(
        string matchId,
        int observerUserId,
        string observerUsername,
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Post, "/admin/observers");
        request.Content = JsonContent.Create(new
        {
            matchId,
            observer = new { userId = observerUserId, username = observerUsername }
        });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GamePartyJoinException(
                "That match is no longer available to observe.",
                (int)response.StatusCode);
        }
        var provisioned = await ReadPrivateProvisionResponseAsync(response, cancellationToken);
        return provisioned.SessionKind switch
        {
            "global-hub" => BuildEndpoint(
                provisioned.Path,
                provisioned.Credential,
                "global-hub",
                GameHubPath()),
            "private-college" => BuildEndpoint(
                provisioned.Path,
                provisioned.Credential,
                "private-college",
                GameSessionPath()),
            _ => throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid observer endpoint.")
        };
    }

    private HttpRequestMessage CreateAdminRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, new Uri(supervisorUrl!, path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminSecret);
        return request;
    }

    private async Task<T> PostPartyAsync<T>(
        string path,
        object body,
        Func<T, bool> validate,
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Post, path);
        request.Content = JsonContent.Create(body);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        return await ReadPartyResponseAsync(response, validate, cancellationToken);
    }

    private static async Task<T> ReadPartyResponseAsync<T>(
        HttpResponseMessage response,
        Func<T, bool> validate,
        CancellationToken cancellationToken)
    {
        if (!response.IsSuccessStatusCode)
        {
            string message;
            try
            {
                var error = await response.Content.ReadFromJsonAsync<PartyErrorResponse>(
                    JsonOptions,
                    cancellationToken);
                message = string.IsNullOrWhiteSpace(error?.Error)
                    ? "That party is not available right now."
                    : error.Error;
            }
            catch (JsonException)
            {
                message = "That party is not available right now.";
            }
            throw new GamePartyJoinException(message, (int)response.StatusCode);
        }
        try
        {
            var value = await response.Content.ReadFromJsonAsync<T>(JsonOptions, cancellationToken)
                ?? throw new JsonException("The response was empty.");
            if (!validate(value)) throw new JsonException("The party response was invalid.");
            return value;
        }
        catch (JsonException exception)
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid party response.",
                exception);
        }
    }

    private ProvisionedGameEndpoint BuildEndpoint(
        string? path,
        string? credential,
        string expectedSessionKind,
        Regex? requiredPath = null)
    {
        if (string.IsNullOrEmpty(credential) ||
            credential.Length > 512 ||
            !(requiredPath ?? GameSessionPath()).IsMatch(path ?? string.Empty))
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid endpoint.");
        }

        return new ProvisionedGameEndpoint(
            new Uri(publicWebSocketOrigin!, path!).ToString(),
            credential,
            expectedSessionKind);
    }

    private void EnsurePrivateSessionsConfigured()
    {
        if (!Configured())
        {
            throw new GameSessionUnavailableException(
                "Game session provisioning is not configured.");
        }
    }

    private bool Configured() =>
        !string.IsNullOrEmpty(adminSecret) && supervisorUrl is not null && publicWebSocketOrigin is not null;

    private static bool ValidPublicPartyDirectory(PublicGameParty[]? items)
    {
        if (items is null || items.Select(party => party.Id).Distinct(StringComparer.Ordinal).Count() != items.Length)
        {
            return false;
        }
        return items.All(party =>
            !string.IsNullOrWhiteSpace(party.Id) &&
            !string.IsNullOrWhiteSpace(party.Leader) &&
            party.Members is not null &&
            party.MemberCount == party.Members.Length &&
            party.MemberCount >= 1 &&
            party.MaxMembers >= party.MemberCount &&
            party.Members.Contains(party.Leader, StringComparer.Ordinal) &&
            party.Members.All(member => !string.IsNullOrWhiteSpace(member)) &&
            party.Status is "hub" or "playing" &&
            party.Visibility is "invite-only" or "public" &&
            (party.Status == "hub"
                ? party.BoneyardName is null
                : !string.IsNullOrWhiteSpace(party.BoneyardName) &&
                    party.BoneyardName.Length <= 256));
    }

    private static bool ValidConnectedPlayerDirectory(ConnectedGamePlayer[]? items) =>
        items is not null && items.All(player =>
            !string.IsNullOrWhiteSpace(player.DisplayName) &&
            player.DisplayName.Length <= 64 &&
            (player.AccountUsername is null ||
                (!string.IsNullOrWhiteSpace(player.AccountUsername) &&
                    player.AccountUsername.Length <= 64)) &&
            player.Session is "global-hub" or "private-college" &&
            player.Activity is "hub" or "boneyard" &&
            (player.Activity == "hub"
                ? player.BoneyardName is null && player.WaveNumber is null
                : !string.IsNullOrWhiteSpace(player.BoneyardName) &&
                    player.BoneyardName.Length <= 256 &&
                    player.WaveNumber is >= 0 and <= 100_000) &&
            (player.PartyLeader is null
                ? player.PartySize is null
                : !string.IsNullOrWhiteSpace(player.PartyLeader) &&
                    player.PartyLeader.Length <= 64 &&
                    player.PartySize is >= 2 and <= 64));

    private static bool ValidActiveMatchDirectory(DeveloperGameMatch[]? items) =>
        items is not null &&
        items.Select(match => match.Id).Distinct(StringComparer.Ordinal).Count() == items.Length &&
        items.All(match =>
            ValidToken(match.Id) &&
            match.Session is "global-hub" or "private-college" &&
            !string.IsNullOrWhiteSpace(match.BoneyardName) &&
            match.BoneyardName.Length <= 256 &&
            match.WaveNumber is >= 0 and <= 100_000 &&
            match.Visibility is "invite-only" or "private" or "public" &&
            match.Players is { Length: >= 1 and <= 64 } &&
            match.PlayerCount == match.Players.Length &&
            match.Players.All(player =>
                !string.IsNullOrWhiteSpace(player) && player.Length <= 64) &&
            !string.IsNullOrWhiteSpace(match.PartyLeader) &&
            match.PartyLeader.Length <= 64 &&
            match.Players.Contains(match.PartyLeader, StringComparer.Ordinal));

    private static bool ValidatePartyJoinResolution(GamePartyJoinResolution value) =>
        ValidToken(value.IntentId) && ValidatePartyJoinTarget(value.Target);

    private static bool ValidatePartyJoinTarget(GamePartyJoinTarget? target)
    {
        if (target is null || target.Kind is not ("global-hub" or "private-college") ||
            string.IsNullOrWhiteSpace(target.Leader) || target.Leader.Length > 64 ||
            target.MemberCount < 1 || target.MemberCount > 16 ||
            target.Status is not ("hub" or "playing") ||
            target.Visibility is not ("invite-only" or "private" or "public") ||
            target.Content is null || !Sha256Regex().IsMatch(target.Content.ManifestSha256) ||
            target.Content.Mods is null || target.Content.Mods.Length > 128)
        {
            return false;
        }
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        return target.Content.Mods.All(mod =>
            !string.IsNullOrWhiteSpace(mod.Id) && mod.Id.Length <= 128 && ids.Add(mod.Id) &&
            !string.IsNullOrWhiteSpace(mod.Name) && mod.Name.Length <= 80 &&
            !string.IsNullOrWhiteSpace(mod.Slug) && mod.Slug.Length <= 80 &&
            !string.IsNullOrWhiteSpace(mod.Version) && mod.Version.Length <= 64 &&
            Sha256Regex().IsMatch(mod.ContentSha256 ?? string.Empty) &&
            mod.Assets is not null && mod.Assets.Length <= 64 && mod.Assets.All(asset =>
                asset.ByteLength is > 0 and <= 1024 * 1024 &&
                string.Equals(asset.ModId, mod.Id, StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(asset.Path) && asset.Path.Length <= 240 &&
                asset.Path.StartsWith("sprites/", StringComparison.Ordinal) &&
                asset.Path.EndsWith(".png", StringComparison.Ordinal) &&
                Sha256Regex().IsMatch(asset.Sha256 ?? string.Empty)));
    }

    private static bool ValidToken(string? value) =>
        value is not null && PartyTokenRegex().IsMatch(value);

    private static async Task<SupervisorProvisionResponse> ReadPrivateProvisionResponseAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<SupervisorProvisionResponse>(
                    JsonOptions,
                    cancellationToken)
                ?? throw new JsonException("The response was empty.");
        }
        catch (JsonException exception)
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid response.",
                exception);
        }
    }

    private static Uri? ParseAbsoluteUri(string? value, string requiredScheme)
    {
        if (!Uri.TryCreate(value?.Trim(), UriKind.Absolute, out var uri) ||
            !string.Equals(uri.Scheme, requiredScheme, StringComparison.Ordinal) ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment) ||
            string.IsNullOrEmpty(uri.Host))
        {
            return null;
        }
        return uri;
    }

    [GeneratedRegex("^/game-sessions/[A-Za-z0-9_-]{32}$", RegexOptions.CultureInvariant)]
    private static partial Regex GameSessionPath();

    [GeneratedRegex("^/game-hub$", RegexOptions.CultureInvariant)]
    private static partial Regex GameHubPath();

    [GeneratedRegex("^[A-Za-z0-9_-]{8,128}$", RegexOptions.CultureInvariant)]
    private static partial Regex PartyTokenRegex();

    [GeneratedRegex("^(?:[A-Za-z0-9_-]{43}|sdrpr[12]\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{43})$", RegexOptions.CultureInvariant)]
    private static partial Regex PartyRejoinTokenRegex();

    [GeneratedRegex("^[a-f0-9]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex Sha256Regex();

    private sealed record SupervisorProvisionResponse(
        string? Credential,
        string? Path,
        string? SessionKind);

    private sealed record PartyErrorResponse(string? Error);

}

public sealed record ProvisionedGameEndpoint(
    string Url,
    string Credential,
    string SessionKind);

public sealed record SharedHubStats(int Players, int Parties, int Runs);

public sealed record PublicGameParty(
    string Id,
    string Leader,
    string[] Members,
    int MemberCount,
    int MaxMembers,
    string Status,
    string Visibility,
    string? BoneyardName);

public sealed record PublicGamePartyDirectory(PublicGameParty[] Items);

public sealed record ConnectedGamePlayer(
    string DisplayName,
    string? AccountUsername,
    bool Bot,
    bool Developer,
    string Session,
    string Activity,
    string? BoneyardName,
    int? WaveNumber,
    string? PartyLeader,
    int? PartySize);

public sealed record ConnectedGamePlayerDirectory(ConnectedGamePlayer[] Items);

public sealed record DeveloperGameMatch(
    string Id,
    string Session,
    string BoneyardName,
    int WaveNumber,
    string Visibility,
    string PartyLeader,
    int PlayerCount,
    string[] Players);

public sealed record DeveloperGameMatchDirectory(DeveloperGameMatch[] Items);

public sealed record GamePartyJoinRequester(
    string? AccountUsername,
    string DisplayName,
    string RequesterId);

public sealed record GamePartyAsset(
    int ByteLength,
    string ModId,
    string Path,
    string? Sha256);

public sealed record GamePartyMod(
    GamePartyAsset[] Assets,
    string? ContentSha256,
    string Id,
    string Name,
    string Slug,
    string Version);

public sealed record GamePartyContent(string ManifestSha256, GamePartyMod[] Mods);

public sealed record GamePartyJoinTarget(
    GamePartyContent? Content,
    string Kind,
    string Leader,
    int MemberCount,
    string Status,
    string Visibility);

public sealed record GamePartyJoinResolution(string IntentId, GamePartyJoinTarget Target);

public sealed record GamePartyJoinRequestReceipt(string RequestToken, string Status);

public sealed record GamePartyJoinRequestStatus(
    string Status,
    string? IntentId,
    GamePartyJoinTarget? Target);

public sealed class GameSessionUnavailableException : Exception
{
    public GameSessionUnavailableException(string message)
        : base(message)
    {
    }

    public GameSessionUnavailableException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

public sealed class GamePartyJoinException(string message, int statusCode) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
