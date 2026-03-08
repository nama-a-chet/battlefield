import type { CreateGameResponse, JoinGameResponse, GameState, FireResponse, ShipPlacement } from '@/types/game'

const BASE = import.meta.env.VITE_API_URL || '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export function createGame(playerName: string, mode: 'human' | 'ai'): Promise<CreateGameResponse> {
  return request('/games', {
    method: 'POST',
    body: JSON.stringify({ player_name: playerName, mode }),
  })
}

export function joinGame(code: string, playerName: string): Promise<JoinGameResponse> {
  return request('/games/join', {
    method: 'POST',
    body: JSON.stringify({ code, player_name: playerName }),
  })
}

export function getState(gameId: string, token: string): Promise<GameState> {
  return request(`/games/${gameId}/state`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function placeShips(
  gameId: string,
  token: string,
  ships: Record<string, ShipPlacement>,
): Promise<{ ok: boolean }> {
  return request(`/games/${gameId}/place-ships`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ships }),
  })
}

export function fire(
  gameId: string,
  token: string,
  row: number,
  col: number,
): Promise<FireResponse> {
  return request(`/games/${gameId}/fire`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ row, col }),
  })
}

export function forfeit(gameId: string, token: string): Promise<{ ok: boolean }> {
  return request(`/games/${gameId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function rematch(gameId: string, token: string): Promise<{ ok: boolean }> {
  return request(`/games/${gameId}/rematch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function createSSE(gameId: string, token: string): EventSource {
  return new EventSource(`${BASE}/games/${gameId}/stream?token=${token}`)
}
