import { useState, useEffect, useCallback } from 'react'
import { Lock, Script, Redo, ArrowRight, ArrowLeft, Ship } from '@/icons'
import { adminLogin, adminGetHistory, type GameHistoryRecord } from '@/services/api'
import './Admin.css'

const ADMIN_TOKEN_KEY = 'battleship_admin_token'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function reasonLabel(reason: string): { text: string; cls: string } {
  switch (reason) {
    case 'all_ships_sunk': return { text: 'SUNK', cls: 'sunk' }
    case 'forfeit': return { text: 'FORFEIT', cls: 'forfeit' }
    case 'disconnect': return { text: 'D/C', cls: 'disconnect' }
    default: return { text: reason.toUpperCase(), cls: '' }
  }
}

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_KEY) || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<GameHistoryRecord[]>([])
  const [authenticated, setAuthenticated] = useState(false)

  const fetchHistory = useCallback(async (adminToken: string) => {
    try {
      setLoading(true)
      const data = await adminGetHistory(adminToken)
      setHistory(data.games)
    } catch {
      // Token expired or invalid — clear and show login
      sessionStorage.removeItem(ADMIN_TOKEN_KEY)
      setToken('')
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Try to use stored token on mount
  useEffect(() => {
    if (token) {
      setAuthenticated(true)
      fetchHistory(token)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    if (!password.trim()) {
      setError('Password required')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await adminLogin(password)
      setToken(data.token)
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token)
      setAuthenticated(true)
      await fetchHistory(data.token)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  if (!authenticated) {
    return (
      <div className="card admin-card">
        <div className="pixel-corner pc-tl" />
        <div className="pixel-corner pc-tr" />
        <div className="pixel-corner pc-bl" />
        <div className="pixel-corner pc-br" />

        <div className="admin-login">
          <div className="admin-login-icon">
            <Lock width={48} height={48} />
          </div>

          <div className="admin-title">
            <Script width={20} height={20} />
            <span>COMMAND CENTER</span>
          </div>

          <div className="field">
            <div className="label-row">
              <label className="label">
                <Lock width={12} height={12} />
                <span>ACCESS CODE</span>
              </label>
              {error && (
                <span className="field-error" onClick={() => setError('')}>
                  {error}
                </span>
              )}
            </div>
            <input
              type="password"
              className={`input ${error ? 'input-error' : ''}`}
              placeholder="ENTER PASSWORD..."
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <button
            className="primary-btn"
            onClick={handleLogin}
            disabled={loading}
            style={{ maxWidth: 320 }}
          >
            <Lock width={18} height={18} />
            <span>{loading ? 'VERIFYING...' : 'AUTHENTICATE'}</span>
            <ArrowRight width={18} height={18} />
          </button>

          <button
            className="text-btn"
            onClick={() => { window.location.href = '/' }}
          >
            <ArrowLeft width={14} height={14} />
            <span>BACK TO LOBBY</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card admin-card">
      <div className="pixel-corner pc-tl" />
      <div className="pixel-corner pc-tr" />
      <div className="pixel-corner pc-bl" />
      <div className="pixel-corner pc-br" />

      <div className="admin-header">
        <div className="admin-title">
          <Script width={20} height={20} />
          <span>BATTLE LOG</span>
        </div>
        <div className="admin-actions">
          <span className="admin-count">{history.length} GAME{history.length !== 1 ? 'S' : ''}</span>
          <button
            className="secondary-btn"
            onClick={() => fetchHistory(token)}
            disabled={loading}
            style={{ width: 'auto', padding: '0.5rem 0.75rem' }}
          >
            <Redo width={14} height={14} />
            <span>{loading ? 'LOADING...' : 'REFRESH'}</span>
          </button>
          <button
            className="text-btn"
            onClick={() => { window.location.href = '/' }}
          >
            <ArrowLeft width={14} height={14} />
            <span>LOBBY</span>
          </button>
        </div>
      </div>

      <div className="title-underline" style={{ width: '100%' }}>
        <span className="pixel-dot" />
        <span className="pixel-line" />
        <span className="pixel-dot" />
      </div>

      {history.length === 0 ? (
        <div className="admin-empty">
          <Ship width={32} height={32} />
          <p style={{ marginTop: '0.75rem' }}>NO BATTLES RECORDED YET</p>
        </div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Player 1</th>
                <th>Player 2</th>
                <th>Winner</th>
                <th>Reason</th>
                <th>P1 Shots</th>
                <th>P2 Shots</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {history.map((g) => {
                const r = reasonLabel(g.reason)
                return (
                  <tr key={g.game_id + g.completed_at}>
                    <td>{formatDate(g.completed_at)}</td>
                    <td>
                      <span className={`mode-badge ${g.mode === 'ai' ? 'ai' : ''}`}>
                        {g.mode.toUpperCase()}
                      </span>
                    </td>
                    <td>{g.player1_name}</td>
                    <td>{g.player2_name}</td>
                    <td className="winner-cell">{g.winner_name || '-'}</td>
                    <td className="reason-cell">
                      <span className={`reason-badge ${r.cls}`}>{r.text}</span>
                    </td>
                    <td>
                      {g.player1_shots ? (
                        <span className="shots-detail">
                          <span className="hits">{g.player1_shots.hits}H</span>
                          {' / '}
                          <span className="misses">{g.player1_shots.misses}M</span>
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      {g.player2_shots ? (
                        <span className="shots-detail">
                          <span className="hits">{g.player2_shots.hits}H</span>
                          {' / '}
                          <span className="misses">{g.player2_shots.misses}M</span>
                        </span>
                      ) : '-'}
                    </td>
                    <td>{formatDuration(g.duration_seconds)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
