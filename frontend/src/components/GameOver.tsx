import type { GameState } from '@/types/game'
import { Trophy, Skull, Repeat, ArrowLeft } from '@/icons'
import './GameOver.css'

interface Props {
  gameState: GameState
  onRematch: () => void
  onBackToLobby: () => void
  loading: boolean
}

export default function GameOver({ gameState, onRematch, onBackToLobby, loading }: Props) {
  const isWinner = gameState.winner === gameState.you

  // Count total shots fired
  let totalShots = 0
  let hits = 0
  for (const row of gameState.your_shots) {
    for (const cell of row) {
      if (cell !== null) {
        totalShots++
        if (cell === 'hit') hits++
      }
    }
  }
  const accuracy = totalShots > 0 ? Math.round((hits / totalShots) * 100) : 0

  return (
    <div className="game-over">
      <div className={`game-over-icon ${isWinner ? 'victory' : 'defeat'}`}>
        {isWinner ? <Trophy width={48} height={48} /> : <Skull width={48} height={48} />}
      </div>

      <h2 className={`game-over-title ${isWinner ? 'victory' : 'defeat'}`}>
        {isWinner ? 'VICTORY' : 'DEFEAT'}
      </h2>

      <p className="game-over-subtitle">
        {isWinner
          ? `You destroyed ${gameState.opponent_name || 'the enemy'}'s fleet!`
          : `${gameState.opponent_name || 'The enemy'} destroyed your fleet!`
        }
      </p>

      <div className="game-over-stats">
        <div className="stat-box">
          <span className="stat-value">{gameState.opponent_sunk.length}/5</span>
          <span className="stat-label">SHIPS SUNK</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{gameState.your_sunk.length}/5</span>
          <span className="stat-label">SHIPS LOST</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{accuracy}%</span>
          <span className="stat-label">ACCURACY</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{totalShots}</span>
          <span className="stat-label">SHOTS FIRED</span>
        </div>
      </div>

      <div className="game-over-actions">
        <button className="primary-btn" onClick={onRematch} disabled={loading}>
          <Repeat width={18} height={18} />
          <span>{loading ? 'SETTING UP...' : 'REMATCH'}</span>
        </button>
        <button className="secondary-btn" onClick={onBackToLobby}>
          <ArrowLeft width={18} height={18} />
          <span>BACK TO LOBBY</span>
        </button>
      </div>
    </div>
  )
}
