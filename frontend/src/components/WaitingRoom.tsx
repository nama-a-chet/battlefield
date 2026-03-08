import { useState } from 'react'
import { Clock, Clipboard, Check } from '@/icons'
import './WaitingRoom.css'

const COPY_FEEDBACK_DURATION_MS = 2000

interface Props {
  code: string
  onCancel: () => void
}

export default function WaitingRoom({ code, onCancel }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS)
    } catch {
      // Fallback: select text
    }
  }

  return (
    <div className="waiting-room">
      <div className="waiting-icon">
        <Clock width={40} height={40} />
      </div>

      <h2 className="waiting-title">WAITING FOR OPPONENT</h2>
      <p className="waiting-subtitle">Share this code with your opponent</p>

      <div className="game-code-display">
        {code.split('').map((char, i) => (
          <span key={i} className="code-char">{char}</span>
        ))}
      </div>

      <button className="secondary-btn" onClick={handleCopy}>
        {copied ? <Check width={16} height={16} /> : <Clipboard width={16} height={16} />}
        <span>{copied ? 'COPIED!' : 'COPY CODE'}</span>
      </button>

      <div className="waiting-dots">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>

      <button className="text-btn" onClick={onCancel}>CANCEL</button>
    </div>
  )
}
