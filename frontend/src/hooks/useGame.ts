import { useState, useEffect, useCallback } from 'react'
import type { GameState, Phase, FireResponse, ShipPlacement } from '@/types/game'
import * as api from '@/services/api'
import { saveSession, restoreSession, clearSession } from '@/utils/session'
import { useGameStream } from './useGameStream'

export type Screen = 'lobby' | 'waiting' | 'setup' | 'playing' | 'finished'

/** Delay before applying AI phase change so the AI feels like it's "thinking" */
const AI_PHASE_CHANGE_DELAY_MS = 1200
/** Delay before showing AI opponent's shot result */
const AI_SHOT_DELAY_MS = 1000
/** Delay before showing human opponent's shot result */
const HUMAN_SHOT_DELAY_MS = 500

function phaseToScreen(phase: Phase): Screen {
  switch (phase) {
    case 'waiting': return 'waiting'
    case 'setup': return 'setup'
    case 'playing': return 'playing'
    case 'finished': return 'finished'
    default: return 'lobby'
  }
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'An unexpected error occurred'
}

export function useGame() {
  const [screen, setScreen] = useState<Screen>('lobby')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { connect: connectSSE, disconnect: disconnectSSE } = useGameStream({
    onOpponentJoined: (data) => {
      setGameState(prev => prev ? {
        ...prev,
        opponent_name: data.opponent_name,
        opponent_connected: true,
      } : prev)
    },

    onPhaseChange: (data) => {
      const applyPhaseChange = () => {
        setGameState(prev => prev ? {
          ...prev,
          phase: data.phase,
          current_turn: data.current_turn || prev.current_turn,
        } : prev)
        setScreen(phaseToScreen(data.phase))
      }
      // Delay turn change back to player in AI games so the AI feels like it's "thinking"
      setGameState(prev => {
        if (prev && prev.mode === 'ai' && data.phase === 'playing' && data.current_turn === prev.you) {
          setTimeout(applyPhaseChange, AI_PHASE_CHANGE_DELAY_MS)
        } else {
          applyPhaseChange()
        }
        return prev
      })
    },

    onOpponentReady: () => {
      setGameState(prev => prev ? { ...prev, opponent_ready: true } : prev)
    },

    onShotResult: (data) => {
      setGameState(prev => {
        if (!prev) return prev
        const newShots = prev.your_shots.map(row => [...row])
        newShots[data.row][data.col] = data.result
        const newSunk = data.sunk && !prev.opponent_sunk.includes(data.sunk)
          ? [...prev.opponent_sunk, data.sunk]
          : prev.opponent_sunk
        const newSunkShips = data.sunk && data.sunk_cells
          ? { ...prev.opponent_sunk_ships, [data.sunk]: data.sunk_cells }
          : prev.opponent_sunk_ships
        return { ...prev, your_shots: newShots, opponent_sunk: newSunk, opponent_sunk_ships: newSunkShips }
      })
    },

    onOpponentShot: (data) => {
      setGameState(prev => {
        const delay = prev?.mode === 'ai' ? AI_SHOT_DELAY_MS : HUMAN_SHOT_DELAY_MS
        setTimeout(() => {
          setGameState(p => {
            if (!p) return p
            const newBoard = p.your_board.map(row => [...row])
            newBoard[data.row][data.col] = data.result
            const newSunk = data.sunk && !p.your_sunk.includes(data.sunk)
              ? [...p.your_sunk, data.sunk]
              : p.your_sunk
            return { ...p, your_board: newBoard, your_sunk: newSunk }
          })
        }, delay)
        return prev
      })
    },

    onGameOver: (data) => {
      setGameState(prev => prev ? {
        ...prev,
        phase: 'finished',
        winner: data.winner,
      } : prev)
      setScreen('finished')
    },

    onOpponentReconnected: () => {
      setGameState(prev => prev ? { ...prev, opponent_connected: true } : prev)
    },
  })

  // Restore session on mount
  useEffect(() => {
    const session = restoreSession()
    if (!session) return

    api.getState(session.gameId, session.token)
      .then(state => {
        setToken(session.token)
        setGameId(session.gameId)
        setGameState(state)
        setScreen(phaseToScreen(state.phase))
        connectSSE(session.gameId, session.token)
      })
      .catch(() => {
        clearSession()
      })
  }, [connectSSE])

  const handleCreateGame = useCallback(async (name: string, mode: 'human' | 'ai') => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.createGame(name, mode)
      setToken(res.token)
      setGameId(res.game_id)
      saveSession(res.token, res.game_id)

      const state = await api.getState(res.game_id, res.token)
      setGameState(state)
      setScreen(phaseToScreen(state.phase))
      connectSSE(res.game_id, res.token)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [connectSSE])

  const handleJoinGame = useCallback(async (code: string, name: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.joinGame(code, name)
      setToken(res.token)
      setGameId(res.game_id)
      saveSession(res.token, res.game_id)

      const state = await api.getState(res.game_id, res.token)
      setGameState(state)
      setScreen(phaseToScreen(state.phase))
      connectSSE(res.game_id, res.token)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [connectSSE])

  const handlePlaceShips = useCallback(async (ships: Record<string, ShipPlacement>) => {
    if (!gameId || !token) return
    setLoading(true)
    setError(null)
    try {
      await api.placeShips(gameId, token, ships)
      const state = await api.getState(gameId, token)
      setGameState(state)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [gameId, token])

  const handleFire = useCallback(async (row: number, col: number): Promise<FireResponse | null> => {
    if (!gameId || !token) return null
    setError(null)
    try {
      const result = await api.fire(gameId, token, row, col)
      // Update shots grid immediately from HTTP response
      setGameState(prev => {
        if (!prev) return prev
        const newShots = prev.your_shots.map(r => [...r])
        newShots[row][col] = result.result
        const newSunk = result.sunk && !prev.opponent_sunk.includes(result.sunk)
          ? [...prev.opponent_sunk, result.sunk]
          : prev.opponent_sunk
        const newSunkShips = result.sunk && result.sunk_cells
          ? { ...prev.opponent_sunk_ships, [result.sunk]: result.sunk_cells }
          : prev.opponent_sunk_ships
        // In AI mode, flip turn to opponent so UI shows "OPPONENT'S TURN" while AI "thinks"
        const current_turn = prev.mode === 'ai' && !result.game_over
          ? (prev.you === 'player1' ? 'player2' : 'player1')
          : prev.current_turn
        return { ...prev, your_shots: newShots, opponent_sunk: newSunk, opponent_sunk_ships: newSunkShips, current_turn }
      })
      if (result.game_over) {
        setGameState(prev => prev ? { ...prev, phase: 'finished', winner: result.winner } : prev)
        setScreen('finished')
      }
      return result
    } catch (e: unknown) {
      setError(getErrorMessage(e))
      return null
    }
  }, [gameId, token])

  const handleForfeit = useCallback(async () => {
    if (!gameId || !token) return
    try {
      await api.forfeit(gameId, token)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    }
  }, [gameId, token])

  const handleRematch = useCallback(async () => {
    if (!gameId || !token) return
    setLoading(true)
    setError(null)
    try {
      await api.rematch(gameId, token)
      const state = await api.getState(gameId, token)
      setGameState(state)
    } catch (e: unknown) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [gameId, token])

  const backToLobby = useCallback(() => {
    disconnectSSE()
    clearSession()
    setScreen('lobby')
    setGameState(null)
    setGameId(null)
    setToken(null)
    setError(null)
  }, [disconnectSSE])

  const clearError = useCallback(() => setError(null), [])

  return {
    screen,
    gameState,
    gameId,
    token,
    error,
    loading,
    createGame: handleCreateGame,
    joinGame: handleJoinGame,
    placeShips: handlePlaceShips,
    fire: handleFire,
    forfeit: handleForfeit,
    rematch: handleRematch,
    backToLobby,
    clearError,
  }
}
