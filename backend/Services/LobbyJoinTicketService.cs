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
}

public sealed record LobbyJoinTicket(string Value, DateTime ExpiresAtUtc);
