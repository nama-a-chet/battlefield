import type { CellState, ShipCells } from '@/types/game'
import { GRID_SIZE } from '@/types/game'
import './GameBoard.css'

interface GameBoardProps {
  board: CellState[][]
  ships?: ShipCells
  sunkShipNames?: string[]
  interactive?: boolean
  onCellClick?: (row: number, col: number) => void
  onCellHover?: (row: number, col: number) => void
  onBoardLeave?: () => void
  onRightClick?: (e: React.MouseEvent) => void
  previewCells?: number[][]
  previewValid?: boolean
  label?: string
}

const ROW_LABELS = 'ABCDEFGHIJ'
const COL_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']

// Which cell index gets the bridge/cabin detail per ship type
const BRIDGE_INDEX: Record<string, number> = {
  carrier: 2,
  battleship: 1,
  cruiser: 1,
  submarine: 1,
  destroyer: -1,
}

interface ShipPartInfo {
  name: string
  index: number
  size: number
  isHorizontal: boolean
}

function buildShipPartMap(ships?: ShipCells): Map<string, ShipPartInfo> {
  const map = new Map<string, ShipPartInfo>()
  if (!ships) return map
  for (const [name, cells] of Object.entries(ships)) {
    const size = cells.length
    const isHorizontal = size > 1 ? cells[0][0] === cells[1][0] : true
    for (let i = 0; i < cells.length; i++) {
      map.set(`${cells[i][0]},${cells[i][1]}`, { name, index: i, size, isHorizontal })
    }
  }
  return map
}

function buildShipCellSet(ships?: ShipCells): Set<string> {
  const s = new Set<string>()
  if (!ships) return s
  for (const cells of Object.values(ships)) {
    for (const cell of cells) {
      s.add(`${cell[0]},${cell[1]}`)
    }
  }
  return s
}

function sameShipNeighbor(ships: ShipCells, row: number, col: number, dr: number, dc: number): boolean {
  const nr = row + dr
  const nc = col + dc
  for (const cells of Object.values(ships)) {
    const hasCell = cells.some(c => c[0] === row && c[1] === col)
    const hasNeighbor = cells.some(c => c[0] === nr && c[1] === nc)
    if (hasCell && hasNeighbor) return true
  }
  return false
}

function isSunkCell(ships: ShipCells, sunkNames: string[], row: number, col: number): boolean {
  for (const [name, cells] of Object.entries(ships)) {
    if (!sunkNames.includes(name)) continue
    if (cells.some(c => c[0] === row && c[1] === col)) return true
  }
  return false
}

export default function GameBoard({
  board,
  ships,
  sunkShipNames,
  interactive = false,
  onCellClick,
  onCellHover,
  onBoardLeave,
  onRightClick,
  previewCells,
  previewValid,
  label,
}: GameBoardProps) {
  const shipCells = buildShipCellSet(ships)
  const shipPartMap = buildShipPartMap(ships)
  const previewSet = new Set<string>()
  if (previewCells) {
    for (const cell of previewCells) {
      previewSet.add(`${cell[0]},${cell[1]}`)
    }
  }

  const cells: React.ReactNode[] = []

  // Corner spacer
  cells.push(<div key="corner" className="board-corner" />)

  // Column headers
  COL_LABELS.forEach(c => {
    cells.push(<div key={`ch-${c}`} className="board-col-header">{c}</div>)
  })

  // Rows
  for (let row = 0; row < GRID_SIZE; row++) {
    cells.push(<div key={`rh-${row}`} className="board-row-header">{ROW_LABELS[row]}</div>)

    for (let col = 0; col < GRID_SIZE; col++) {
      const cell = board[row][col]
      const isShip = shipCells.has(`${row},${col}`)
      const isHit = cell === 'hit'
      const isMiss = cell === 'miss'
      const isSunk = isHit && ships && sunkShipNames && isSunkCell(ships, sunkShipNames, row, col)
      const isPreview = previewSet.has(`${row},${col}`)

      let connectedClass = ''
      if ((isShip || isPreview || isSunk) && ships) {
        if (sameShipNeighbor(ships, row, col, 0, 1)) connectedClass += ' connected-right'
        if (sameShipNeighbor(ships, row, col, 0, -1)) connectedClass += ' connected-left'
        if (sameShipNeighbor(ships, row, col, 1, 0)) connectedClass += ' connected-bottom'
        if (sameShipNeighbor(ships, row, col, -1, 0)) connectedClass += ' connected-top'
      }

      // Ship part classes (bow/mid/stern, direction, bridge) — for live ships AND sunk ships
      let shipPartClasses = ''
      const partInfo = shipPartMap.get(`${row},${col}`)
      if (partInfo && ((isShip && !isHit) || isSunk)) {
        const dir = partInfo.isHorizontal ? 'ship-h' : 'ship-v'
        const part = partInfo.index === 0
          ? 'ship-bow'
          : partInfo.index === partInfo.size - 1
            ? 'ship-stern'
            : 'ship-mid'
        const bridge = BRIDGE_INDEX[partInfo.name] === partInfo.index ? 'ship-bridge' : ''
        shipPartClasses = `${dir} ${part} ${bridge}`.trim()
      }

      const classNames = [
        'board-cell',
        isHit && !isSunk ? 'cell-hit' : '',
        isSunk ? 'cell-sunk' : '',
        isMiss ? 'cell-miss' : '',
        isShip && !isHit ? 'cell-ship' : '',
        interactive ? 'cell-interactive' : '',
        isPreview ? (previewValid ? 'cell-preview-valid' : 'cell-preview-invalid') : '',
        connectedClass.trim(),
        shipPartClasses,
      ].filter(Boolean).join(' ')

      cells.push(
        <div
          key={`${row}-${col}`}
          className={classNames}
          onClick={() => interactive && onCellClick?.(row, col)}
          onMouseEnter={() => onCellHover?.(row, col)}
        />
      )
    }
  }

  return (
    <div
      className="board-wrapper"
      onMouseLeave={onBoardLeave}
      onContextMenu={onRightClick}
    >
      {label && <div className="board-label">{label}</div>}
      <div className="board">{cells}</div>
    </div>
  )
}
