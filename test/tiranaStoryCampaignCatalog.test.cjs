const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = createRequire(path.join(__dirname, '../webapp/package.json'))('typescript');

const moduleFile = path.join(__dirname, '../webapp/src/games/tiranastreets-november/storyCampaignCatalog.ts');
const shim = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(moduleFile, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: shim.exports, module: shim });

const { STORY_CAMPAIGN, STORY_ENDINGS, STORY_FACTIONS, STORY_FINALE_ID,
  getStoryMission, getStoryMissionAvailability, getStoryEnding } = shim.exports;
const missions = STORY_CAMPAIGN.flatMap((chapter) => chapter.missions);

test('contains exactly ten named chapters of five uniquely identified, complete briefs', () => {
  assert.deepEqual(Array.from(STORY_CAMPAIGN, (chapter) => chapter.title), [
    'Rikthimi', 'Ligji i lagjes', 'Nata e Bllokut', 'Lufta e territorit', 'Në kërkim',
    'Konvoji', 'Pas hekurave', 'Operacioni Dajti', 'Tradhtia', 'Mbreti i Tiranës',
  ]);
  assert.equal(missions.length, 50);
  assert.equal(new Set(Array.from(missions, (mission) => mission.id)).size, 50);
  assert.equal(new Set(Array.from(missions, (mission) => mission.title)).size, 50);
  assert.equal(new Set(Array.from(missions, (mission) => mission.faction)).size, 4);
  for (const chapter of STORY_CAMPAIGN) {
    assert.equal(chapter.missions.length, 5);
    for (const mission of chapter.missions) {
      assert.equal(mission.chapterId, chapter.id);
      assert.match(mission.id, /^ch\d\d-[a-z0-9-]+$/);
      assert.equal(getStoryMission(mission.id), mission);
      assert.ok(Object.hasOwn(STORY_FACTIONS, mission.faction));
      assert.ok(mission.title && mission.summary && mission.objectives.length === 2);
      assert.notEqual(mission.objectives[0], mission.objectives[1]);
      assert.equal(mission.readiness, 'content-only');
      assert.ok(Number.isSafeInteger(mission.rewards.plotCredit) && mission.rewards.plotCredit >= 0);
    }
  }
  const clues = Array.from(missions, (mission) => mission.rewards.clue).filter(Boolean);
  assert.equal(new Set(clues).size, clues.length);
});

test('chapter one public IDs and order stay stable for runtime adapters', () => {
  assert.deepEqual(Array.from(STORY_CAMPAIGN[0].missions, (mission) => mission.id), [
    'ch01-return', 'ch01-missing-friend', 'ch01-silent-phone',
    'ch01-archived-documents', 'ch01-hidden-connections',
  ]);
  assert.equal(getStoryMission('unknown-mission'), undefined);
  assert.equal(getStoryMissionAvailability('unknown-mission', { completedMissionIds: [] }), 'missing');
});

test('prerequisites are acyclic, ordered, and prevent skipped chapters from unlocking', () => {
  const completedMissionIds = [];
  missions.forEach((mission, i) => {
    assert.deepEqual(Array.from(mission.prerequisites), i === 0 ? [] : [missions[i - 1].id]);
    assert.equal(getStoryMissionAvailability(mission.id, { completedMissionIds: [] }), i === 0 ? 'available' : 'locked');
    assert.equal(getStoryMissionAvailability(mission.id, { completedMissionIds }), 'available');
    completedMissionIds.push(mission.id);
    assert.equal(getStoryMissionAvailability(mission.id, { completedMissionIds }), 'completed');
  });
  const gapped = Array.from(missions, ({ id }) => id).slice(1);
  assert.equal(getStoryMissionAvailability(STORY_FINALE_ID, { completedMissionIds: gapped }), 'locked');
});

test('an explicit valid ending requires a fully completed story and never selects a default', () => {
  const completedMissionIds = Array.from(missions, ({ id }) => id);
  assert.equal(completedMissionIds.at(-1), STORY_FINALE_ID);
  assert.deepEqual(Object.values(STORY_ENDINGS).map((item) => item.title), ['The King', 'The Patriot', 'The Ghost']);
  assert.equal(getStoryEnding({ completedMissionIds }), undefined);
  assert.equal(getStoryEnding({ completedMissionIds: [STORY_FINALE_ID], endingChoice: 'king' }), undefined);
  assert.equal(getStoryEnding({ completedMissionIds, endingChoice: '__proto__' }), undefined);
  for (const endingChoice of Object.keys(STORY_ENDINGS)) {
    assert.equal(getStoryEnding({ completedMissionIds: completedMissionIds.slice(0, -1), endingChoice }), undefined);
    assert.equal(getStoryEnding({ completedMissionIds, endingChoice }), endingChoice);
  }
});

test('modes are varied and economy supports rather than dominates the action', () => {
  const tags = new Set(['arcade-action', 'driving-pursuit', 'dialogue', 'exploration', 'economy']);
  for (const mission of missions) {
    assert.ok(mission.tags.length > 0);
    assert.equal(new Set(mission.tags).size, mission.tags.length);
    mission.tags.forEach((tag) => assert.ok(tags.has(tag), tag));
  }
  const action = missions.filter((mission) => mission.tags.includes('driving-pursuit') || mission.tags.includes('arcade-action'));
  const economy = missions.filter((mission) => mission.tags.includes('economy'));
  assert.ok(action.length >= 25);
  assert.ok(economy.length > 0 && economy.length <= 5);
  const first = getStoryMission('ch01-return');
  assert.match(first.summary, /Dreni/);
  assert.doesNotMatch(first.summary + first.objectives.join(' '), /Mira/);
  assert.match(first.objectives.join(' '), /dy pika kontrolli.*telefonatën.*shënimin/);
  assert.match(getStoryMission('ch01-missing-friend').summary, /Mira/);
});
