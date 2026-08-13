using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
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
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Post, "/admin/sessions");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GameSessionUnavailableException(
                $"The game session supervisor returned {(int)response.StatusCode}.");
        }

        var provisioned = await ReadPrivateProvisionResponseAsync(response, cancellationToken);
        return BuildEndpoint(provisioned.Path, provisioned.Credential);
    }

    public async Task<CreatedGameLobby> CreateLobbyAsync(
        string hostPlayer,
        CancellationToken cancellationToken)
    {
        EnsureLobbiesConfigured();
        using var request = CreateAdminRequest(HttpMethod.Post, "/admin/lobbies");
        request.Content = JsonContent.Create(new { hostPlayer });
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw LobbyFailure(response.StatusCode);
        }

        var provisioned = await ReadLobbyProvisionResponseAsync(response, cancellationToken);
        if (!IsValidLobbyId(provisioned.LobbyId))
        {
            throw InvalidLobbyResponse();
        }
        return new CreatedGameLobby(
            provisioned.LobbyId!,
            BuildLobbyEndpoint(provisioned.Path, provisioned.Credential));
    }

    public async Task<IReadOnlyList<WebGameLobby>> ListLobbiesAsync(
        CancellationToken cancellationToken)
    {
        EnsureLobbiesConfigured();
        using var request = CreateAdminRequest(HttpMethod.Get, "/admin/lobbies");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw LobbyFailure(response.StatusCode);
        }

        SupervisorLobbyList? directory;
        try
        {
            directory = await response.Content.ReadFromJsonAsync<SupervisorLobbyList>(
                JsonOptions,
                cancellationToken);
        }
        catch (JsonException exception)
        {
            throw InvalidLobbyResponse(exception);
        }
        if (directory?.Items is null || directory.Items.Any(item => !ValidLobby(item)))
        {
            throw InvalidLobbyResponse();
        }
        return directory.Items
            .Select(item => new WebGameLobby(
                item.Id!,
                item.HostPlayer!,
                item.Players,
                item.MaxPlayers,
                item.Phase!,
                item.Protocol!))
            .ToArray();
    }

    public async Task<ProvisionedGameEndpoint> JoinLobbyAsync(
        string lobbyId,
        CancellationToken cancellationToken)
    {
        EnsureLobbiesConfigured();
        using var request = CreateAdminRequest(
            HttpMethod.Post,
            $"/admin/lobbies/{lobbyId}/join");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw LobbyFailure(response.StatusCode);
        }

        var provisioned = await ReadPrivateProvisionResponseAsync(response, cancellationToken);
        return BuildLobbyEndpoint(provisioned.Path, provisioned.Credential);
    }

    public async Task CancelLobbyAsync(
        string lobbyId,
        string hostCredential,
        CancellationToken cancellationToken)
    {
        EnsureLobbiesConfigured();
        using var request = CreateAdminRequest(HttpMethod.Delete, $"/admin/lobbies/{lobbyId}");
        request.Headers.Add("X-Solomon-Dark-Host-Credential", hostCredential);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode != HttpStatusCode.NoContent)
        {
            throw LobbyFailure(response.StatusCode);
        }
    }

    public static bool IsValidLobbyId(string? value) =>
        value is not null && GameLobbyId().IsMatch(value);

    private HttpRequestMessage CreateAdminRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, new Uri(supervisorUrl!, path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminSecret);
        return request;
    }

    private ProvisionedGameEndpoint BuildLobbyEndpoint(string? path, string? credential)
    {
        try
        {
            return BuildEndpoint(path, credential);
        }
        catch (GameSessionUnavailableException exception)
        {
            throw InvalidLobbyResponse(exception);
        }
    }

    private ProvisionedGameEndpoint BuildEndpoint(string? path, string? credential)
    {
        if (string.IsNullOrEmpty(credential) ||
            credential.Length > 512 ||
            !GameSessionPath().IsMatch(path ?? string.Empty))
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid endpoint.");
        }

        return new ProvisionedGameEndpoint(
            new Uri(publicWebSocketOrigin!, path!).ToString(),
            credential);
    }

    private void EnsurePrivateSessionsConfigured()
    {
        if (!Configured())
        {
            throw new GameSessionUnavailableException(
                "Game session provisioning is not configured.");
        }
    }

    private void EnsureLobbiesConfigured()
    {
        if (!Configured())
        {
            throw new GameLobbyUnavailableException(
                StatusCodes.Status503ServiceUnavailable,
                "Web rebuild playtests are not available right now.",
                "Game session provisioning is not configured.");
        }
    }

    private bool Configured() =>
        !string.IsNullOrEmpty(adminSecret) && supervisorUrl is not null && publicWebSocketOrigin is not null;

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

    private static async Task<SupervisorLobbyProvisionResponse> ReadLobbyProvisionResponseAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<SupervisorLobbyProvisionResponse>(
                    JsonOptions,
                    cancellationToken)
                ?? throw new JsonException("The response was empty.");
        }
        catch (JsonException exception)
        {
            throw InvalidLobbyResponse(exception);
        }
    }

    private static bool ValidLobby(SupervisorLobby lobby) =>
        IsValidLobbyId(lobby.Id) &&
        !string.IsNullOrWhiteSpace(lobby.HostPlayer) &&
        lobby.HostPlayer.Length <= 64 &&
        !lobby.HostPlayer.Any(char.IsControl) &&
        lobby.Players >= 0 &&
        lobby.MaxPlayers >= 1 &&
        lobby.Players <= lobby.MaxPlayers &&
        lobby.Phase is "picking-loadout" or "hub" or "session" &&
        !string.IsNullOrEmpty(lobby.Protocol) &&
        lobby.Protocol.Length <= 128;

    private static GameLobbyUnavailableException LobbyFailure(HttpStatusCode statusCode) =>
        statusCode switch
        {
            HttpStatusCode.NotFound => new GameLobbyUnavailableException(
                StatusCodes.Status404NotFound,
                "That web playtest is no longer available."),
            HttpStatusCode.Conflict => new GameLobbyUnavailableException(
                StatusCodes.Status409Conflict,
                "That web playtest is full."),
            HttpStatusCode.Forbidden => new GameLobbyUnavailableException(
                StatusCodes.Status403Forbidden,
                "The web playtest host credential is invalid."),
            _ => new GameLobbyUnavailableException(
                StatusCodes.Status503ServiceUnavailable,
                "Web rebuild playtests are not available right now.",
                $"The game session supervisor returned {(int)statusCode}.")
        };

    private static GameLobbyUnavailableException InvalidLobbyResponse(Exception? inner = null) =>
        new(
            StatusCodes.Status503ServiceUnavailable,
            "Web rebuild playtests are not available right now.",
            "The game session supervisor returned an invalid lobby response.",
            inner);

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

    [GeneratedRegex("^[A-Za-z0-9_-]{32}$", RegexOptions.CultureInvariant)]
    private static partial Regex GameLobbyId();

    [GeneratedRegex("^/game-sessions/[A-Za-z0-9_-]{32}$", RegexOptions.CultureInvariant)]
    private static partial Regex GameSessionPath();

    private sealed record SupervisorProvisionResponse(string? Credential, string? Path);

    private sealed record SupervisorLobbyProvisionResponse(
        string? Credential,
        string? LobbyId,
        string? Path);

    private sealed record SupervisorLobbyList(SupervisorLobby[]? Items);

    private sealed record SupervisorLobby(
        string? Id,
        string? HostPlayer,
        int Players,
        int MaxPlayers,
        string? Phase,
        string? Protocol);
}

public sealed record ProvisionedGameEndpoint(string Url, string Credential);

public sealed record CreatedGameLobby(string LobbyId, ProvisionedGameEndpoint Endpoint);

public sealed record WebGameLobby(
    string Id,
    string HostPlayer,
    int Players,
    int MaxPlayers,
    string Phase,
    string Protocol);

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

public sealed class GameLobbyUnavailableException : Exception
{
    public GameLobbyUnavailableException(int statusCode, string publicMessage)
        : this(statusCode, publicMessage, publicMessage)
    {
    }

    public GameLobbyUnavailableException(
        int statusCode,
        string publicMessage,
        string message,
        Exception? innerException = null)
        : base(message, innerException)
    {
        StatusCode = statusCode;
        PublicMessage = publicMessage;
    }

    public int StatusCode { get; }

    public string PublicMessage { get; }
}
