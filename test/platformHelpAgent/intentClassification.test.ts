import { classifyIntent, runNLU } from '../../packages/agent-core/src/nlu.js';

describe('intent classification', () => {
  test('classifies login intent', () => {
    expect(classifyIntent('i cannot login to my account')).toBe('account_login');
  });

  test('extracts entities with slang and platform/version', () => {
    const result = runNLU('lobi for snooker is lagging on Android v1.2.3');
    expect(result.intent).toBe('lobby_matchmaking');
    expect(result.entities.game).toBe('snooker');
    expect(result.entities.platform).toBe('android');
    expect(result.entities.version).toBe('v1.2.3');
  });
});
