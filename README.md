# Solomon Dark Revived

Community hub for the Solomon Dark revival: multiplayer server browser
("the Boneyards"), mod library ("the Library"), and SDR accounts with cloud
saves ("the Annals"). See `design.md` for the full design document.

- Live website: [solomon.genericproject.xyz](https://solomon.genericproject.xyz)
- Mod loader and releases: [JarrettOneSource/solomons-dark-modding](https://github.com/JarrettOneSource/solomons-dark-modding)

This repository contains the website. The mod loader is maintained separately
in `solomons-dark-modding`.

## Stack

- **backend/** — ASP.NET Core (net10), minimal APIs, EF Core + SQLite,
  JWT auth. Runtime data (db, mod zips, saves) lives in `backend/data/`
  (gitignored). API spec: `docs/backend-spec.md`.
- **frontend/** — Vite + React + TypeScript + Tailwind v4. Game art extracted
  from the preserved Solomon Dark 0.72.5 atlases via `tools/extract-assets.sh`.

## Development

```bash
# terminal 1 — API on :5210 (seeds demo data on first run in Development)
cd backend && dotnet run

# terminal 2 — Vite dev server on :5173, proxies /api and /uploads to :5210
cd frontend && npm install && npm run dev
```

Seed logins: `Sirmin` / `password123` (has saves + mods), `Griselda` / `password123`.

## Production build

```bash
cd frontend && npm run build      # emits into backend/wwwroot
cd ../backend && dotnet publish -c Release
```

The published server serves the SPA from wwwroot with client-side routing
fallback; `/api/*` never falls back to HTML. Set `Jwt:Secret` and
`Storage:Root` through deployment-local configuration. Runtime databases,
uploads, saves, credentials, and deployment configuration must remain outside
the repository.

## Asset provenance

Website art is cut from the game's own atlases (Title/UI/Skills/College) in the
[Raptisoft-Solomon preservation repo](https://github.com/JayMcArthur/Raptisoft-Solomon).
Re-run `tools/extract-assets.sh <path-to-0.72.5-images>` to regenerate
`frontend/src/assets/game/`. Fan preservation project — original game content
© Raptisoft.
