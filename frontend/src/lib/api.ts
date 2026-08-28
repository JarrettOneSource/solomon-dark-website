// Typed client for the SDR backend (see docs/backend-spec.md).

/** The five declared Schools of Magic (profile-level; null = undeclared). */
export type School = 'fire' | 'air' | 'water' | 'ether' | 'earth'

export interface User {
  developerAccess: boolean
  id: number
  username: string
  email?: string
  school: School | null
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
  packageId: string | null
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

export interface ModSubscription {
  enabled: boolean
  createdAtUtc: string
  updatedAtUtc: string
  mod: ModSummary
}

export interface ActiveWebMod {
  assets: GameContentAsset[]
  id: string
  name: string
  slug: string
  version: string
  contentSha256: string
  priority: number
  hasLua: boolean
  boneyardCount: number
}

export interface DisabledWebMod {
  error: string
  name: string
  slug: string
}

export interface ActiveWebModSet {
  disabledMods: DisabledWebMod[]
  manifestSha256: string
  mods: ActiveWebMod[]
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

interface PublicGamePartyBase {
  cheatsEnabled: boolean
  id: string
  leader: string
  members: string[]
  memberCount: number
  maxMembers: number
  modCount: number
  sessionKind: 'global-hub' | 'private-college'
  visibility: 'invite-only' | 'public'
}

export type PublicGameParty = PublicGamePartyBase & (
  | { status: 'hub'; boneyardName: null }
  | { status: 'playing'; boneyardName: string }
)

interface ConnectedGamePlayerBase {
  displayName: string
  accountUsername: string | null
  bot: boolean
  developer: boolean
  session: 'global-hub' | 'private-college'
  partyLeader: string | null
  partySize: number | null
}

/** Developer-only presence row; the backend 404s this feed for everyone else. */
export type ConnectedGamePlayer = ConnectedGamePlayerBase & (
  | { activity: 'hub'; boneyardName: null; waveNumber: null }
  | { activity: 'boneyard'; boneyardName: string; waveNumber: number }
)

export interface DeveloperGameMatch {
  readonly boneyardName: string
  readonly id: string
  readonly partyLeader: string
  readonly playerCount: number
  readonly players: readonly string[]
  readonly session: 'global-hub' | 'private-college'
  readonly visibility: 'invite-only' | 'private' | 'public'
  readonly waveNumber: number
}

export interface GameContentAsset {
  byteLength: number
  contentType: string
  kind: string
  modId: string
  path: string
  sha256: string
}

export interface PartyJoinMod {
  assets: GameContentAsset[]
  contentSha256: string
  id: string
  name: string
  slug: string
  version: string
}

export interface PartyJoinTarget {
  cheatsEnabled: boolean
  content: {
    manifestSha256: string
    mods: PartyJoinMod[]
  }
  kind: 'global-hub' | 'private-college'
  leader: string
  memberCount: number
  status: 'hub' | 'playing'
  visibility: 'invite-only' | 'private' | 'public'
}

export interface PartyJoinResolution {
  intentId: string
  target: PartyJoinTarget
}

export type PartyJoinRequestStatus =
  | { status: 'pending' | 'denied' }
  | { status: 'accepted'; intentId: string; target: PartyJoinTarget }

export interface ProvisionedGameEndpointResponse {
  credential: string
  kind: 'remote'
  sessionKind: 'global-hub' | 'private-college'
  url: string
}

export interface WebGameSave {
  slot: number
  formatVersion: number
  revision: number
  document: string
  size: number
  sha256: string
  updatedAtUtc: string
}

export interface SharedMobileUiLayout {
  code: string
  layout: unknown
  author: { username: string }
  createdAtUtc: string
}

export type GameLeaderboardBoard = 'awesomeness' | 'wave' | 'kills' | 'time'

export interface GameLeaderboardEntry {
  rank: number | null
  accountUsername: string
  runId: string
  wizardName: string
  element: 'air' | 'earth' | 'ether' | 'fire' | 'water'
  discipline: 'arcane' | 'body' | 'mind'
  headingIndex: number
  portraitScale: number
  level: number
  awesomeness: number
  elapsedTicks: number
  wave: number
  monstersKilled: number
  awesomestKill: string | null
  highestSkills: readonly { skillId: number; rank: number }[]
  perksUsed: readonly number[]
  completedAtUtc: string
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
    throw new ApiError(0, 'The College is unreachable — check your connection.')
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
    subscriptions: {
      list: () => request<{ items: ModSubscription[] }>('/api/mods/subscriptions'),
      active: () => request<ActiveWebModSet>('/api/mods/active'),
      subscribe: (slug: string) =>
        request<{ enabled: boolean; slug: string; subscribed: boolean }>(
          `/api/mods/${encodeURIComponent(slug)}/subscription`,
          { method: 'PUT' },
        ),
      setEnabled: (slug: string, enabled: boolean) =>
        request<{ enabled: boolean; slug: string }>(
          `/api/mods/${encodeURIComponent(slug)}/subscription`,
          { ...json({ enabled }), method: 'PATCH' },
        ),
      sync: (mods: readonly Pick<PartyJoinMod, 'contentSha256' | 'id' | 'slug' | 'version'>[]) =>
        request<{ enabled: string[] }>('/api/mods/subscriptions/sync', json({ mods })),
      disableAll: () => request<{ disabled: number }>(
        '/api/mods/subscriptions/disable-all',
        json({}),
      ),
      unsubscribe: (slug: string) =>
        request<void>(`/api/mods/${encodeURIComponent(slug)}/subscription`, {
          method: 'DELETE',
        }),
    },
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

  gamePlayers: {
    list: () => request<{ items: ConnectedGamePlayer[] }>('/api/game/players'),
  },

  gameMatches: {
    list: () => request<{ items: DeveloperGameMatch[] }>('/api/game/matches'),
  },

  gameParties: {
    list: () => request<{ items: PublicGameParty[] }>('/api/game/parties'),
    resolveCode: (code: string) => request<PartyJoinResolution>(
      '/api/game/join/resolve',
      json({ code }),
    ),
    resolvePublic: (listingId: string) => request<PartyJoinResolution>(
      '/api/game/join/public',
      json({ listingId }),
    ),
    requestJoin: (listingId: string, displayName: string, requesterId: string) =>
      request<{ requestToken: string; status: 'pending' }>(
        '/api/game/join/requests',
        json({ displayName, listingId, requesterId }),
      ),
    requestStatus: (requestToken: string) => request<PartyJoinRequestStatus>(
      `/api/game/join/requests/${encodeURIComponent(requestToken)}`,
    ),
    admit: (intentId: string) => request<ProvisionedGameEndpointResponse>(
      '/api/game/join/admit',
      json({ intentId }),
    ),
  },

  gameSaves: {
    get: (slot: number) => request<{ save: WebGameSave | null }>(
      `/api/game/saves/${slot}`,
    ).then(({ save }) => save),
    put: (
      slot: number,
      body: { document: string; expectedRevision: number },
    ) => request<WebGameSave>(`/api/game/saves/${slot}`, { ...json(body), method: 'PUT' }),
    remove: (slot: number, expectedRevision: number) => request<void>(
      `/api/game/saves/${slot}?expectedRevision=${expectedRevision}`,
      { method: 'DELETE' },
    ),
  },

  mobileUiLayouts: {
    publish: (layout: unknown) => request<SharedMobileUiLayout>(
      '/api/game/layouts',
      json({ layout }),
    ),
    get: (code: string) => request<SharedMobileUiLayout>(
      `/api/game/layouts/${encodeURIComponent(code)}`,
    ),
  },

  gameLeaderboards: {
    list: (board: GameLeaderboardBoard) => request<{
      board: GameLeaderboardBoard
      items: GameLeaderboardEntry[]
    }>(`/api/game/leaderboards?board=${board}`),
    submit: (receipt: string) => request<GameLeaderboardEntry>(
      '/api/game/leaderboards',
      json({ receipt }),
    ),
  },
}
