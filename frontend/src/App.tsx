import { useState, useEffect } from 'react'
import { Sun, Moon, Ship, Anchor, Zap, Gamepad, User, Users, Login, ArrowRight } from '@/icons'
import { GAME_CODE_LENGTH, NAME_MAX_LENGTH } from '@/types/game'
import PixelParticles from '@/components/PixelParticles'
import WaitingRoom from '@/components/WaitingRoom'
import ShipPlacement from '@/components/ShipPlacement'
import GamePlay from '@/components/GamePlay'
import GameOver from '@/components/GameOver'
import { useGame } from '@/hooks/useGame'
import '@/styles/base.css'
import '@/styles/buttons.css'
import '@/styles/forms.css'

type Mode = 'start' | 'join'
type Opponent = 'human' | 'ai'
type Theme = 'dark' | 'light'

function App() {
  const [mode, setMode] = useState<Mode>('start')
  const [opponent, setOpponent] = useState<Opponent>('ai')
  const [name, setName] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [theme, setTheme] = useState<Theme>('light')

  const [nameError, setNameError] = useState('')

  const game = useGame()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleStart = async () => {
    if (!name.trim()) {
      setNameError('Name required')
      return
    }
    setNameError('')
    await game.createGame(name.trim(), opponent)
  }

  const handleJoin = async () => {
    if (!name.trim()) {
      setNameError('Name required')
      return
    }
    setNameError('')
    if (gameCode.length !== GAME_CODE_LENGTH) return
    await game.joinGame(gameCode, name.trim())
  }

  const renderScreen = () => {
    switch (game.screen) {
      case 'waiting':
        return (
          <div className="card game-card">
            <div className="pixel-corner pc-tl" />
            <div className="pixel-corner pc-tr" />
            <div className="pixel-corner pc-bl" />
            <div className="pixel-corner pc-br" />
            <WaitingRoom
              code={game.gameState?.code || ''}
              onCancel={game.backToLobby}
            />
          </div>
        )

      case 'setup':
        return (
          <ShipPlacement
            gameId={game.gameId}
            onConfirm={game.placeShips}
            loading={game.loading}
            opponentReady={game.gameState?.opponent_ready ?? false}
            yourReady={game.gameState?.your_ready}
          />
        )

      case 'playing':
        if (!game.gameState) return null
        return (
          <GamePlay
            gameState={game.gameState}
            onFire={game.fire}
            onForfeit={game.forfeit}
          />
        )

      case 'finished':
        if (!game.gameState) return null
        return (
          <div className="card game-card">
            <div className="pixel-corner pc-tl" />
            <div className="pixel-corner pc-tr" />
            <div className="pixel-corner pc-bl" />
            <div className="pixel-corner pc-br" />
            <GameOver
              gameState={game.gameState}
              onRematch={game.rematch}
              onBackToLobby={game.backToLobby}
              loading={game.loading}
            />
          </div>
        )

      default:
        return (
          <div className="card">
            <div className="pixel-corner pc-tl" />
            <div className="pixel-corner pc-tr" />
            <div className="pixel-corner pc-bl" />
            <div className="pixel-corner pc-br" />

            {/* Title */}
            <div className="title-section">
              <div className="title-icon">
                <Ship width={32} height={32} />
              </div>
              <div className="pixel-title-wrapper">
                <h1 className="pixel-title">
                  <span className="pixel-title-top">CHET'S</span>
                  <span className="pixel-title-bottom">BATTLE<span className="title-accent">FIELD</span></span>
                </h1>
              </div>
              <div className="title-underline">
                <span className="pixel-dot" />
                <span className="pixel-line" />
                <span className="pixel-dot" />
              </div>
              <p className="subtitle">
                <Anchor width={12} height={12} />
                <span>NAVAL WARFARE // 10x10 GRID</span>
                <Anchor width={12} height={12} />
              </p>
            </div>

            {/* Mode toggle */}
            <div className="toggle-wrapper">
              <div className="toggle-track">
                <div className={`toggle-thumb ${mode === 'join' ? 'toggle-right' : ''}`} />
                <button
                  className={`toggle-option ${mode === 'start' ? 'active' : ''}`}
                  onClick={() => setMode('start')}
                >
                  <Zap width={16} height={16} />
                  <span>START</span>
                </button>
                <button
                  className={`toggle-option ${mode === 'join' ? 'active' : ''}`}
                  onClick={() => setMode('join')}
                >
                  <Login width={16} height={16} />
                  <span>JOIN</span>
                </button>
              </div>
            </div>

            {/* Form content */}
            <div className="form-section">
              {mode === 'start' ? (
                <>
                  <div className="field">
                    <label className="label">OPPONENT</label>
                    <div className="opponent-toggle">
                      <button
                        className={`opponent-btn ${opponent === 'ai' ? 'selected' : ''}`}
                        onClick={() => setOpponent('ai')}
                      >
                        <Gamepad width={28} height={28} />
                        <span>vs AI</span>
                      </button>
                      <button
                        className={`opponent-btn ${opponent === 'human' ? 'selected' : ''}`}
                        onClick={() => setOpponent('human')}
                      >
                        <Users width={28} height={28} />
                        <span>vs HUMAN</span>
                      </button>
                    </div>
                  </div>

                  <div className="field">
                    <div className="label-row">
                      <label className="label">
                        <User width={12} height={12} />
                        <span>YOUR CALLSIGN</span>
                      </label>
                      {nameError && (
                        <span className="field-error">{nameError}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      className={`input ${nameError ? 'input-error' : ''}`}
                      placeholder="ENTER NAME..."
                      value={name}
                      onChange={(e) => { setName(e.target.value); setNameError('') }}
                      maxLength={NAME_MAX_LENGTH}
                    />
                  </div>

                  <button
                    className="primary-btn"
                    onClick={handleStart}
                    disabled={game.loading}
                  >
                    <Ship width={18} height={18} />
                    <span>{game.loading ? 'DEPLOYING...' : 'DEPLOY FLEET'}</span>
                    <ArrowRight width={18} height={18} />
                  </button>
                </>
              ) : (
                <>
                  <div className="field">
                    <div className="label-row">
                      <label className="label">
                        <Login width={12} height={12} />
                        <span>GAME CODE</span>
                      </label>
                      {game.error && (
                        <span className="field-error" onClick={game.clearError}>
                          {game.error}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      className={`input code-input ${game.error ? 'input-error' : ''}`}
                      placeholder="- - - - - -"
                      value={gameCode}
                      onChange={(e) => { setGameCode(e.target.value.toUpperCase()); game.clearError() }}
                      maxLength={GAME_CODE_LENGTH}
                    />
                  </div>

                  <div className="field">
                    <div className="label-row">
                      <label className="label">
                        <User width={12} height={12} />
                        <span>YOUR CALLSIGN</span>
                      </label>
                      {nameError && (
                        <span className="field-error">{nameError}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      className={`input ${nameError ? 'input-error' : ''}`}
                      placeholder="ENTER NAME..."
                      value={name}
                      onChange={(e) => { setName(e.target.value); setNameError('') }}
                      maxLength={NAME_MAX_LENGTH}
                    />
                  </div>

                  <button
                    className="primary-btn"
                    onClick={handleJoin}
                    disabled={game.loading || gameCode.length !== GAME_CODE_LENGTH}
                  >
                    <Login width={18} height={18} />
                    <span>{game.loading ? 'JOINING...' : 'JOIN BATTLE'}</span>
                    <ArrowRight width={18} height={18} />
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="footer">
              <div className="footer-line">
                <span className="pixel-dot" />
                <span className="pixel-line" />
                <span className="pixel-dot" />
              </div>
              <p className="footer-text">CARRIER-5 // BATTLESHIP-4 // CRUISER-3 // SUB-3 // DESTROYER-2</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="container">
      <div className="grid-bg" />
      <div className="scanlines" />
      <PixelParticles />

      <div className="corner-decor top-left" />
      <div className="corner-decor top-right" />
      <div className="corner-decor bottom-left" />
      <div className="corner-decor bottom-right" />

      <button
        className="theme-toggle"
        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun width={20} height={20} />
        ) : (
          <Moon width={20} height={20} />
        )}
      </button>

      {renderScreen()}
    </div>
  )
}

export default App
