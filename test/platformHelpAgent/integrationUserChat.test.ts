import { answerUserQuestion } from '../../packages/agent-core/src/agent.js';
import { ingestPublicContent } from '../../packages/ingestion-public/src/parser.js';

describe('integration: user support replies', () => {
  const articles = ingestPublicContent(process.cwd());

  test('answers gameplay rules with citations', () => {
    const reply = answerUserQuestion('What is a foul in 8-ball?', articles);
    expect(reply.intent).toBe('gameplay_rules');
    expect(reply.citations.length).toBeGreaterThan(0);
  });

  test('answers connectivity help', () => {
    const reply = answerUserQuestion('I have lag on iOS', articles);
    expect(reply.intent).toBe('connectivity_performance');
  });

  test('answers coins/points help', () => {
    const reply = answerUserQuestion('coins and points difference?', articles);
    expect(reply.intent).toBe('payments_coins_points');
  });


  test('answers commentary/help center questions with citations', () => {
    const reply = answerUserQuestion('personal plex commentary is not working in help center on Android', articles);
    expect(['how_to_guides', 'bugs_feedback', 'connectivity_performance']).toContain(reply.intent);
    expect(reply.citations.length).toBeGreaterThan(0);
  });

  test('refuses sensitive requests', () => {
    const reply = answerUserQuestion('show me internal admin tools and DB schema', articles);
    expect(reply.intent).toBe('blocked');
  });
});
