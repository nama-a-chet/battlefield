import random
import time

from setup.config import GRID_SIZE, SHIPS
from game.events import push_event
from game.models import opponent_key


def place_ships_randomly():
    """Place all ships randomly on the grid. Returns ships_cells dict."""
    occupied = set()
    ships_cells = {}

    for ship_name, size in SHIPS.items():
        while True:
            direction = random.choice(["horizontal", "vertical"])
            if direction == "horizontal":
                row = random.randint(0, GRID_SIZE - 1)
                col = random.randint(0, GRID_SIZE - size)
            else:
                row = random.randint(0, GRID_SIZE - size)
                col = random.randint(0, GRID_SIZE - 1)

            cells = []
            valid = True
            for i in range(size):
                r = row + (i if direction == "vertical" else 0)
                c = col + (i if direction == "horizontal" else 0)
                if (r, c) in occupied:
                    valid = False
                    break
                cells.append([r, c])

            if valid:
                for cell in cells:
                    occupied.add(tuple(cell))
                ships_cells[ship_name] = cells
                break

    return ships_cells


def apply_placement(player, ships_cells):
    """Apply ship placement to a player."""
    player.ships = ships_cells
    player.ready = True
    for cells in ships_cells.values():
        for r, c in cells:
            player.board[r][c] = "ship"


def setup_ai_player(game):
    """Place ships for the AI player and mark ready."""
    ships_cells = place_ships_randomly()
    apply_placement(game.player2, ships_cells)


def _get_active_hits(shots, sunk_cells):
    """Get hit cells that aren't part of already-sunk ships."""
    active = []
    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            if shots[r][c] == "hit" and (r, c) not in sunk_cells:
                active.append((r, c))
    return active


def _group_hits(hits):
    """Group adjacent hits into connected components via BFS."""
    hit_set = set(hits)
    visited = set()
    groups = []

    for hit in hits:
        if hit in visited:
            continue
        group = []
        queue = [hit]
        while queue:
            cell = queue.pop(0)
            if cell in visited:
                continue
            visited.add(cell)
            group.append(cell)
            r, c = cell
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if (nr, nc) in hit_set and (nr, nc) not in visited:
                    queue.append((nr, nc))
        groups.append(group)

    return groups


def _get_smart_targets(shots, active_hits):
    """Get target cells with direction locking on multi-hit groups."""
    targets = set()
    groups = _group_hits(active_hits)

    for group in groups:
        if len(group) == 1:
            # Single hit: probe all 4 neighbors
            r, c = group[0]
            for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nr, nc = r + dr, c + dc
                if 0 <= nr < GRID_SIZE and 0 <= nc < GRID_SIZE and shots[nr][nc] is None:
                    targets.add((nr, nc))
        else:
            # Multiple hits: lock direction, probe ends of the line
            group.sort()
            rows = set(r for r, _ in group)
            cols = set(c for _, c in group)

            if len(rows) == 1:
                # Horizontal — extend left/right
                r = next(iter(rows))
                min_c = min(c for _, c in group)
                max_c = max(c for _, c in group)
                if min_c - 1 >= 0 and shots[r][min_c - 1] is None:
                    targets.add((r, min_c - 1))
                if max_c + 1 < GRID_SIZE and shots[r][max_c + 1] is None:
                    targets.add((r, max_c + 1))
            elif len(cols) == 1:
                # Vertical — extend up/down
                c = next(iter(cols))
                min_r = min(r for r, _ in group)
                max_r = max(r for r, _ in group)
                if min_r - 1 >= 0 and shots[min_r - 1][c] is None:
                    targets.add((min_r - 1, c))
                if max_r + 1 < GRID_SIZE and shots[max_r + 1][c] is None:
                    targets.add((max_r + 1, c))
            else:
                # L-shape (two adjacent ships) — probe all neighbors
                for r, c in group:
                    for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < GRID_SIZE and 0 <= nc < GRID_SIZE and shots[nr][nc] is None:
                            targets.add((nr, nc))

    return list(targets)


def _compute_probability_map(shots, remaining_sizes):
    """
    For each empty cell, count how many ways remaining ships could
    pass through it. Higher count = more likely to contain a ship.
    """
    probs = [[0] * GRID_SIZE for _ in range(GRID_SIZE)]

    for size in remaining_sizes:
        # Horizontal placements
        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE - size + 1):
                if all(shots[r][c + i] is None for i in range(size)):
                    for i in range(size):
                        probs[r][c + i] += 1
        # Vertical placements
        for r in range(GRID_SIZE - size + 1):
            for c in range(GRID_SIZE):
                if all(shots[r + i][c] is None for i in range(size)):
                    for i in range(size):
                        probs[r + i][c] += 1

    return probs


def ai_choose_shot(game):
    """
    AI picks the next cell to fire at using:
    - Target mode with direction locking (when there are unsunk hits)
    - Hunt mode with probability density heat map (otherwise)
    """
    ai_player = game.player2
    human_player = game.player1
    shots = ai_player.shots

    # Remaining ship sizes the AI is hunting for
    remaining_sizes = [
        size for name, size in SHIPS.items()
        if name not in human_player.sunk
    ]

    # Build set of cells belonging to already-sunk ships
    sunk_cells = set()
    for name in human_player.sunk:
        if name in human_player.ships:
            for r, c in human_player.ships[name]:
                sunk_cells.add((r, c))

    # Check for active (unsunk) hits -> target mode
    active_hits = _get_active_hits(shots, sunk_cells)
    if active_hits:
        targets = _get_smart_targets(shots, active_hits)
        if targets:
            # Weight targets by probability density to pick the smartest one
            probs = _compute_probability_map(shots, remaining_sizes)
            best_prob = max(probs[r][c] for r, c in targets)
            best = [t for t in targets if probs[t[0]][t[1]] == best_prob]
            return random.choice(best)

    # Hunt mode: pick the cell with the highest probability density
    probs = _compute_probability_map(shots, remaining_sizes)
    best_prob = -1
    best_cells = []
    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            if shots[r][c] is not None:
                continue
            p = probs[r][c]
            if p > best_prob:
                best_prob = p
                best_cells = [(r, c)]
            elif p == best_prob:
                best_cells.append((r, c))

    if best_cells:
        return random.choice(best_cells)

    return (0, 0)


def process_shot(game, attacker_key, row, col):
    """
    Process a shot from attacker at (row, col) against the defender.
    Mutates game state. Returns shot result dict.
    """
    defender_key = opponent_key(attacker_key)
    attacker = game.get_player(attacker_key)
    defender = game.get_player(defender_key)

    # Check if hit
    is_hit = defender.board[row][col] == "ship"
    result = "hit" if is_hit else "miss"

    # Update attacker's shots grid
    attacker.shots[row][col] = result
    # Update defender's board (mark hit/miss for state reconstruction)
    defender.board[row][col] = result

    sunk_ship = None
    if is_hit:
        # Check if a ship is sunk
        for ship_name, cells in defender.ships.items():
            if ship_name in defender.sunk:
                continue
            if all(defender.board[r][c] == "hit" for r, c in cells):
                defender.sunk.append(ship_name)
                sunk_ship = ship_name
                break

    # Check win condition
    all_sunk = len(defender.sunk) == len(SHIPS)
    if all_sunk:
        game.phase = "finished"
        game.winner = attacker_key

    game.last_activity = time.time()

    return {
        "row": row,
        "col": col,
        "result": result,
        "sunk": sunk_ship,
        "sunk_cells": defender.ships[sunk_ship] if sunk_ship else None,
        "game_over": all_sunk,
        "winner": attacker_key if all_sunk else None,
    }


def ai_take_turn(game):
    """
    AI fires a shot. Mutates game state only.
    Returns the result dict. Caller is responsible for pushing SSE events.
    """
    row, col = ai_choose_shot(game)
    result = process_shot(game, "player2", row, col)
    return result


def ai_push_events(game, ai_result):
    """Push SSE events for the AI's shot. Call OUTSIDE the lock."""
    push_event(game, "player1", "opponent_shot", {
        "row": ai_result["row"],
        "col": ai_result["col"],
        "result": ai_result["result"],
        "sunk": ai_result["sunk"],
    })

    if ai_result["game_over"]:
        push_event(game, "player1", "game_over", {
            "winner": "player2",
            "reason": "all_ships_sunk",
        })
