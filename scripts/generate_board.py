import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

# Output path inside webapp assets so it can be served
OUT_PATH = Path(__file__).resolve().parents[1] / "webapp" / "public" / "assets" / "snakes_ladders_board.png"

# Board and tile dimensions
BOARD_SIZE = 800
TILES = 10
TILE_SIZE = BOARD_SIZE // TILES

# Colors
GRADIENT_STOPS = [
    (0.0, (0x27, 0x6d, 0x79)), # teal blue
    (0.5, (0xf3, 0xed, 0xe3)), # light beige center
    (0.75, (0xf1, 0xc6, 0xa4)),
    (1.0, (0xf7, 0xd6, 0xbb)),
]

TILE_COLORS = ["#fdf6ef", "#bdd7e5"]
SPECIAL_COLOR = "#f7c8b4"  # used for snakes or special tiles

SNAKE_COLOR = "#4caf50"
LADDER_COLOR = "#d69f73"

FONT_PATH = "DejaVuSans-Bold.ttf"

def lerp(a, b, t):
    return int(a + (b - a) * t)

def blend_color(c1, c2, t):
    return tuple(lerp(a, b, t) for a, b in zip(c1, c2))

def build_gradient(width, height, stops):
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    for x in range(width):
        t = x / (width - 1)
        # Find surrounding stops
        for i in range(len(stops) - 1):
            if stops[i][0] <= t <= stops[i + 1][0]:
                start_pos, start_color = stops[i]
                end_pos, end_color = stops[i + 1]
                local_t = (t - start_pos) / (end_pos - start_pos)
                color = blend_color(start_color, end_color, local_t)
                draw.line([(x, 0), (x, height)], fill=color)
                break
    return img


def draw_board(base):
    draw = ImageDraw.Draw(base)
    try:
        font = ImageFont.truetype(FONT_PATH, 20)
    except Exception:
        font = ImageFont.load_default()

    for row in range(TILES):
        for col in range(TILES):
            x0 = col * TILE_SIZE + 5
            y0 = row * TILE_SIZE + 5
            x1 = x0 + TILE_SIZE - 10
            y1 = y0 + TILE_SIZE - 10
            tile_index = row * TILES + col + 1
            color = TILE_COLORS[(row + col) % 2]
            draw.rounded_rectangle([x0, y0, x1, y1], radius=10, fill=color, outline="#e5e5e5", width=2)
            draw.text(((x0 + x1)/2, (y0 + y1)/2), str(tile_index), anchor="mm", fill="#555", font=font)

    # Example special tiles for snakes
    snake_tiles = [(16, 6), (48, 30), (62, 19)]
    for start, end in snake_tiles:
        sx, sy = tile_center(start)
        ex, ey = tile_center(end)
        draw_snake(draw, sx, sy, ex, ey)
        draw.rounded_rectangle([sx-20, sy-20, sx+20, sy+20], radius=8, fill=SPECIAL_COLOR, outline=None)

    ladder_tiles = [(3, 22), (36, 57), (71, 92)]
    for start, end in ladder_tiles:
        sx, sy = tile_center(start)
        ex, ey = tile_center(end)
        draw_ladder(draw, sx, sy, ex, ey)

    return base


def tile_center(tile):
    tile -= 1
    row = TILES - 1 - (tile // TILES)
    col = tile % TILES
    if (TILES - 1 - row) % 2 == 1:
        col = TILES - 1 - col
    x = col * TILE_SIZE + TILE_SIZE/2
    y = row * TILE_SIZE + TILE_SIZE/2
    return x, y


def draw_snake(draw, sx, sy, ex, ey):
    path = [
        (sx, sy),
        ((sx + ex)/2, sy - 0.4*abs(sy - ey)),
        (ex, ey)
    ]
    draw.line(path, fill=SNAKE_COLOR, width=8, joint="curve")
    draw.ellipse([sx-6, sy-6, sx+6, sy+6], fill=SNAKE_COLOR)
    draw.ellipse([ex-8, ey-8, ex+8, ey+8], fill=SNAKE_COLOR)


def draw_ladder(draw, sx, sy, ex, ey):
    steps = 5
    dx = (ex - sx)
    dy = (ey - sy)
    # Draw side rails
    offset = 10
    draw.line([(sx - offset, sy), (ex - offset, ey)], fill=LADDER_COLOR, width=6)
    draw.line([(sx + offset, sy), (ex + offset, ey)], fill=LADDER_COLOR, width=6)
    for i in range(1, steps):
        t = i / (steps)
        xi = sx + dx * t
        yi = sy + dy * t
        draw.line([(xi - offset, yi), (xi + offset, yi)], fill=LADDER_COLOR, width=6)


def main():
    bg = build_gradient(BOARD_SIZE, BOARD_SIZE, GRADIENT_STOPS)
    board = draw_board(bg)
    # Add subtle shadow for a pawn and dice
    shadow = Image.new("RGBA", (50, 20), (0, 0, 0, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    board.paste(shadow, (BOARD_SIZE//2 - 25, BOARD_SIZE//2 + 10), shadow)
    # pawn
    pawn = Image.new("RGBA", (30, 40))
    pd = ImageDraw.Draw(pawn)
    pd.ellipse([5, 0, 25, 20], fill="#ff5722")
    pd.rectangle([10, 20, 20, 38], fill="#ff5722")
    board.paste(pawn, (BOARD_SIZE//2 - 15, BOARD_SIZE//2 - 20), pawn)
    # dice
    dice = Image.new("RGBA", (30,30), "white")
    dd = ImageDraw.Draw(dice)
    dd.rounded_rectangle([0,0,30,30], radius=5, fill="white", outline="#ccc")
    for px, py in [(8,8), (22,22)]:
        dd.ellipse([px-3,py-3,px+3,py+3], fill="#555")
    board.paste(dice, (BOARD_SIZE//2 + 10, BOARD_SIZE//2 - 25), dice)

    board.save(OUT_PATH)
    print(f"Saved board to {OUT_PATH}")

if __name__ == "__main__":
    main()
