import { useEffect, useRef, useCallback } from 'react'
import type { Phase, PlayerKey } from '@/types/game'
import * as api from '@/services/api'

interface OpponentJoinedData {
  opponent_name: string
}

interface PhaseChangeData {
  phase: Phase
  current_turn?: PlayerKey
}

interface ShotResultData {
  row: number
  col: number
  result: 'hit' | 'miss'
  sunk: string | null
  sunk_cells: number[][] | null
}

interface OpponentShotData {
  row: number
  col: number
  result: 'hit' | 'miss'
  sunk: string | null
}

interface GameOverData {
  winner: PlayerKey
}

export interface GameStreamHandlers {
  onOpponentJoined?: (data: OpponentJoinedData) => void
  onPhaseChange?: (data: PhaseChangeData) => void
  onOpponentReady?: () => void
  onShotResult?: (data: ShotResultData) => void
  onOpponentShot?: (data: OpponentShotData) => void
  onGameOver?: (data: GameOverData) => void
  onOpponentReconnected?: () => void
}

export function useGameStream(handlers: GameStreamHandlers) {
  const sseRef = useRef<EventSource | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const connect = useCallback((gameId: string, token: string) => {
    if (sseRef.current) {
      sseRef.current.close()
    }

    const es = api.createSSE(gameId, token)
    sseRef.current = es

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const { type, data } = payload
        const h = handlersRef.current

        switch (type) {
          case 'connected':
            break
          case 'opponent_joined':
            h.onOpponentJoined?.(data)
            break
          case 'phase_change':
            h.onPhaseChange?.(data)
            break
          case 'opponent_ready':
            h.onOpponentReady?.()
            break
          case 'shot_result':
            h.onShotResult?.(data)
            break
          case 'opponent_shot':
            h.onOpponentShot?.(data)
            break
          case 'game_over':
            h.onGameOver?.(data)
            break
          case 'opponent_reconnected':
            h.onOpponentReconnected?.()
            break
        }
      } catch {
        // Ignore parse errors (heartbeats)
      }
    }

    es.onerror = () => {
      // EventSource auto-reconnects
    }
  }, [])

  const disconnect = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close()
      }
    }
  }, [])

  return { connect, disconnect }
}
