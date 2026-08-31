export type AlbanianPlayer = 'A' | 'B';
export type AlbanianWinner = AlbanianPlayer | 'TIE' | null;
export type AlbanianBilliardsState = {
  ballsOnTable: Set<number>; currentPlayer: AlbanianPlayer;
  scores: Record<AlbanianPlayer, number>; ballInHand: boolean;
  frameOver: boolean; winner: AlbanianWinner; breakInProgress: boolean;
  targetScore: number;
};
export class AlbanianBilliards {
  constructor(options?: { targetScore?: number });
  state: AlbanianBilliardsState;
  shotTaken(shot?: Record<string, unknown>): any;
}
export default AlbanianBilliards;
