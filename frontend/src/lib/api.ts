// Typed client for the SDR backend (see docs/backend-spec.md).

/** The five declared Schools of Magic (profile-level; null = undeclared). */
export type School = 'fire' | 'air' | 'water' | 'ether' | 'earth'

export interface User {
  id: number
  username: string
  email?: string
  school: School | null
  steamId: string | null
  createdAtUtc: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface MeResponse {
  user: User
  modCount: number
  saveCount: number
}

/** Sort orders the Library index understands. */
export type ModSort = 'newest' | 'downloads' | 'updated' | 'name'

/** A catalogue tag in use, and how many tomes bear it. */
export interface TagCount {
  tag: string
  count: number
}

export interface ModSummary {
  id: number
  slug: string
  name: string
  summary: string
  launcherModId: string | null
  tags: string[]
  author: { id: number; username: string; school: School | null }
  latestVersion: string
  downloads: number
  /** Downloads inside the requested window — only set by mods.popular. */
  recentDownloads?: number | null
  thumbnailUrl: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

export interface ModVersion {
  id: number
  version: string
  manifestVersion: string | null
  packageSha256: string | null
  contentSha256: string | null
  changelog: string
  fileSize: number
  downloads: number
  createdAtUtc: string
}

export interface ModDetail extends ModSummary {
  description: string
  screenshots: { id: number; url: string; sortOrder: number }[]
  versions: ModVersion[]
}

export interface ModList {
  items: ModSummary[]
  total: number
  page: number
  pageSize: number
}

export interface ModComment {
  id: number
  body: string
  createdAtUtc: string
  author: { id: number; username: string; school: School | null }
}

export interface WizardProfile {
  user: { id: number; username: string; school: School | null; createdAtUtc: string }
  modCount: number
  downloadsTotal: number
  mods: ModSummary[]
}

export type LobbyPrivacy = 'public' | 'passwordProtected' | 'friendsOnly'
export type LobbyAccess = 'public' | 'password' | 'friend'
export type LobbyPhase = 'hub' | 'loading' | 'session' | 'results'

export interface LobbyBuild {
  appId: number
  protocolVersion: number
  manifestSha256: string
  loaderVersion: string
}

export interface LobbyGame {
  phase: LobbyPhase
  boneyardId: string | null
  boneyardName: string | null
  boneyardSha256: string | null
  wave: number | null
  difficulty: string | null
  elapsedSeconds: number | null
  statusText: string | null
}

/** Public KDF parameters for a warded lobby — never the hash itself. */
export interface LobbyPasswordInfo {
  algorithm: string
  iterations: number
  salt: string
}

export interface LobbyJoinInfo {
  lobbyId: string
  launchUri: string
}

export interface LobbyMod {
  id: string
  version: string
  contentSha256: string
}

export interface Lobby {
  id: number
  hostPlayer: string
  hostSteamId: string
  privacy: LobbyPrivacy
  access: LobbyAccess
  players: number
  maxPlayers: number
  lastSeenUtc: string
  expiresAtUtc: string
  build: LobbyBuild
  game: LobbyGame
  mods: LobbyMod[]
  password: LobbyPasswordInfo | null
  /** Withheld for password lobbies until authorization succeeds. */
  join: LobbyJoinInfo | null
}

/** A friends-only class the viewer is not privy to — seat counts and nothing else. */
export interface PrivateClass {
  players: number
  maxPlayers: number
}

export interface LobbyList {
  items: Lobby[]
  /** Friends-only classes withheld from this viewer (absent on older backends). */
  privateClasses?: PrivateClass[]
  playerCount: number
}

export interface LobbyAuthorization {
  lobbyId: string
  steamId: string
  ticket: string
  expiresAtUtc: string
  launchUri: string
}

export interface SteamLinkStart {
  authorizationUrl: string
  expiresAtUtc: string
}

/** A Boneyard editor draft as listed (bodies omitted; see BONEYARD_API.md). */
export interface BoneyardDraftSummary {
  id: number
  name: string
  updatedAt: string
  documentSize: number
  compiledSize: number | null
}

export interface BoneyardDraft extends BoneyardDraftSummary {
  /** The editor's semantic document; opaque to the server. */
  document: unknown
  /** Base64 native container, when one has been compiled. */
  compiledBoneyard: string | null
  createdAt: string
}

export interface Stats {
  matchesLive: number
  wizardsOnline: number
  tomes: number
  savesSynced: number
  enrolled: number
  downloadsTotal: number
}

export interface CloudSave {
  slot: number
  name: string | null
  size: number
  uncompressedSize: number
  fileCount: number
  formatVersion: number
  sha256: string
  updatedAtUtc: string
}

const TOKEN_KEY = 'sdr.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'The College is unreachable. Check your crystal ball (network).')
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const api = {
  register: (username: string, email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', json({ username, email, password })),
  login: (usernameOrEmail: string, password: string) =>
    request<AuthResponse>('/api/auth/login', json({ usernameOrEmail, password })),
  me: () => request<MeResponse>('/api/auth/me'),
  setSchool: (school: School | null) =>
    request<{ user: User }>('/api/auth/school', { ...json({ school }), method: 'PUT' }),

  mods: {
    list: (params: { search?: string; tags?: string[]; sort?: ModSort; page?: number; pageSize?: number } = {}) => {
      const q = new URLSearchParams()
      if (params.search) q.set('search', params.search)
      for (const tag of params.tags ?? []) q.append('tag', tag)
      if (params.sort) q.set('sort', params.sort)
      if (params.page) q.set('page', String(params.page))
      if (params.pageSize) q.set('pageSize', String(params.pageSize))
      const qs = q.toString()
      return request<ModList>(`/api/mods${qs ? `?${qs}` : ''}`)
    },
    get: (slug: string) => request<ModDetail>(`/api/mods/${encodeURIComponent(slug)}`),
    /** Tags currently in use across the Library, busiest first. */
    tagIndex: () => request<{ items: TagCount[] }>('/api/tags'),
    /** The most-taken tomes inside a 30/60/90-day window, at most eight. */
    popular: (days: 30 | 60 | 90 = 30) =>
      request<{ days: number; items: ModSummary[] }>(`/api/mods/popular?days=${days}`),
    create: (form: FormData) => request<ModDetail>('/api/mods', { method: 'POST', body: form }),
    update: (
      slug: string,
      patch: { name?: string; summary?: string; description?: string; tags?: string[] },
    ) =>
      request<ModDetail>(`/api/mods/${encodeURIComponent(slug)}`, {
        ...json(patch),
        method: 'PATCH',
      }),
    addVersion: (slug: string, form: FormData) =>
      request<ModDetail>(`/api/mods/${encodeURIComponent(slug)}/versions`, { method: 'POST', body: form }),
    remove: (slug: string) => request<void>(`/api/mods/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
    downloadUrl: (slug: string) => `/api/mods/${encodeURIComponent(slug)}/download`,
    versionDownloadUrl: (slug: string, versionId: number) =>
      `/api/mods/${encodeURIComponent(slug)}/versions/${versionId}/download`,
    comments: {
      list: (slug: string) =>
        request<{ items: ModComment[]; total: number }>(
          `/api/mods/${encodeURIComponent(slug)}/comments`,
        ),
      add: (slug: string, body: string) =>
        request<ModComment>(`/api/mods/${encodeURIComponent(slug)}/comments`, json({ body })),
      remove: (slug: string, id: number) =>
        request<void>(`/api/mods/${encodeURIComponent(slug)}/comments/${id}`, { method: 'DELETE' }),
    },

    screenshots: {
      add: (slug: string, form: FormData) =>
        request<ModDetail>(`/api/mods/${encodeURIComponent(slug)}/screenshots`, {
          method: 'POST',
          body: form,
        }),
      remove: (slug: string, id: number) =>
        request<void>(`/api/mods/${encodeURIComponent(slug)}/screenshots/${id}`, {
          method: 'DELETE',
        }),
      reorder: (slug: string, ids: number[]) =>
        request<ModDetail>(`/api/mods/${encodeURIComponent(slug)}/screenshots/order`, {
          ...json({ ids }),
          method: 'PUT',
        }),
    },
  },

  users: {
    get: (username: string) =>
      request<WizardProfile>(`/api/users/${encodeURIComponent(username)}`),
  },

  lobbies: {
    list: () => request<LobbyList>('/api/lobbies'),
    eventsUrl: '/api/lobbies/events',
    authorize: (id: number, passwordHash: string) =>
      request<LobbyAuthorization>(`/api/lobbies/${id}/authorize`, json({ passwordHash })),
  },

  steam: {
    link: (returnPath: string) =>
      request<SteamLinkStart>('/api/auth/steam/link', json({ returnPath })),
    unlink: () => request<void>('/api/auth/steam', { method: 'DELETE' }),
  },

  /** The Boneyard editor's cloud drafts (JWT, owner-only). */
  boneyards: {
    list: () => request<BoneyardDraftSummary[]>('/api/boneyards'),
    create: (name: string) => request<BoneyardDraft>('/api/boneyards', json({ name })),
    get: (id: number) => request<BoneyardDraft>(`/api/boneyards/${id}`),
    update: (
      id: number,
      patch: { name?: string; document?: unknown; compiledBoneyard?: string | null },
    ) => request<BoneyardDraft>(`/api/boneyards/${id}`, { ...json(patch), method: 'PUT' }),
    remove: (id: number) => request<void>(`/api/boneyards/${id}`, { method: 'DELETE' }),
    publish: (
      id: number,
      body: { name: string; slug?: string; summary: string; description: string; waveText?: string },
    ) => request<ModDetail>(`/api/boneyards/${id}/publish`, json(body)),
  },

  stats: () => request<Stats>('/api/stats'),

  saves: {
    list: () => request<CloudSave[]>('/api/saves'),
    remove: (slot: number) => request<void>(`/api/saves/${slot}`, { method: 'DELETE' }),
    downloadUrl: (slot: number) => `/api/saves/${slot}`,
  },
}
