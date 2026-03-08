export type Phase = 'waiting' | 'setup' | 'playing' | 'finished'
export type PlayerKey = 'player1' | 'player2'
export type CellState = null | 'ship' | 'hit' | 'miss'
export type GameMode = 'human' | 'ai'
export type Direction = 'horizontal' | 'vertical'

export interface ShipPlacement {
  start: [number, number]
  direction: Direction
}

export interface ShipCells {
  [shipName: string]: number[][]
}

export interface GameState {
  game_id: string
  code: string | null
  phase: Phase
  current_turn: PlayerKey
  winner: PlayerKey | null
  you: PlayerKey
  your_name: string
  your_ships: ShipCells
  your_board: CellState[][]
  your_shots: CellState[][]
  your_ready: boolean
  your_sunk: string[]
  opponent_name: string | null
  opponent_ready: boolean
  opponent_sunk: string[]
  opponent_sunk_ships: ShipCells
  opponent_connected: boolean
  mode: GameMode
}

export interface CreateGameResponse {
  game_id: string
  token: string
  code: string
  mode: GameMode
}

export interface JoinGameResponse {
  game_id: string
  token: string
}

export interface FireResponse {
  row: number
  col: number
  result: 'hit' | 'miss'
  sunk: string | null
  sunk_cells: number[][] | null
  game_over: boolean
  winner: PlayerKey | null
}

export const SHIPS: Record<string, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
}

export const GRID_SIZE = 10
export const GAME_CODE_LENGTH = 6
export const NAME_MAX_LENGTH = 16
