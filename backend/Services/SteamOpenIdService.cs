using System.Text.RegularExpressions;

namespace SolomonDarkRevived.Services;

public sealed partial class SteamOpenIdService(HttpClient httpClient)
{
    private const string SteamOpenIdEndpoint = "https://steamcommunity.com/openid/login";
    private const string OpenIdNamespace = "http://specs.openid.net/auth/2.0";
    private const string IdentifierSelect = "http://specs.openid.net/auth/2.0/identifier_select";

    public string CreateAuthorizationUrl(string realm, string returnTo)
    {
        var parameters = new Dictionary<string, string>
        {
            ["openid.ns"] = OpenIdNamespace,
            ["openid.mode"] = "checkid_setup",
            ["openid.return_to"] = returnTo,
            ["openid.realm"] = realm,
            ["openid.identity"] = IdentifierSelect,
            ["openid.claimed_id"] = IdentifierSelect
        };
        return SteamOpenIdEndpoint + "?" + string.Join('&', parameters.Select(pair =>
            $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
    }

    public async Task<string?> ValidateAsync(
        IQueryCollection query,
        string expectedReturnTo,
        CancellationToken cancellationToken)
    {
        var claimedId = query["openid.claimed_id"].ToString();
        if (query["openid.mode"] != "id_res" ||
            query["openid.ns"] != OpenIdNamespace ||
            query["openid.op_endpoint"] != SteamOpenIdEndpoint ||
            query["openid.return_to"] != expectedReturnTo ||
            query["openid.identity"] != claimedId)
        {
            return null;
        }

        var match = SteamClaimedIdPattern().Match(claimedId);
        if (!match.Success || !ulong.TryParse(match.Groups[1].Value, out var steamId) || steamId == 0)
        {
            return null;
        }

        var validation = query
            .Where(pair => pair.Key.StartsWith("openid.", StringComparison.Ordinal))
            .ToDictionary(pair => pair.Key, pair => pair.Value.ToString(), StringComparer.Ordinal);
        validation["openid.mode"] = "check_authentication";
        using var response = await httpClient.PostAsync(
            SteamOpenIdEndpoint,
            new FormUrlEncodedContent(validation),
            cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        return body.Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Any(line => string.Equals(line.Trim(), "is_valid:true", StringComparison.Ordinal))
            ? steamId.ToString()
            : null;
    }

    [GeneratedRegex("^https://steamcommunity\\.com/openid/id/([0-9]{16,20})$")]
    private static partial Regex SteamClaimedIdPattern();
}
