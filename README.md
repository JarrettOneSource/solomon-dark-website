# Solomon Dark Website

## Steam ticket authentication

The backend requires a standard Steam Web API user key to verify the tickets created by the mod loader. Register a key at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) using a real domain you control.

Configure the key only on the backend:

```env
Steam__WebApiKey=YOUR_STEAM_WEB_API_KEY
```

ASP.NET maps `Steam__WebApiKey` to `Steam:WebApiKey`. Never commit the key or expose it to the frontend or mod loader.

The backend validates launcher tickets through `ISteamUserAuth/AuthenticateUserTicket` for Steam AppID `3362180` with the ticket identity `solomon-dark-directory-v1`. If the key is missing, `POST /api/auth/steam/session` returns `503 Service Unavailable` and authenticated lobby discovery is unavailable.

The domain entered during key registration is the key's administrative association, not a request-origin restriction. Changing the website domain does not require an application change; the key may be regenerated later to keep that registration current.
