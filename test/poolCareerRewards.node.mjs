import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAREER_STAGES, loadCareerProgress, markCareerStageCompleted, persistCareerProgress } from '../webapp/src/utils/poolRoyaleCareerProgress.js';
import { careerRewardSummary, CAREER_GIFTS } from '../webapp/src/games/pool/careerRewards.js';

test('career gifts unlock every five sequential stages and goals pay XP once', () => {
  const progress = { completedStageIds: CAREER_STAGES.slice(0, 10).map(stage => stage.id), claimedGiftIds: [] };
  const initial = careerRewardSummary(progress);
  assert.equal(initial.gifts.filter(gift => gift.unlocked).length, 2);
  const awarded = careerRewardSummary({ ...progress, claimedGiftIds: ['gift-5', 'gift-5'] });
  assert.equal(awarded.xp - initial.xp, CAREER_GIFTS[0].xp);
  assert.equal(careerRewardSummary({ ...progress, completedStageIds: progress.completedStageIds.slice(1) }).gifts.filter(gift => gift.unlocked).length, 0);
  assert.equal(careerRewardSummary({ completedStageIds: [], claimedGiftIds: ['gift-100'] }).xp, 0);
  const all = careerRewardSummary({ completedStageIds: CAREER_STAGES.map(stage => stage.id), claimedGiftIds: CAREER_GIFTS.map(gift => gift.id) });
  assert.equal(all.goals.every(goal => goal.done), true);
  assert.equal(all.titles.at(-1), 'Pool Legend');
  assert.equal(new Set(CAREER_GIFTS.map(gift => `${gift.type}:${gift.optionId}`)).size, 20);
});
test('old saves migrate, repeat completion is idempotent and gift claims survive reload', () => {
  const map = new Map();
  globalThis.window = { localStorage: { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) } };
  try {
    map.set('poolRoyaleCareerProgress_v2', JSON.stringify({ completedStageIds: [CAREER_STAGES[0].id, 'invalid-stage'] }));
    assert.deepEqual(loadCareerProgress().completedStageIds, [CAREER_STAGES[0].id]);
    assert.deepEqual(loadCareerProgress().claimedGiftIds, []);
    markCareerStageCompleted(CAREER_STAGES[0].id);
    assert.equal(loadCareerProgress().completedStageIds.length, 1);
    persistCareerProgress({ ...loadCareerProgress(), claimedGiftIds: CAREER_GIFTS.map(gift => gift.id) });
    assert.equal(loadCareerProgress().claimedGiftIds.length, 20);
  } finally { delete globalThis.window; }
});
