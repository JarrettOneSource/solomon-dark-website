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
        if (string.IsNullOrEmpty(adminSecret) ||
            supervisorUrl is null ||
            publicWebSocketOrigin is null)
        {
            throw new GameSessionUnavailableException(
                "Game session provisioning is not configured.");
        }

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            new Uri(supervisorUrl, "/admin/sessions"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminSecret);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new GameSessionUnavailableException(
                $"The game session supervisor returned {(int)response.StatusCode}.");
        }

        SupervisorProvisionResponse? provisioned;
        try
        {
            provisioned = await response.Content.ReadFromJsonAsync<SupervisorProvisionResponse>(
                JsonOptions,
                cancellationToken);
        }
        catch (JsonException exception)
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid response.",
                exception);
        }

        if (provisioned is null ||
            string.IsNullOrEmpty(provisioned.Credential) ||
            provisioned.Credential.Length > 512 ||
            !GameSessionPath().IsMatch(provisioned.Path ?? string.Empty))
        {
            throw new GameSessionUnavailableException(
                "The game session supervisor returned an invalid endpoint.");
        }

        return new ProvisionedGameEndpoint(
            new Uri(publicWebSocketOrigin, provisioned.Path!).ToString(),
            provisioned.Credential);
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
