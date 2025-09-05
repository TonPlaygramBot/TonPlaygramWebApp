import { FrameState, ShotEvent } from '../types';
import { Referee } from './Referee';

export class FrameService {
  constructor(private referee: Referee) {}

  takeBreak(state: FrameState, sequence: ShotEvent[][]): FrameState {
    let current = state;
    for (const shot of sequence) {
      current = this.referee.applyShot(current, shot);
      if (this.isFrameOver(current)) break;
    }
    return current;
  }

  isFrameOver(state: FrameState): boolean {
    return !!state.frameOver;
  }

  getWinner(state: FrameState): 'A' | 'B' | 'TIE' | undefined {
    return state.winner;
  }
}
