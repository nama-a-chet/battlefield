import { useState, useEffect, useMemo, useCallback } from 'react'
import { SHIPS, GRID_SIZE } from '@/types/game'
import type { Direction, ShipPlacement as ShipPlacementType, CellState, ShipCells } from '@/types/game'
import GameBoard from './GameBoard'
import { Shuffle, Check, Ship } from '@/icons'
import './ShipPlacement.css'

interface Props {
  gameId: string | null
  onConfirm: (ships: Record<string, ShipPlacementType>) => void
  loading: boolean
  opponentReady: boolean
  yourReady?: boolean
}

type PlacedShips = Record<string, ShipPlacementType>

function getShipCells(start: [number, number], size: number, direction: Direction): number[][] {
  const cells: number[][] = []
  for (let i = 0; i < size; i++) {
    const r = start[0] + (direction === 'vertical' ? i : 0)
    const c = start[1] + (direction === 'horizontal' ? i : 0)
    cells.push([r, c])
  }
  return cells
}

function isValidPlacement(
  start: [number, number],
  size: number,
  direction: Direction,
  occupied: Set<string>,
): boolean {
  const cells = getShipCells(start, size, direction)
  for (const [r, c] of cells) {
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false
    if (occupied.has(`${r},${c}`)) return false
  }
  return true
}

function getOccupied(placements: PlacedShips, exclude?: string): Set<string> {
  const set = new Set<string>()
  for (const [name, p] of Object.entries(placements)) {
    if (name === exclude) continue
    const size = SHIPS[name]
    const cells = getShipCells(p.start, size, p.direction)
    for (const [r, c] of cells) {
      set.add(`${r},${c}`)
    }
  }
  return set
}

function randomizePlacements(): PlacedShips {
  const placements: PlacedShips = {}
  const occupied = new Set<string>()

  for (const [name, size] of Object.entries(SHIPS)) {
    let placed = false
    while (!placed) {
      const direction: Direction = Math.random() > 0.5 ? 'horizontal' : 'vertical'
      const maxRow = direction === 'vertical' ? GRID_SIZE - size : GRID_SIZE - 1
      const maxCol = direction === 'horizontal' ? GRID_SIZE - size : GRID_SIZE - 1
      const row = Math.floor(Math.random() * (maxRow + 1))
      const col = Math.floor(Math.random() * (maxCol + 1))

      const cells = getShipCells([row, col], size, direction)
      if (cells.every(([r, c]) => !occupied.has(`${r},${c}`))) {
        for (const [r, c] of cells) occupied.add(`${r},${c}`)
        placements[name] = { start: [row, col], direction }
        placed = true
      }
    }
  }

  return placements
}

const STORAGE_PREFIX = 'bf_placements_'

function loadSavedPlacements(gameId: string | null): PlacedShips {
  if (!gameId) return {}
  try {
    const saved = sessionStorage.getItem(STORAGE_PREFIX + gameId)
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return {}
}

export default function ShipPlacement({ gameId, onConfirm, loading, opponentReady, yourReady }: Props) {
  const [placements, setPlacements] = useState<PlacedShips>(() => loadSavedPlacements(gameId))
  const [selectedShip, setSelectedShip] = useState<string | null>(() => {
    const saved = loadSavedPlacements(gameId)
    const firstUnplaced = Object.keys(SHIPS).find(name => !(name in saved))
    return firstUnplaced || null
  })
  const [direction, setDirection] = useState<Direction>('horizontal')
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null)

  // Persist placements to sessionStorage
  useEffect(() => {
    if (!gameId) return
    if (Object.keys(placements).length === 0) {
      sessionStorage.removeItem(STORAGE_PREFIX + gameId)
    } else {
      sessionStorage.setItem(STORAGE_PREFIX + gameId, JSON.stringify(placements))
    }
  }, [placements, gameId])

  const allPlaced = Object.keys(placements).length === Object.keys(SHIPS).length

  // Build board and ship cells from placements
  const { board, shipCells } = useMemo(() => {
    const b: CellState[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null))
    const sc: ShipCells = {}
    for (const [name, p] of Object.entries(placements)) {
      const cells = getShipCells(p.start, SHIPS[name], p.direction)
      sc[name] = cells
      for (const [r, c] of cells) {
        b[r][c] = 'ship'
      }
    }
    return { board: b, shipCells: sc }
  }, [placements])

  // Preview cells
  const preview = useMemo(() => {
    if (!selectedShip || !hoverCell) return null
    const size = SHIPS[selectedShip]
    const cells = getShipCells([hoverCell.row, hoverCell.col], size, direction)
    const occupied = getOccupied(placements, selectedShip)
    const valid = isValidPlacement([hoverCell.row, hoverCell.col], size, direction, occupied)
    return { cells, valid }
  }, [selectedShip, hoverCell, direction, placements])

  // Reverse lookup: (row,col) -> ship name
  const cellToShip = useMemo(() => {
    const map = new Map<string, string>()
    for (const [name, cells] of Object.entries(shipCells)) {
      for (const [r, c] of cells) {
        map.set(`${r},${c}`, name)
      }
    }
    return map
  }, [shipCells])

  const handleCellClick = useCallback((row: number, col: number) => {
    // If clicking a placed ship on the grid, pick it up for repositioning
    const clickedShip = cellToShip.get(`${row},${col}`)
    if (clickedShip && clickedShip !== selectedShip) {
      setSelectedShip(clickedShip)
      setDirection(placements[clickedShip].direction)
      return
    }

    if (!selectedShip) return
    const size = SHIPS[selectedShip]
    const occupied = getOccupied(placements, selectedShip)
    if (!isValidPlacement([row, col], size, direction, occupied)) return

    setPlacements(prev => ({
      ...prev,
      [selectedShip]: { start: [row, col] as [number, number], direction },
    }))

    // Select next unplaced ship
    const shipNames = Object.keys(SHIPS)
    const nextUnplaced = shipNames.find(name => name !== selectedShip && !(name in placements))
    setSelectedShip(nextUnplaced || null)
  }, [selectedShip, direction, placements, cellToShip])

  const handleCellHover = useCallback((row: number, col: number) => {
    setHoverCell({ row, col })
  }, [])

  const handleBoardLeave = useCallback(() => {
    setHoverCell(null)
  }, [])

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDirection(d => d === 'horizontal' ? 'vertical' : 'horizontal')
  }, [])

  const handleRandomize = () => {
    setPlacements(randomizePlacements())
    setSelectedShip(null)
  }

  const handleConfirm = () => {
    if (!allPlaced) return
    if (gameId) sessionStorage.removeItem(STORAGE_PREFIX + gameId)
    onConfirm(placements)
  }

  const handleShipClick = (name: string) => {
    if (selectedShip === name) {
      // Toggle direction when clicking already-selected ship
      setDirection(d => d === 'horizontal' ? 'vertical' : 'horizontal')
    } else {
      setSelectedShip(name)
    }
  }

  const handleRemoveShip = (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPlacements(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
    setSelectedShip(name)
  }

  if (yourReady) {
    return (
      <div className="card game-card">
        <div className="placement-waiting">
          <Ship width={32} height={32} />
          <h2 className="waiting-title">FLEET DEPLOYED</h2>
          <p className="waiting-subtitle">
            {opponentReady ? 'Starting battle...' : 'Waiting for opponent to deploy...'}
          </p>
          <div className="waiting-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ship-placement">
      <div className="placement-header">
        <h2 className="placement-title">DEPLOY YOUR FLEET</h2>
        <p className="placement-hint">
          Select a ship, then click the grid to place it. Right-click to rotate.
        </p>
      </div>

      <div className="placement-content">
        {/* Ship list */}
        <div className="ship-list">
          <div className="ship-list-header">SHIPS</div>
          {Object.entries(SHIPS).map(([name, size]) => {
            const isPlaced = name in placements
            const isSelected = selectedShip === name
            return (
              <div
                key={name}
                className={`ship-list-item ${isSelected ? 'selected' : ''} ${isPlaced ? 'placed' : ''}`}
                onClick={() => handleShipClick(name)}
              >
                <div className="ship-list-info">
                  <span className="ship-list-name">{name.toUpperCase()} ({size})</span>
                </div>
                <div className="ship-list-dots">
                  {Array.from({ length: size }, (_, i) => (
                    <span key={i} className="ship-block" />
                  ))}
                </div>
                {isPlaced && (
                  <button
                    className="ship-remove"
                    onClick={(e) => handleRemoveShip(name, e)}
                    title="Remove"
                  >
                    &times;
                  </button>
                )}
              </div>
            )
          })}

          <div className="placement-controls">
            <button className="secondary-btn" onClick={handleRandomize}>
              <Shuffle width={16} height={16} />
              <span>RANDOMIZE</span>
            </button>
            <button
              className="primary-btn"
              onClick={handleConfirm}
              disabled={!allPlaced || loading}
            >
              <Check width={16} height={16} />
              <span>{loading ? 'DEPLOYING...' : 'CONFIRM FLEET'}</span>
            </button>
          </div>

          <div className="placement-direction">
            <span className="label">DIRECTION: {direction.toUpperCase()}</span>
          </div>
        </div>

        {/* Board */}
        <GameBoard
          board={board}
          ships={shipCells}
          interactive
          onCellClick={handleCellClick}
          onCellHover={handleCellHover}
          onBoardLeave={handleBoardLeave}
          onRightClick={handleRightClick}
          previewCells={preview?.cells}
          previewValid={preview?.valid}
          label="YOUR WATERS"
        />
      </div>
    </div>
  )
}
