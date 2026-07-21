using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace SolomonDarkRevived.Services;

public sealed class SteamTicketVerifier(HttpClient http, IConfiguration configuration)
{
    public const string TicketIdentity = "solomon-dark-directory-v1";
    private const string AuthenticatePath = "ISteamUserAuth/AuthenticateUserTicket/v1/";

    public async Task<SteamTicketVerification> VerifyAsync(
        string ticket,
        CancellationToken cancellationToken)
    {
        var apiKey = configuration["Steam:WebApiKey"]?.Trim();
        if (string.IsNullOrEmpty(apiKey))
        {
            return SteamTicketVerification.Unavailable(
                "Steam ticket verification is not configured.");
        }

        var path = AuthenticatePath +
            $"?appid={SteamApplication.AppId}&ticket={Uri.EscapeDataString(ticket)}" +
            $"&identity={Uri.EscapeDataString(TicketIdentity)}";
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation("x-webapi-key", apiKey);

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            return SteamTicketVerification.Unavailable(
                "Steam ticket verification is temporarily unavailable.");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return SteamTicketVerification.Unavailable(
                "Steam ticket verification timed out.");
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                return SteamTicketVerification.Unavailable(
                    "Steam ticket verification is temporarily unavailable.");
            }

            SteamAuthenticationEnvelope? payload;
            try
            {
                payload = await response.Content.ReadFromJsonAsync<SteamAuthenticationEnvelope>(
                    cancellationToken);
            }
            catch (System.Text.Json.JsonException)
            {
                return SteamTicketVerification.Unavailable(
                    "Steam returned an unreadable authentication response.");
            }

            var parameters = payload?.Response?.Parameters;
            if (parameters?.Result == "OK" &&
                ulong.TryParse(parameters.SteamId, out var steamId) &&
                steamId != 0)
            {
                return SteamTicketVerification.Verified(steamId.ToString());
            }

            return payload?.Response?.Error is not null
                ? SteamTicketVerification.Rejected("Steam rejected that authentication ticket.")
                : SteamTicketVerification.Unavailable(
                    "Steam returned an incomplete authentication response.");
        }
    }

    private sealed record SteamAuthenticationEnvelope(
        SteamAuthenticationResponse? Response);

    private sealed record SteamAuthenticationResponse(
        [property: JsonPropertyName("params")] SteamAuthenticationParameters? Parameters,
        SteamAuthenticationError? Error);

    private sealed record SteamAuthenticationParameters(
        string? Result,
        [property: JsonPropertyName("steamid")] string? SteamId);

    private sealed record SteamAuthenticationError(
        [property: JsonPropertyName("errorcode")] int ErrorCode,
        [property: JsonPropertyName("errordesc")] string? Description);
}

public sealed record SteamTicketVerification(
    SteamTicketVerificationStatus Status,
    string? SteamId,
    string Error)
{
    public static SteamTicketVerification Verified(string steamId) =>
        new(SteamTicketVerificationStatus.Verified, steamId, string.Empty);

    public static SteamTicketVerification Rejected(string error) =>
        new(SteamTicketVerificationStatus.Rejected, null, error);

    public static SteamTicketVerification Unavailable(string error) =>
        new(SteamTicketVerificationStatus.Unavailable, null, error);
}

public enum SteamTicketVerificationStatus
{
    Verified,
    Rejected,
    Unavailable
}
