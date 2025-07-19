import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type GameStakeConfig = { developer: Address };

export function gameStakeConfigToCell(config: GameStakeConfig): Cell {
  return beginCell().storeAddress(config.developer).endCell();
}

export class GameStake implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new GameStake(address);
  }

  static createFromConfig(config: GameStakeConfig, code: Cell, workchain = 0) {
    const data = gameStakeConfigToCell(config);
    const init = { code, data };
    return new GameStake(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendEndGame(provider: ContractProvider, via: Sender, winner: Address, value: bigint, queryId = 0) {
    const body = beginCell()
      .storeUint(1, 32)
      .storeUint(queryId, 64)
      .storeAddress(winner)
      .endCell();
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body,
    });
  }
}
