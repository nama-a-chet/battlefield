import { useState } from 'react'
import type { GameState, FireResponse } from '@/types/game'
import { SHIPS } from '@/types/game'
import GameBoard from './GameBoard'
import { Target, Shield, Flag } from '@/icons'
import './GamePlay.css'

interface Props {
  gameState: GameState
  onFire: (row: number, col: number) => Promise<FireResponse | null>
  onForfeit: () => void
}

function ShipStatus({ ships, sunk, label }: {
  ships: Record<string, number>
  sunk: string[]
  label: string
}) {
  return (
    <div className="ship-status">
      <div className="ship-status-label">{label}</div>
      {Object.entries(ships).map(([name, size]) => {
        const isSunk = sunk.includes(name)
        return (
          <div key={name} className={`ship-status-item ${isSunk ? 'sunk' : ''}`}>
            <span className="ship-status-name">{name.toUpperCase()}</span>
            <div className="ship-status-dots">
              {Array.from({ length: size }, (_, i) => (
                <span key={i} className={`ship-status-dot ${isSunk ? 'sunk' : ''}`} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function GamePlay({ gameState, onFire, onForfeit }: Props) {
  const [firing, setFiring] = useState(false)
  const isYourTurn = gameState.current_turn === gameState.you

  const handleFire = async (row: number, col: number) => {
    if (!isYourTurn || firing) return
    if (gameState.your_shots[row][col] !== null) return
    setFiring(true)
    await onFire(row, col)
    setFiring(false)
  }

  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false)

  return (
    <div className="gameplay">
      {/* Turn indicator */}
      <div className={`turn-indicator ${isYourTurn ? 'your-turn' : 'opponent-turn'}`}>
        {isYourTurn ? (
          <>
            <Target width={20} height={20} />
            <span>YOUR TURN — SELECT TARGET</span>
          </>
        ) : (
          <>
            <Shield width={20} height={20} />
            <span>OPPONENT'S TURN</span>
          </>
        )}
      </div>

      {/* Boards */}
      <div className="boards-container">
        <div className="board-section">
          <GameBoard
            board={gameState.your_shots}
            ships={gameState.opponent_sunk_ships}
            sunkShipNames={gameState.opponent_sunk}
            interactive={isYourTurn && !firing}
            onCellClick={handleFire}
            label="ENEMY WATERS"
          />
          <ShipStatus ships={SHIPS} sunk={gameState.opponent_sunk} label="ENEMY FLEET" />
        </div>

        <div className="boards-divider" />

        <div className="board-section">
          <GameBoard
            board={gameState.your_board}
            ships={gameState.your_ships}
            sunkShipNames={gameState.your_sunk}
            label="YOUR WATERS"
          />
          <ShipStatus ships={SHIPS} sunk={gameState.your_sunk} label="YOUR FLEET" />
        </div>
      </div>

      {/* Forfeit */}
      <div className="forfeit-area">
        {showForfeitConfirm ? (
          <div className="forfeit-confirm">
            <span>Surrender?</span>
            <button className="text-btn danger" onClick={() => { onForfeit(); setShowForfeitConfirm(false) }}>
              YES, FORFEIT
            </button>
            <button className="text-btn" onClick={() => setShowForfeitConfirm(false)}>
              CANCEL
            </button>
          </div>
        ) : (
          <button className="text-btn danger" onClick={() => setShowForfeitConfirm(true)}>
            <Flag width={14} height={14} />
            <span>FORFEIT</span>
          </button>
        )}
      </div>
    </div>
  )
}
