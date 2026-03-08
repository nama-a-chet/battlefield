import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  trail: { x: number; y: number }[]
  state: 'flying' | 'exploding'
  explosionFrame: number
  size: number
  color: string
}

interface Debris {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  color: string
}

const COLORS = [
  '#5E38F5',
  '#7050ff',
  '#9B7AFF',
  '#3D1FBF',
]

const PIXEL = 3

function createParticle(w: number, h: number): Particle {
  // Start from a random edge
  const edge = Math.floor(Math.random() * 4)
  let x: number, y: number, vx: number, vy: number

  const speed = 0.4 + Math.random() * 0.8

  switch (edge) {
    case 0: // top
      x = Math.random() * w; y = -10
      vx = (Math.random() - 0.5) * speed
      vy = speed
      break
    case 1: // right
      x = w + 10; y = Math.random() * h
      vx = -speed
      vy = (Math.random() - 0.5) * speed
      break
    case 2: // bottom
      x = Math.random() * w; y = h + 10
      vx = (Math.random() - 0.5) * speed
      vy = -speed
      break
    default: // left
      x = -10; y = Math.random() * h
      vx = speed
      vy = (Math.random() - 0.5) * speed
  }

  const maxLife = 200 + Math.random() * 300

  return {
    x, y, vx, vy,
    life: maxLife,
    maxLife,
    trail: [],
    state: 'flying',
    explosionFrame: 0,
    size: PIXEL,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }
}

export default function PixelParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const particles: Particle[] = []
    const debris: Debris[] = []
    const MAX_PARTICLES = 5

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Spawn initial particles staggered
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = createParticle(canvas.width, canvas.height)
      p.life = p.maxLife * (0.3 + Math.random() * 0.7) // stagger lifetimes
      particles.push(p)
    }

    function spawnDebris(x: number, y: number, color: string) {
      const count = 10 + Math.floor(Math.random() * 6)
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8
        const speed = 1.5 + Math.random() * 3.5
        debris.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 35 + Math.random() * 35,
          size: Math.random() > 0.5 ? PIXEL * 2 : PIXEL,
          color: Math.random() > 0.3 ? color : '#ffffff',
        })
      }
    }

    function drawPixelRect(x: number, y: number, w: number, h: number, color: string, alpha: number) {
      ctx!.fillStyle = color
      ctx!.globalAlpha = alpha
      // Snap to pixel grid
      const sx = Math.round(x / PIXEL) * PIXEL
      const sy = Math.round(y / PIXEL) * PIXEL
      ctx!.fillRect(sx, sy, w, h)
    }

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      // Update & draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        if (p.state === 'flying') {
          // Store trail
          p.trail.push({ x: p.x, y: p.y })
          if (p.trail.length > 12) p.trail.shift()

          p.x += p.vx
          p.y += p.vy
          p.life--

          // Draw trail
          for (let t = 0; t < p.trail.length; t++) {
            const alpha = (t / p.trail.length) * 0.3
            const size = PIXEL
            drawPixelRect(p.trail[t].x, p.trail[t].y, size, size, p.color, alpha)
          }

          // Draw head
          drawPixelRect(p.x, p.y, p.size, p.size, p.color, 0.8)
          // Bright center pixel
          drawPixelRect(p.x, p.y, PIXEL, PIXEL, '#ffffff', 0.4)

          // Time to explode
          if (p.life <= 0) {
            p.state = 'exploding'
            p.explosionFrame = 0
            spawnDebris(p.x, p.y, p.color)
          }
        } else {
          // Explosion
          p.explosionFrame++
          const totalFrames = 35
          const progress = p.explosionFrame / totalFrames

          // Big white flash (first 6 frames)
          if (p.explosionFrame <= 6) {
            const flashSize = PIXEL * (3 + p.explosionFrame * 2)
            drawPixelRect(
              p.x - flashSize / 2, p.y - flashSize / 2,
              flashSize, flashSize,
              '#ffffff', 0.8 - (p.explosionFrame / 6) * 0.7
            )
          }

          // Colored glow ring (frames 2-15)
          if (p.explosionFrame >= 2 && p.explosionFrame <= 15) {
            const ringR = p.explosionFrame * PIXEL * 1.5
            const ringAlpha = 0.5 * (1 - (p.explosionFrame - 2) / 13)
            const steps = 16
            for (let s = 0; s < steps; s++) {
              const a = (Math.PI * 2 * s) / steps
              const rx = p.x + Math.cos(a) * ringR
              const ry = p.y + Math.sin(a) * ringR
              drawPixelRect(rx, ry, PIXEL, PIXEL, p.color, ringAlpha)
            }
          }

          // Cross + X pattern expanding outward
          if (p.explosionFrame <= 20) {
            const r = p.explosionFrame * PIXEL * 1.2
            const alpha = 0.7 * (1 - progress)
            const sz = PIXEL * 2

            // Cardinal directions
            drawPixelRect(p.x - r, p.y, sz, sz, p.color, alpha)
            drawPixelRect(p.x + r, p.y, sz, sz, p.color, alpha)
            drawPixelRect(p.x, p.y - r, sz, sz, p.color, alpha)
            drawPixelRect(p.x, p.y + r, sz, sz, p.color, alpha)

            // Diagonals
            const dr = r * 0.7
            drawPixelRect(p.x - dr, p.y - dr, sz, sz, p.color, alpha * 0.7)
            drawPixelRect(p.x + dr, p.y - dr, sz, sz, p.color, alpha * 0.7)
            drawPixelRect(p.x - dr, p.y + dr, sz, sz, p.color, alpha * 0.7)
            drawPixelRect(p.x + dr, p.y + dr, sz, sz, p.color, alpha * 0.7)

            // Inner glow
            if (p.explosionFrame <= 10) {
              const innerAlpha = 0.4 * (1 - p.explosionFrame / 10)
              const ir = r * 0.4
              drawPixelRect(p.x - ir, p.y - ir, sz, sz, '#ffffff', innerAlpha)
              drawPixelRect(p.x + ir, p.y - ir, sz, sz, '#ffffff', innerAlpha)
              drawPixelRect(p.x - ir, p.y + ir, sz, sz, '#ffffff', innerAlpha)
              drawPixelRect(p.x + ir, p.y + ir, sz, sz, '#ffffff', innerAlpha)
            }
          }

          // Center ember
          if (p.explosionFrame <= 25) {
            const emberAlpha = 0.6 * (1 - p.explosionFrame / 25)
            const emberSize = PIXEL * Math.max(1, 3 - Math.floor(p.explosionFrame / 8))
            drawPixelRect(p.x - emberSize / 2, p.y - emberSize / 2, emberSize, emberSize, p.color, emberAlpha)
          }

          if (p.explosionFrame > totalFrames) {
            particles[i] = createParticle(canvas!.width, canvas!.height)
          }
        }
      }

      // Update & draw debris
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i]
        d.x += d.vx
        d.y += d.vy
        d.vy += 0.05 // gravity
        d.vx *= 0.98
        d.life--

        if (d.life <= 0) {
          debris.splice(i, 1)
          continue
        }

        const alpha = (d.life / 40) * 0.7
        drawPixelRect(d.x, d.y, d.size, d.size, d.color, alpha)
      }

      ctx!.globalAlpha = 1
      animId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        imageRendering: 'pixelated',
      }}
    />
  )
}
