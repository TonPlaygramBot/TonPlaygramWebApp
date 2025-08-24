# nineball.py
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Set, Dict, Optional, Literal
import random

Player = Literal["A", "B"]


# ---------------------------------------------------------------------
# Config structures
# ---------------------------------------------------------------------
@dataclass
class RulesConfig9:
    nineOnBreak: Literal["win", "spot&continue"] = "win"
    allowJump: bool = True
    threeFoulLoss: bool = True
    cushionRequirementIfNoPot: bool = True


@dataclass
class AIConfig9:
    mcSamples: int = 48
    finishValue: float = 1.0
    winValue: float = 3.0
    alpha_oppOpen: float = 0.8
    beta_oppRunOut: float = 1.2
    gamma_oppFoul: float = 0.5
    combo9Bias: float = 0.9
    safetyThreshold: float = 0.25


# ---------------------------------------------------------------------
# Game state & shot types
# ---------------------------------------------------------------------
@dataclass
class GameState:
    ballsOnTable: Set[int] = field(default_factory=lambda: set(range(1, 10)))
    cueInPocket: bool = False
    currentPlayer: Player = "A"
    breaker: Player = "A"
    isPushOutAvailable: bool = False
    consecutiveFouls: Dict[Player, int] = field(default_factory=lambda: {"A": 0, "B": 0})
    lastShot: Optional["ShotResult"] = None
    frameOver: bool = False
    winner: Optional[Player] = None


@dataclass
class ShotInput:
    firstContactBall: Optional[int]
    pottedBalls: List[int]
    cuePotted: bool
    anyBallHitCushionAfterContact: bool
    cueOffTable: bool
    isBreak: bool
    isPushOutDeclared: bool


@dataclass
class ShotResult:
    legal: bool
    foul: bool
    reason: Optional[str]
    pottedBalls: List[int]
    pushOutUsed: bool
    nextPlayer: Player
    ballInHandNext: bool
    frameOver: bool
    winner: Optional[Player] = None


# ---------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------
def other(player: Player) -> Player:
    return "B" if player == "A" else "A"


# ---------------------------------------------------------------------
# Rules engine
# ---------------------------------------------------------------------
def applyShot(state: GameState, inp: ShotInput, cfg: RulesConfig9) -> ShotResult:
    lowest = min(state.ballsOnTable)
    newTable = set(state.ballsOnTable)

    # 1) Handle push-out
    if inp.isPushOutDeclared:
        if not state.isPushOutAvailable:
            return ShotResult(False, True, "illegal push-out", inp.pottedBalls,
                              True, other(state.currentPlayer), True, False)
        foul = inp.cueOffTable
        nextPlayer = other(state.currentPlayer)
        result = ShotResult(not foul, foul, "illegal push-out" if foul else None,
                            inp.pottedBalls, True, nextPlayer, foul, False)
        state.isPushOutAvailable = False
        state.lastShot = result
        return result

    # 2) Legality check
    foul = False
    reason = None

    if inp.firstContactBall != lowest:
        foul = True
        reason = "wrong first contact"
    if cfg.cushionRequirementIfNoPot and not inp.pottedBalls and not inp.anyBallHitCushionAfterContact:
        foul = True
        reason = reason or "no rail after contact"
    if inp.cuePotted or inp.cueOffTable:
        foul = True
        reason = "scratch"

    # 3) Update table
    for b in inp.pottedBalls:
        newTable.discard(b)

    # 4) Nine-ball handling
    if 9 in inp.pottedBalls:
        if not foul:
            res = ShotResult(True, False, None, inp.pottedBalls, False,
                             state.currentPlayer, False, True, state.currentPlayer)
            state.ballsOnTable.clear()
            state.frameOver = True
            state.winner = state.currentPlayer
            state.lastShot = res
            return res
        else:
            newTable.add(9)

    # 5) Update consecutive fouls
    cons = dict(state.consecutiveFouls)
    cons[state.currentPlayer] = cons[state.currentPlayer] + 1 if foul else 0

    # 6) Three-foul rule
    if cfg.threeFoulLoss and cons[state.currentPlayer] >= 3:
        res = ShotResult(False, True, "three fouls", inp.pottedBalls, False,
                         other(state.currentPlayer), True, True, other(state.currentPlayer))
        state.ballsOnTable = newTable
        state.consecutiveFouls = {"A": 0, "B": 0}
        state.frameOver = True
        state.winner = other(state.currentPlayer)
        state.lastShot = res
        return res

    # 7) Decide next player
    if foul:
        nextPlayer = other(state.currentPlayer)
        BIH = True
    else:
        nextPlayer = state.currentPlayer if inp.pottedBalls else other(state.currentPlayer)
        BIH = False

    res = ShotResult(not foul, foul, reason, inp.pottedBalls, False,
                     nextPlayer, BIH, False)

    # Update state
    state.ballsOnTable = newTable
    state.currentPlayer = nextPlayer
    state.consecutiveFouls = cons
    state.cueInPocket = inp.cuePotted
    state.isPushOutAvailable = inp.isBreak  # only after break
    state.lastShot = res
    return res


# ---------------------------------------------------------------------
# Simplified AI
# ---------------------------------------------------------------------
@dataclass
class Plan9:
    action: Literal["pot", "combo9", "bank", "kick", "safety", "pushout"]
    targetBall: int
    pocket: Optional[str]
    cueParams: Dict[str, str]
    aimPoint: Dict[str, float]
    positionWindow: Dict[str, float]
    EV: float
    notes: str


def selectShot(state: GameState, tableGeom: dict, cfg: AIConfig9, rulesCfg: RulesConfig9) -> Plan9:
    """
    Very simplified decision:
    - If push-out is available, sometimes use it.
    - If lowest ball has "direct line" (stubbed), attempt pot with EV ~0.5.
    - Otherwise play safety with low risk.
    """
    lowest = min(state.ballsOnTable)

    def direct_line(ball):
        # stub: assume 50% chance
        return random.random() < 0.5

    if state.isPushOutAvailable and random.random() < 0.3:
        return Plan9("pushout", lowest, None, {}, {}, {}, 0.1, "Push-out to awkward position")

    if direct_line(lowest):
        ev = 0.5  # placeholder
        return Plan9("pot", lowest, "TR", {"speed": "med", "spin": "stun"},
                     {"x": 0, "y": 0}, {"x": 0, "y": 0, "r": 1}, ev,
                     f"Direct pot on {lowest}")
    else:
        ev = 0.2
        return Plan9("safety", lowest, None, {"speed": "soft", "spin": "stun"},
                     {"x": 0, "y": 0}, {"x": 0, "y": 0, "r": 1}, ev,
                     "Containment safety")


# ---------------------------------------------------------------------
# Minimal tests
# ---------------------------------------------------------------------
def _test_break_scratch():
    s = GameState()
    inp = ShotInput(1, [], True, False, False, True, False)
    cfg = RulesConfig9()
    r = applyShot(s, inp, cfg)
    assert r.foul and r.ballInHandNext and s.isPushOutAvailable


def _test_pushout():
    s = GameState(isPushOutAvailable=True)
    inp = ShotInput(None, [], False, False, False, False, True)
    cfg = RulesConfig9()
    r = applyShot(s, inp, cfg)
    assert r.legal and r.pushOutUsed and not r.foul


def _test_wrong_first_contact():
    s = GameState()
    s.ballsOnTable = {1, 2, 3}
    inp = ShotInput(2, [], False, True, False, False, False)
    cfg = RulesConfig9()
    r = applyShot(s, inp, cfg)
    assert r.foul and r.reason == "wrong first contact"


if __name__ == "__main__":
    _test_break_scratch()
    _test_pushout()
    _test_wrong_first_contact()
    print("Minimal tests passed.")
