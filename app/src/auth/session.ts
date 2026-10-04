import type { RoleId, User } from '@/types'

// Demo-mode session held in sessionStorage. A real build would hold an access token
// from the identity provider and fetch the user profile from the API.
const KEY = 'aiia.session'

let current: User | null = read()

function read(): User | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function getSessionUser() {
  return current
}

export function setSessionUser(u: User | null) {
  current = u
  try {
    if (u) sessionStorage.setItem(KEY, JSON.stringify(u))
    else sessionStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: session lives in memory only */
  }
}

export function withRole(u: User, role: RoleId): User {
  return { ...u, role }
}
