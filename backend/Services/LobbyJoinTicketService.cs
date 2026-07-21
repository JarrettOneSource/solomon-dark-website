using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace SolomonDarkRevived.Services;

public sealed class LobbyJoinTicketService
{
    private static readonly TimeSpan TicketLifetime = TimeSpan.FromSeconds(60);

    public LobbyJoinTicket Issue(string secretHex, string lobbyId, string steamId)
    {
        var expiresAtUtc = DateTime.UtcNow.Add(TicketLifetime);
        var expiresUnix = new DateTimeOffset(expiresAtUtc).ToUnixTimeSeconds();
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var payload = string.Join('\n', "v1", lobbyId, steamId, expiresUnix, nonce);
        using var hmac = new HMACSHA256(Convert.FromHexString(secretHex));
        var signature = Convert.ToHexString(
            hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        return new LobbyJoinTicket(
            string.Join('.', "v1", expiresUnix, steamId, nonce, signature),
            expiresAtUtc);
    }

    public bool TryValidate(
        string secretHex,
        string lobbyId,
        string? value,
        out string steamId)
    {
        steamId = string.Empty;
        var parts = value?.Split('.');
        if (parts is not { Length: 5 } ||
            parts[0] != "v1" ||
            !long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var expiresUnix) ||
            !ulong.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out var parsedSteamId) ||
            parsedSteamId == 0 ||
            parts[3].Length != 32 ||
            !IsLowerHex(parts[3]) ||
            parts[4].Length != 64 ||
            !IsLowerHex(parts[4]) ||
            DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expiresUnix)
        {
            return false;
        }

        var payload = string.Join('\n', "v1", lobbyId, parts[2], parts[1], parts[3]);
        using var hmac = new HMACSHA256(Convert.FromHexString(secretHex));
        var expected = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        var actual = Convert.FromHexString(parts[4]);
        if (!CryptographicOperations.FixedTimeEquals(expected, actual))
        {
            return false;
        }

        steamId = parts[2];
        return true;
    }

    private static bool IsLowerHex(string value) => value.All(character =>
        character is >= '0' and <= '9' or >= 'a' and <= 'f');
}

public sealed record LobbyJoinTicket(string Value, DateTime ExpiresAtUtc);
