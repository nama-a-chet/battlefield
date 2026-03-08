from setup.config import GRID_SIZE, SHIPS


def validate_placement(ships_data):
    """
    Validate ship placement. ships_data is a dict:
    { "carrier": {"start": [row, col], "direction": "horizontal"|"vertical"}, ... }

    Returns (ships_cells, error) where ships_cells is:
    { "carrier": [[r,c], [r,c], ...], ... }
    """
    if set(ships_data.keys()) != set(SHIPS.keys()):
        return None, f"Must place exactly these ships: {list(SHIPS.keys())}"

    occupied = set()
    ships_cells = {}

    for ship_name, placement in ships_data.items():
        start = placement.get("start")
        direction = placement.get("direction")

        if not start or direction not in ("horizontal", "vertical"):
            return None, f"Invalid placement for {ship_name}"

        row, col = start
        size = SHIPS[ship_name]
        cells = []

        for i in range(size):
            r = row + (i if direction == "vertical" else 0)
            c = col + (i if direction == "horizontal" else 0)

            if r < 0 or r >= GRID_SIZE or c < 0 or c >= GRID_SIZE:
                return None, f"{ship_name} goes out of bounds"

            if (r, c) in occupied:
                return None, f"{ship_name} overlaps with another ship"

            occupied.add((r, c))
            cells.append([r, c])

        ships_cells[ship_name] = cells

    return ships_cells, None


def validate_shot(game, player_key, row, col):
    """Validate a shot. Returns error string or None."""
    if game.phase != "playing":
        return "Game is not in playing phase"

    if game.current_turn != player_key:
        return "Not your turn"

    if row < 0 or row >= GRID_SIZE or col < 0 or col >= GRID_SIZE:
        return "Shot out of bounds"

    player = game.get_player(player_key)
    if player.shots[row][col] is not None:
        return "Already fired at this cell"

    return None
