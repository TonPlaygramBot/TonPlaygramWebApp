import { GENERATED_PLATFORM_HELP_SCENARIOS } from '../../webapp/src/data/platformHelpScenarios.js';
import { searchLocalHelp } from '../../webapp/src/utils/platformHelpLocalSearch.js';

describe('generated help scenario coverage', () => {
  test('creates at least 1000 generated question and answer scenarios', () => {
    expect(GENERATED_PLATFORM_HELP_SCENARIOS.length).toBeGreaterThanOrEqual(1000);
    expect(GENERATED_PLATFORM_HELP_SCENARIOS.every((item) => item.question && item.answer)).toBe(true);
  });

  test('retrieval can match generated voice and screenshot scenarios', () => {
    const results = searchLocalHelp('I cannot hear AI voice on Telegram mobile and need screenshot guidance', 5);
    expect(results.length).toBeGreaterThan(0);
    const joined = results.map((item) => `${item.question} ${item.answer} ${item.notes.join(' ')}`).join(' ');
    expect(joined.toLowerCase()).toContain('voice');
    expect(joined.toLowerCase()).toContain('screenshot');
  });
});
