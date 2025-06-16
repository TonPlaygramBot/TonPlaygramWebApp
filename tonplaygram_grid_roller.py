"""TonPlaygram dice-rolling game bot.

This bot replicates the core mechanic of the TonPlaygram telegram bot using
Telegram's built-in dice animation and a 3D-looking board rendered with Pillow.
"""

import os
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "tonplaygram_data.json"
BOARD_TEMPLATE = BASE_DIR / "board_template.png"
BOARD_SIZE = 512
TILE_SIZE = BOARD_SIZE // 10


def load_data():
    if DATA_FILE.exists():
        with DATA_FILE.open("r") as f:
            return json.load(f)
    return {}


def save_data(data):
    with DATA_FILE.open("w") as f:
        json.dump(data, f)


def user_key(update: Update) -> str:
    return f"{update.effective_chat.id}:{update.effective_user.id}"


def board_coordinates(position: int):
    tile = position - 1
    row = tile // 10  # 0 is bottom row
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
    except Exception:
        font = ImageFont.load_default()

    tile_num = 1
    for r in range(10):
        real_row = 9 - r
        for c in range(10):
            col = c if r % 2 == 0 else 9 - c
            x = col * TILE_SIZE
            y = real_row * TILE_SIZE
            color = (110 + (c % 2) * 10, 60, 40)
            draw.rectangle([x, y, x + TILE_SIZE, y + TILE_SIZE], fill=color)
            # simple 3D effect using highlights and shadows
            draw.line([x, y, x + TILE_SIZE, y], fill=(color[0] + 30, color[1] + 30, color[2] + 30), width=2)
            draw.line([x, y, x, y + TILE_SIZE], fill=(color[0] + 30, color[1] + 30, color[2] + 30), width=2)
            draw.line([x + TILE_SIZE, y, x + TILE_SIZE, y + TILE_SIZE], fill=(color[0] - 30, color[1] - 30, color[2] - 30), width=2)
            draw.line([x, y + TILE_SIZE, x + TILE_SIZE, y + TILE_SIZE], fill=(color[0] - 30, color[1] - 30, color[2] - 30), width=2)
            draw.text((x + TILE_SIZE / 2, y + TILE_SIZE / 2), str(tile_num), fill="white", font=font, anchor="mm")
            tile_num += 1

    base.save(BOARD_TEMPLATE)
    return base


def generate_board(position: int, token: str) -> Path:
    base = ensure_template().copy()
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

    out_path = Path(f"board_{position}.png")
    base.save(out_path)
    return out_path


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    key = user_key(update)
    data.setdefault(key, {"position": 1, "token": "🚀"})
    save_data(data)
    await update.message.reply_text(
        "🚀 Welcome to TonPlaygram Roller! Use /roll to explore the grid."
    )


async def position(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    key = user_key(update)
    pos = data.get(key, {"position": 1}).get("position", 1)
    await update.message.reply_text(f"📍 You are on tile {pos}.")


async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    key = user_key(update)
    user = data.get(key, {"token": "🚀"})
    user["position"] = 1
    data[key] = user
    save_data(data)
    await update.message.reply_text("🔄 Progress reset. Back to tile 1.")


async def roll(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = load_data()
    key = user_key(update)
    user = data.setdefault(key, {"position": 1, "token": "🚀"})

    dice_message = await update.message.reply_dice(emoji="🎲")
    dice_value = dice_message.dice.value
    current = user["position"]

    if current + dice_value > 100:
        await update.message.reply_text(
            f"🎲 You rolled a {dice_value} but can't move beyond tile 100. Staying on tile {current}."
        )
    else:
        current += dice_value
        user["position"] = current
        await update.message.reply_text(f"🎲 You rolled a {dice_value}! Moving to tile {current}.")

    data[key] = user
    save_data(data)

    board_path = generate_board(user["position"], user["token"])
    with board_path.open("rb") as img:
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

    await application.initialize()
    await application.start()
    await application.updater.start_polling()
    await application.idle()


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
