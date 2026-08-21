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

    public async Task<ProvisionedGameEndpoint> AdmitSharedHubAsync(
        CancellationToken cancellationToken)
    {
        EnsurePrivateSessionsConfigured();
        using var request = CreateAdminRequest(HttpMethod.Post, "/admin/hub/tickets");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GameSessionUnavailableException(
                $"The game session supervisor returned {(int)response.StatusCode}.");
        }

        var provisioned = await ReadPrivateProvisionResponseAsync(response, cancellationToken);
        if (!string.Equals(provisioned.Path, "/game-hub", StringComparison.Ordinal))
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid shared Hub endpoint.");
        }
        return BuildEndpoint(provisioned.Path, provisioned.Credential, GameHubPath());
    }

    private HttpRequestMessage CreateAdminRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, new Uri(supervisorUrl!, path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminSecret);
        return request;
    }

    private ProvisionedGameEndpoint BuildEndpoint(
        string? path,
        string? credential,
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

    private sealed record SupervisorProvisionResponse(string? Credential, string? Path);

}

public sealed record ProvisionedGameEndpoint(string Url, string Credential);

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
