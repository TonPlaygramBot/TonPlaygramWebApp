# TonPlaygram Ludo Bot
# Simplified multiplayer Ludo implementation for Telegram

import json
import os
from pathlib import Path
from typing import Dict, List

from PIL import Image, ImageDraw, ImageFont
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "ludo_sessions.json"
BOARD_TEMPLATE = BASE_DIR / "ludo_board.png"
BOARD_SIZE = 600  # increased so each cell matches dice size
GRID = 15
CELL = BOARD_SIZE // GRID
PATH_LENGTH = 64
HOME_STEPS = 6

COLORS = {
    "red": (220, 50, 50),
    "blue": (70, 100, 230),
    "yellow": (240, 200, 40),
    "green": (50, 170, 80),
}
TOKENS = {
    # placeholder, actual images generated at runtime
    "red": None,
    "blue": None,
    "yellow": None,
    "green": None,
}

DICE_SPRITE = None
COLOR_ORDER = ["red", "blue", "yellow", "green"]
START_INDICES = {
    "red": 0,
    "blue": 16,
    "yellow": 32,
    "green": 48,
}

def _create_dice_sprite(size:int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, size-1, size-1], fill="white", outline="black", width=2)
    r = size // 6
    draw.ellipse((size/2 - r, size/2 - r, size/2 + r, size/2 + r), fill="black")
    return img

def init_token_images():
    sz = CELL - 4
    for name, color in COLORS.items():
        token = _create_dice_sprite(sz)
        border = Image.new("RGBA", token.size, (*color, 0))
        draw = ImageDraw.Draw(border)
        draw.rectangle([0,0,sz-1,sz-1], outline=color, width=3)
        token = Image.alpha_composite(token, border)
        TOKENS[name] = token

# 64-step loop approximating a Ludo board
PATH: List[tuple[int, int]] = [
    (6,1),(6,2),(6,3),(6,4),(6,5),
    (5,5),(4,5),(3,5),(2,5),(1,5),(0,5),
    (0,6),(0,7),(1,7),(2,7),(3,7),
    (4,7),(5,7),(5,8),(5,9),(5,10),
    (4,10),(3,10),(2,10),(1,10),(0,10),
    (0,11),(0,12),(1,12),(2,12),(3,12),
    (4,12),(5,12),(6,12),(6,13),(6,14),
    (7,14),(8,14),(8,13),(8,12),(8,11),
    (8,10),(8,9),(9,9),(10,9),(11,9),
    (12,9),(13,9),(14,9),(14,8),(14,7),
    (13,7),(12,7),(11,7),(10,7),(9,7),
    (9,6),(9,5),(9,4),(9,3),(9,2),
    (9,1),(8,1),(7,1)
]


def load_sessions() -> Dict:
    if DATA_FILE.exists():
        with DATA_FILE.open("r") as f:
            return json.load(f)
    return {}


def save_sessions(data: Dict):
    with DATA_FILE.open("w") as f:
        json.dump(data, f)


def ensure_board_template() -> Image.Image:
    if BOARD_TEMPLATE.exists():
        return Image.open(BOARD_TEMPLATE).convert("RGBA")

    global DICE_SPRITE
    DICE_SPRITE = _create_dice_sprite(CELL - 8)

    img = Image.new("RGBA", (BOARD_SIZE, BOARD_SIZE), (20, 20, 30))
    draw = ImageDraw.Draw(img)
    base_size = CELL * 6

    # subtle gradient background for depth
    for i in range(BOARD_SIZE):
        shade = 20 + int(10 * i / BOARD_SIZE)
        draw.line([(0, i), (BOARD_SIZE, i)], fill=(shade, shade, shade + 10))

    # bases
    draw.rectangle([0,0,base_size,base_size], fill=COLORS["red"])
    draw.rectangle([BOARD_SIZE-base_size,0,BOARD_SIZE,base_size], fill=COLORS["blue"])
    draw.rectangle([0,BOARD_SIZE-base_size,base_size,BOARD_SIZE], fill=COLORS["green"])
    draw.rectangle([BOARD_SIZE-base_size,BOARD_SIZE-base_size,BOARD_SIZE,BOARD_SIZE], fill=COLORS["yellow"])

    for (r,c) in PATH:
        x=c*CELL
        y=r*CELL
        # shadow
        draw.rectangle([x+2,y+2,x+CELL+2,y+CELL+2], fill=(0,0,0,80))
        draw.rectangle([x,y,x+CELL,y+CELL], fill=(60,60,80))
        draw.line([x,y,x+CELL,y], fill=(110,110,140), width=1)
        draw.line([x,y,x,y+CELL], fill=(110,110,140), width=1)
        draw.line([x+CELL,y,x+CELL,y+CELL], fill=(40,40,60), width=1)
        draw.line([x,y+CELL,x+CELL,y+CELL], fill=(40,40,60), width=1)
        img.paste(DICE_SPRITE,(x+(CELL-DICE_SPRITE.width)//2,
                               y+(CELL-DICE_SPRITE.height)//2),DICE_SPRITE)

    img.save(BOARD_TEMPLATE)
    return img


class GameSession:
    def __init__(self):
        self.players: List[Dict] = []
        self.tokens: Dict[int,List[int]] = {}
        self.turn = 0
        self.state = "waiting"

    def add_player(self, uid:int, username:str) -> str:
        if len(self.players) >=4:
            return "Game is full"
        if any(p["id"]==uid for p in self.players):
            return "You already joined"
        color = COLOR_ORDER[len(self.players)]
        self.players.append({"id":uid,"username":username,"color":color})
        self.tokens[uid]=[-1,-1,-1,-1]
        return f"Joined as {color}"

    def current_player(self) -> Dict:
        return self.players[self.turn % len(self.players)] if self.players else {}

    def next_turn(self,extra:bool):
        if not extra:
            self.turn=(self.turn+1)%len(self.players)


def render_board(session:GameSession) -> Path:
    if TOKENS["red"] is None:
        init_token_images()
    base=ensure_board_template().copy()
    draw=ImageDraw.Draw(base)
    try:
        font=ImageFont.truetype("DejaVuSans-Bold.ttf", CELL)
        small_font=ImageFont.truetype("DejaVuSans-Bold.ttf", CELL//2)
    except Exception:
        font=ImageFont.load_default()
        small_font=ImageFont.load_default()
    base_size = CELL*6

    positions: Dict[tuple[int,int], List[Image.Image]] = {}
    for p in session.players:
        uid=p["id"]
        color=p["color"]
        token=TOKENS[color]
        for i,steps in enumerate(session.tokens[uid]):
            if steps==-1:
                bx=1 if color in ("red","green") else BOARD_SIZE-base_size+CELL
                by=1 if color in ("red","blue") else BOARD_SIZE-base_size+CELL
                ox=(i%2)*CELL*2
                oy=(i//2)*CELL*2
                base.paste(token,(bx+ox+(CELL-token.width)//2,
                                 by+oy+(CELL-token.height)//2),token)
            else:
                if steps>=PATH_LENGTH+HOME_STEPS:
                    pos=(7,7)
                elif steps<PATH_LENGTH:
                    pos=PATH[(START_INDICES[color]+steps)%PATH_LENGTH]
                else:
                    home_idx=steps-PATH_LENGTH
                    if color=="red":
                        pos=(home_idx,7)
                    elif color=="blue":
                        pos=(7,14-home_idx)
                    elif color=="yellow":
                        pos=(14-home_idx,7)
                    else:
                        pos=(7,home_idx)
                positions.setdefault(pos,[]).append(token)

    for pos,tokens in positions.items():
        x = pos[1] * CELL + (CELL - tokens[0].width) // 2
        y = pos[0] * CELL + (CELL - tokens[0].height) // 2
        base.paste(tokens[0], (int(x), int(y)), tokens[0])
        if len(tokens)>1:
            r=CELL//3
            draw.ellipse((x+r*0.7,y-r*1.6,x+r*1.6,y-r*0.7),fill=(0,0,0,200))
            draw.text((x+r*1.15,y-r*1.15),str(len(tokens)),font=small_font,anchor="mm",fill="white")

    out=Path("ludo_board_render.png")
    base.save(out)
    return out


async def help_command(update:Update,context:ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "/startludo - new game\n/join - join game\n/begin - start game\n/roll - roll dice\n/board - show board\n/status - status\n/resetgame - reset"
    )


async def start_ludo(update:Update,context:ContextTypes.DEFAULT_TYPE):
    data=load_sessions()
    chat=str(update.effective_chat.id)
    data[chat]=GameSession().__dict__
    save_sessions(data)
    await update.message.reply_text("Ludo session created. Use /join to play")


async def join(update:Update,context:ContextTypes.DEFAULT_TYPE):
    data=load_sessions()
    chat=str(update.effective_chat.id)
    if chat not in data:
        await update.message.reply_text("No session. Use /startludo")
        return
    session=GameSession();session.__dict__.update(data[chat])
    res=session.add_player(update.effective_user.id,update.effective_user.username or "anon")
    data[chat]=session.__dict__
    save_sessions(data)
    await update.message.reply_text(res)


async def begin(update:Update,context:ContextTypes.DEFAULT_TYPE):
    data=load_sessions();chat=str(update.effective_chat.id)
    if chat not in data:
        await update.message.reply_text("No game")
        return
    session=GameSession();session.__dict__.update(data[chat])
    if session.state!="waiting":
        await update.message.reply_text("Already started")
        return
    if len(session.players)<2:
        await update.message.reply_text("Need 2 players")
        return
    session.state="in_progress";data[chat]=session.__dict__;save_sessions(data)
    await update.message.reply_text(f"Game started! {session.current_player()['username']} goes first")


def find_token(session:GameSession,uid:int,dice:int)->int:
    for i,st in enumerate(session.tokens[uid]):
        if st==-1 and dice==6:
            return i
        if st>=0 and st+dice<=PATH_LENGTH+HOME_STEPS:
            return i
    return -1


async def roll(update:Update,context:ContextTypes.DEFAULT_TYPE):
    data=load_sessions();chat=str(update.effective_chat.id)
    if chat not in data:
        await update.message.reply_text("No game")
        return
    session=GameSession();session.__dict__.update(data[chat])
    if session.state!="in_progress":
        await update.message.reply_text("Game not in progress")
        return
    player=session.current_player()
    if update.effective_user.id!=player['id']:
        await update.message.reply_text("Not your turn")
        return
    dice_msg=await update.message.reply_dice(emoji='🎲')
    dice=dice_msg.dice.value
    await update.message.reply_text(f"🎲 @{player['username']} rolled a {dice}")
    idx=find_token(session,player['id'],dice)
    if idx==-1:
        await update.message.reply_text("No valid moves. Turn passes.")
        session.next_turn(False)
    else:
        session.tokens[player['id']][idx]=max(0,session.tokens[player['id']][idx])+dice
        if session.tokens[player['id']][idx]<PATH_LENGTH:
            pos=(START_INDICES[player['color']]+session.tokens[player['id']][idx])%PATH_LENGTH
            for p in session.players:
                if p['id']==player['id']:continue
                for j,st in enumerate(session.tokens[p['id']]):
                    if 0<=st<PATH_LENGTH and (START_INDICES[p['color']]+st)%PATH_LENGTH==pos:
                        session.tokens[p['id']][j]=-1
        session.next_turn(dice==6)
    data[chat]=session.__dict__;save_sessions(data)
    board=render_board(session)
    with board.open('rb') as img:
        await update.message.reply_photo(img)


async def board_cmd(update:Update,context:ContextTypes.DEFAULT_TYPE):
    data=load_sessions();chat=str(update.effective_chat.id)
    if chat not in data:
        await update.message.reply_text("No game")
        return
    session=GameSession();session.__dict__.update(data[chat])
    board=render_board(session)
    with board.open('rb') as img:
        await update.message.reply_photo(img)


async def status(update:Update,context:ContextTypes.DEFAULT_TYPE):
    data=load_sessions();chat=str(update.effective_chat.id)
    if chat not in data:
        await update.message.reply_text("No game")
        return
    session=GameSession();session.__dict__.update(data[chat])
    lines=[]
    for p in session.players:
        home=sum(1 for s in session.tokens[p['id']] if s>=PATH_LENGTH+HOME_STEPS)
        lines.append(f"{p['username']} ({p['color']}) home {home}/4")
    lines.append(f"Turn: {session.current_player().get('username','-')}")
    await update.message.reply_text('\n'.join(lines))


async def resetgame(update:Update,context:ContextTypes.DEFAULT_TYPE):
    data=load_sessions();chat=str(update.effective_chat.id)
    if chat in data:
        del data[chat];save_sessions(data)
        await update.message.reply_text("Game reset")
    else:
        await update.message.reply_text("No active game")


async def main():
    token=os.getenv('BOT_TOKEN')
    if not token:
        raise RuntimeError('BOT_TOKEN not set')
    app=Application.builder().token(token).build()
    app.add_handler(CommandHandler('help',help_command))
    app.add_handler(CommandHandler('startludo',start_ludo))
    app.add_handler(CommandHandler('join',join))
    app.add_handler(CommandHandler('begin',begin))
    app.add_handler(CommandHandler('roll',roll))
    app.add_handler(CommandHandler('board',board_cmd))
    app.add_handler(CommandHandler('status',status))
    app.add_handler(CommandHandler('resetgame',resetgame))
    await app.initialize();await app.start();await app.updater.start_polling();await app.idle()


if __name__=='__main__':
    import asyncio
    asyncio.run(main())
