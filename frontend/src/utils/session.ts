const SESSION_TOKEN_KEY = 'bf_token'
const SESSION_GAME_KEY = 'bf_game_id'

export interface SessionData {
  token: string
  gameId: string
}

export function saveSession(token: string, gameId: string): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token)
  sessionStorage.setItem(SESSION_GAME_KEY, gameId)
}

export function restoreSession(): SessionData | null {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY)
  const gameId = sessionStorage.getItem(SESSION_GAME_KEY)
  if (token && gameId) return { token, gameId }
  return null
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY)
  sessionStorage.removeItem(SESSION_GAME_KEY)
}
