// Typed client for the SDR backend (see docs/backend-spec.md).

/** The five declared Schools of Magic (profile-level; null = undeclared). */
export type School = 'fire' | 'air' | 'water' | 'ether' | 'earth'

export interface User {
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

/** "lua" = script tomes; "boneyard" = downloadable runs for the game's Boneyard shelf. */
export type ModType = 'lua' | 'boneyard'

export interface ModSummary {
  id: number
  slug: string
  name: string
  summary: string
  type: ModType
  author: { id: number; username: string; school: School | null }
  latestVersion: string
  downloads: number
  thumbnailUrl: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

export interface ModVersion {
  id: number
  version: string
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

export type MatchStatus = 'hub' | 'session'

export interface MatchSession {
  id: number
  sessionKey: string
  hostPlayer: string
  boneyard: string
  players: number
  maxPlayers: number
  status: MatchStatus
}

export interface MatchList {
  items: MatchSession[]
  playerCount: number
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
    list: (params: { search?: string; type?: ModType | ''; sort?: string; page?: number; pageSize?: number } = {}) => {
      const q = new URLSearchParams()
      if (params.search) q.set('search', params.search)
      if (params.type) q.set('type', params.type)
      if (params.sort) q.set('sort', params.sort)
      if (params.page) q.set('page', String(params.page))
      if (params.pageSize) q.set('pageSize', String(params.pageSize))
      const qs = q.toString()
      return request<ModList>(`/api/mods${qs ? `?${qs}` : ''}`)
    },
    get: (slug: string) => request<ModDetail>(`/api/mods/${encodeURIComponent(slug)}`),
    create: (form: FormData) => request<ModDetail>('/api/mods', { method: 'POST', body: form }),
    addVersion: (slug: string, form: FormData) =>
      request<ModDetail>(`/api/mods/${encodeURIComponent(slug)}/versions`, { method: 'POST', body: form }),
    remove: (slug: string) => request<void>(`/api/mods/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
    downloadUrl: (slug: string) => `/api/mods/${encodeURIComponent(slug)}/download`,
    versionDownloadUrl: (slug: string, versionId: number) =>
      `/api/mods/${encodeURIComponent(slug)}/versions/${versionId}/download`,
    /** Placeholder scheme until the loader registers its real protocol handler. */
    installUrl: (slug: string) => `sdr://install/${encodeURIComponent(slug)}`,

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
  },

  users: {
    get: (username: string) =>
      request<WizardProfile>(`/api/users/${encodeURIComponent(username)}`),
  },

  matches: {
    list: () => request<MatchList>('/api/matches'),
    eventsUrl: '/api/matches/events',
    /** Placeholder scheme until the loader registers its real protocol handler. */
    joinUrl: (sessionKey: string) => `sdr://join/${encodeURIComponent(sessionKey)}`,
  },

  stats: () => request<Stats>('/api/stats'),

  saves: {
    list: () => request<CloudSave[]>('/api/saves'),
    remove: (slot: number) => request<void>(`/api/saves/${slot}`, { method: 'DELETE' }),
    downloadUrl: (slot: number) => `/api/saves/${slot}`,
  },
}
