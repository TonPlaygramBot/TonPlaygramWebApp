"""Simple Snake and Ladder Telegram bot.

This bot lets a single player roll a dice and move on
 a classic snake and ladder board. The board is rendered
 with Pillow and sent as an image after each move.
"""

import os
import json
from pathlib import Path
from typing import Dict

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "snake_ladder_data.json"
BOARD_TEMPLATE = BASE_DIR / "snake_board_template.png"
BOARD_SIZE = 512
TILE_SIZE = BOARD_SIZE // 10

SNAKES: Dict[int, int] = {
    17: 4,
    19: 7,
    21: 9,
    27: 1,
    54: 34,
    62: 18,
    64: 60,
    87: 24,
    93: 73,
    95: 75,
    98: 79,
    99: 7,
}

LADDERS: Dict[int, int] = {
    3: 22,
    5: 8,
    11: 26,
    20: 29,
    27: 56,
    36: 44,
    51: 67,
    71: 91,
    80: 100,
}


def load_data() -> Dict:
    if DATA_FILE.exists():
        with DATA_FILE.open("r") as f:
            return json.load(f)
    return {}


def save_data(data: Dict):
    with DATA_FILE.open("w") as f:
        json.dump(data, f)


def user_key(update: Update) -> str:
    return f"{update.effective_chat.id}:{update.effective_user.id}"


def board_coordinates(position: int):
    tile = position - 1
    row = tile // 10  # bottom row is 0
    col_index = tile % 10
    if row % 2 == 0:
        col = col_index
    else:
        col = 9 - col_index
    x = col * TILE_SIZE
    y = (9 - row) * TILE_SIZE
    return x, y


def ensure_template() -> Image.Image:
    if BOARD_TEMPLATE.exists():
        return Image.open(BOARD_TEMPLATE).convert("RGBA")

    base = Image.new("RGBA", (BOARD_SIZE, BOARD_SIZE), (20, 20, 30))
    draw = ImageDraw.Draw(base)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 20)
        emoji_font = ImageFont.truetype("DejaVuSans-Bold.ttf", TILE_SIZE // 2)
    except Exception:
        font = ImageFont.load_default()
        emoji_font = ImageFont.load_default()

    tile_num = 1
    for r in range(10):
        real_row = 9 - r
        for c in range(10):
            col = c if r % 2 == 0 else 9 - c
            x = col * TILE_SIZE
            y = real_row * TILE_SIZE
            color = (110 + (c % 2) * 10, 60, 40)
            draw.rectangle([x, y, x + TILE_SIZE, y + TILE_SIZE], fill=color)
            draw.line([x, y, x + TILE_SIZE, y], fill=(color[0] + 30, color[1] + 30, color[2] + 30), width=2)
            draw.line([x, y, x, y + TILE_SIZE], fill=(color[0] + 30, color[1] + 30, color[2] + 30), width=2)
            draw.line([x + TILE_SIZE, y, x + TILE_SIZE, y + TILE_SIZE], fill=(color[0] - 30, color[1] - 30, color[2] - 30), width=2)
            draw.line([x, y + TILE_SIZE, x + TILE_SIZE, y + TILE_SIZE], fill=(color[0] - 30, color[1] - 30, color[2] - 30), width=2)
            draw.text((x + TILE_SIZE / 2, y + TILE_SIZE / 2), str(tile_num), fill="white", font=font, anchor="mm")
            if tile_num in SNAKES:
                draw.text((x + TILE_SIZE * 0.2, y + TILE_SIZE * 0.7), "🐍", font=emoji_font, anchor="mm")
            if tile_num in LADDERS:
                draw.text((x + TILE_SIZE * 0.8, y + TILE_SIZE * 0.3), "🪜", font=emoji_font, anchor="mm")
            tile_num += 1

    base.save(BOARD_TEMPLATE)
    return base


def generate_board(position: int, token: str) -> Path:
    base = ensure_template().copy()
    if position > 0:
        draw = ImageDraw.Draw(base)
        try:
            emoji_font = ImageFont.truetype("DejaVuSans-Bold.ttf", TILE_SIZE // 2)
        except Exception:
            emoji_font = ImageFont.load_default()
        x, y = board_coordinates(position)
        glow = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (255, 200, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse((10, 10, TILE_SIZE - 10, TILE_SIZE - 10), fill=(255, 200, 0, 180))
        glow = glow.filter(ImageFilter.GaussianBlur(8))
        base.paste(glow, (x, y), glow)
        draw.text((x + TILE_SIZE / 2, y + TILE_SIZE / 2), token, font=emoji_font, anchor="mm")

    out = Path(f"board_{position}.png")
    base.save(out)
    return out


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    key = user_key(update)
    data.setdefault(key, {"position": 0, "token": "🚀"})
    save_data(data)
    await update.message.reply_text(
        "🎲 Welcome to Snake & Ladder! Roll a 6 to start moving."
    )


async def position(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    key = user_key(update)
    pos = data.get(key, {"position": 0}).get("position", 0)
    await update.message.reply_text(f"📍 You are on tile {pos}.")


async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    key = user_key(update)
    user = data.get(key, {"token": "🚀"})
    user["position"] = 0
    data[key] = user
    save_data(data)
    await update.message.reply_text("🔄 Game reset. Roll a 6 to start again.")


async def roll(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    key = user_key(update)
    user = data.setdefault(key, {"position": 0, "token": "🚀"})

    dice_message = await update.message.reply_dice(emoji="🎲")
    dice = dice_message.dice.value
    current = user["position"]

    if current == 0:
        if dice == 6:
            current = 1
            await update.message.reply_text("🎲 You rolled a 6! Starting at tile 1.")
        else:
            await update.message.reply_text("Need a 6 to start. Try again!")
    else:
        if current + dice > 100:
            await update.message.reply_text(
                f"🎲 You rolled a {dice} but need exact roll to finish. Staying on tile {current}."
            )
        else:
            current += dice
            await update.message.reply_text(f"🎲 You rolled a {dice}! Moving to tile {current}.")

    # apply snakes or ladders
    if current in LADDERS:
        current = LADDERS[current]
        await update.message.reply_text(f"🪜 Ladder! Climb up to {current}.")
    if current in SNAKES:
        current = SNAKES[current]
        await update.message.reply_text(f"🐍 Snake! Slide down to {current}.")

    user["position"] = current
    data[key] = user
    save_data(data)

    board = generate_board(current, user["token"])
    with board.open("rb") as img:
        await update.message.reply_photo(img)

    if current == 100:
        await update.message.reply_text("🏆 You reached 100! Use /reset to play again.")


async def board_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    key = user_key(update)
    pos = data.get(key, {"position": 0}).get("position", 0)
    board = generate_board(pos, data.get(key, {}).get("token", "🚀"))
    with board.open("rb") as img:
        await update.message.reply_photo(img)


async def main():
    token = os.getenv("BOT_TOKEN")
    if not token:
        raise RuntimeError("BOT_TOKEN environment variable not set")

    application = Application.builder().token(token).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("roll", roll))
    application.add_handler(CommandHandler("position", position))
    application.add_handler(CommandHandler("reset", reset))
    application.add_handler(CommandHandler("board", board_cmd))

    await application.initialize()
    await application.start()
    await application.updater.start_polling()
    await application.idle()


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
