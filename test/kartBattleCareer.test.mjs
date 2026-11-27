import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATTLE_CAREER_STORAGE_KEY, BATTLE_CREWS, BATTLE_FORMATS, BATTLE_RANKS,
  getBattleCareerRank, getBattleMission, getBattleMissionStatus,
  normalizeBattleCareerProgress, readBattleCareer, recordBattleCareerResult, saveBattleCareer,
} from '../webapp/src/games/kartroyale/kartBattleCareer.mjs';
import { TRACKS } from '../webapp/src/games/kartroyale/simulation.mjs';

const missions = BATTLE_CREWS.flatMap((crew) => crew.missions);
const courses = new Set(TRACKS.map(({ id }) => id));

test('seven real catalogue course IDs, eight unique missions each ending in a named 1v1', () => {
  assert.deepEqual(BATTLE_CREWS.map(({ title }) => title), [
    'Ali Demi Warriors', 'Kombinat Steel', 'Blloku Elite', 'Astir Nitro',
    'Laprakë Ghosts', 'Dajti Titans', 'Capital Kings',
  ]);
  assert.equal(missions.length, 56);
  assert.equal(new Set(missions.map(({ id }) => id)).size, 56);
  assert.equal(new Set(missions.map(({ title }) => title)).size, 56);
  for (const crew of BATTLE_CREWS) {
    assert.ok(courses.has(crew.courseId), crew.courseId);
    const { missions } = crew;
    assert.equal(missions.length, 8);
    assert.equal(missions[7].kind, 'boss');
    assert.equal(missions[7].rivalName, crew.boss);
    assert.deepEqual(missions[7].criteria, { maxPlace: 1, opponents: 1 });
    assert.ok(missions.slice(0, 7).every((mission) => mission.kind !== 'boss'));
    assert.ok(missions.every((mission) => mission.courseId === crew.courseId && mission.readiness === 'content-only'));
  }
});

test('ranks use exact thresholds and 30k is achievable offline', () => {
  assert.deepEqual(BATTLE_RANKS.map(({ minXp }) => minXp), [0, 1000, 3000, 7000, 15000, 30000]);
  assert.deepEqual(BATTLE_RANKS.map(({ title }) => title), [
    'Rookie', 'Street Racer', 'Pro Driver', 'Elite Racer', 'Master', 'King of Tirana',
  ]);
  assert.equal(getBattleCareerRank(Infinity), BATTLE_RANKS[0]);
  assert.equal(getBattleCareerRank(-2), BATTLE_RANKS[0]);
  BATTLE_RANKS.forEach((rank, index) => {
    assert.equal(getBattleCareerRank(rank.minXp), rank);
    if (index) assert.equal(getBattleCareerRank(rank.minXp - 1), BATTLE_RANKS[index - 1]);
  });
  const complete = normalizeBattleCareerProgress({ version: 1, completedMissionIds: missions.map(({ id }) => id) });
  assert.equal(getBattleCareerRank(complete.xp), BATTLE_RANKS.at(-1));
});

test('locking, fake XP, replay awards, and unverified bindings are rejected', () => {
  const [first, second] = missions;
  const empty = normalizeBattleCareerProgress({ version: 1, xp: 30000, completedMissionIds: [second.id, 'bad'] });
  assert.deepEqual(empty, { version: 1, completedMissionIds: [], xp: 0 });
  assert.equal(getBattleMissionStatus('bad', empty), 'missing');
  assert.equal(getBattleMissionStatus(first.id, empty), 'available');
  assert.equal(getBattleMissionStatus(second.id, empty), 'locked');
  assert.equal(getBattleMission(first.id), first);
  const result = { finished: true, courseId: first.courseId, format: first.format, place: 1, opponents: 5 };
  assert.equal(recordBattleCareerResult(empty, first.id, result).accepted, false);
  assert.equal(recordBattleCareerResult(empty, first.id, { ...result, courseId: 'wrong' }, [first.id]).accepted, false);
  assert.equal(recordBattleCareerResult(empty, first.id, { ...result, place: 0 }, [first.id]).accepted, false);
  const earned = recordBattleCareerResult(empty, first.id, result, [first.id]);
  assert.equal(earned.accepted, true);
  assert.equal(earned.xpAward, first.xpAward);
  assert.equal(getBattleMissionStatus(first.id, earned.progress), 'completed');
  assert.equal(getBattleMissionStatus(second.id, earned.progress), 'available');
  assert.equal(recordBattleCareerResult(earned.progress, first.id, result, [first.id]).xpAward, 0);
});

test('boss progress requires completed prior missions and a verified one-opponent victory', () => {
  const crew = BATTLE_CREWS[0];
  const boss = crew.missions[7];
  const next = BATTLE_CREWS[1].missions[0];
  const almost = { version: 1, completedMissionIds: crew.missions.slice(0, 7).map(({ id }) => id) };
  const result = { finished: true, courseId: boss.courseId, format: boss.format, place: 1, opponents: 1 };
  assert.equal(recordBattleCareerResult({}, boss.id, result, [boss.id]).accepted, false);
  assert.equal(recordBattleCareerResult(almost, boss.id, { ...result, opponents: 5 }, [boss.id]).accepted, false);
  assert.equal(recordBattleCareerResult(almost, boss.id, { ...result, place: 2 }, [boss.id]).accepted, false);
  const earned = recordBattleCareerResult(almost, boss.id, result, [boss.id]);
  assert.equal(earned.accepted, true);
  assert.equal(getBattleMissionStatus(next.id, earned.progress), 'available');
});

test('storage reads/writes only a separate key and fails safely', () => {
  const careerKey = 'tonplaygram.kartroyale.career.v1';
  const original = '{ "ordinaryCareer": true }';
  const entries = new Map([[careerKey, original]]);
  const storage = { getItem: entries.get.bind(entries), setItem: entries.set.bind(entries) };
  assert.equal(readBattleCareer(storage).xp, 0);
  assert.equal(saveBattleCareer(storage, { version: 1, completedMissionIds: [missions[0].id] }), true);
  assert.equal(readBattleCareer(storage).xp, missions[0].xpAward);
  assert.equal(entries.get(careerKey), original);
  entries.set(BATTLE_CAREER_STORAGE_KEY, '{ broken');
  assert.equal(readBattleCareer(storage).xp, 0);
  assert.equal(saveBattleCareer({ setItem() { throw Error('quota'); } }, {}), false);
});

test('every planned result type rejects unfinished results and accepts valid telemetry in sequence', () => {
  let progress = normalizeBattleCareerProgress();
  for (const mission of missions) {
    const { criteria } = mission;
    const result = {
      finished: true, courseId: mission.courseId, format: mission.format,
      place: 1, remainingKarts: 1, arcadeObjectiveCompleted: true, pursuitCompleted: true,
      eliminationIntervalSeconds: 30, opponents: criteria.opponents,
      driftPoints: criteria.minDriftPoints, checkpoints: criteria.minCheckpoints,
      seconds: criteria.maxTimeSeconds, collisions: criteria.maxCollisions,
    };
    assert.equal(recordBattleCareerResult(progress, mission.id, { ...result, finished: false }, [mission.id]).accepted, false);
    for (const [field, invalid] of [
      ['driftPoints', criteria.minDriftPoints - 1], ['checkpoints', criteria.minCheckpoints - 1],
      ['seconds', criteria.maxTimeSeconds + 1], ['collisions', criteria.maxCollisions + 1],
    ]) {
      if (Object.hasOwn(criteria, ({ driftPoints: 'minDriftPoints', checkpoints: 'minCheckpoints', seconds: 'maxTimeSeconds', collisions: 'maxCollisions' })[field])) {
        assert.equal(recordBattleCareerResult(progress, mission.id, { ...result, [field]: invalid }, [mission.id]).accepted, false);
      }
    }
    const next = recordBattleCareerResult(progress, mission.id, result, [mission.id]);
    assert.equal(next.accepted, true, mission.id);
    progress = next.progress;
  }
  assert.equal(progress.completedMissionIds.length, missions.length);
  assert.equal(getBattleCareerRank(progress.xp).id, 'legend');
});


test('complete proposed format suite stays content-only and requires per-format telemetry', () => {
  const formats = Object.keys(BATTLE_FORMATS);
  assert.deepEqual(formats, [
    'classic', 'combat-arcade', 'last-kart-standing', 'boss',
    'police-pursuit-arcade', 'drift', 'elimination',
  ]);
  assert.equal(BATTLE_FORMATS.elimination.intervalSeconds, 30);
  assert.deepEqual(new Set(missions.map(({ format }) => format)), new Set(formats));
  assert.equal(new Set(BATTLE_CREWS.map(({ style }) => style)).size, 7);
  const invalid = [
    ['combat-arcade', { arcadeObjectiveCompleted: false }],
    ['last-kart-standing', { remainingKarts: 2 }],
    ['police-pursuit-arcade', { pursuitCompleted: false }],
    ['elimination', { eliminationIntervalSeconds: 31 }],
  ];
  for (const [format, wrong] of invalid) {
    const i = missions.findIndex((mission) => mission.format === format);
    const mission = missions[i];
    const progress = { version: 1, completedMissionIds: missions.slice(0, i).map(({ id }) => id) };
    const result = { finished: true, courseId: mission.courseId, format, place: 1, remainingKarts: 1,
      arcadeObjectiveCompleted: true, pursuitCompleted: true, eliminationIntervalSeconds: 30,
      opponents: mission.criteria.opponents, seconds: mission.criteria.maxTimeSeconds,
      checkpoints: mission.criteria.minCheckpoints, driftPoints: mission.criteria.minDriftPoints,
      collisions: mission.criteria.maxCollisions };
    assert.equal(recordBattleCareerResult(progress, mission.id, result).accepted, false, format);
    assert.equal(recordBattleCareerResult(progress, mission.id, { ...result, format: 'classic' }, [mission.id]).accepted, false, format);
    assert.equal(recordBattleCareerResult(progress, mission.id, { ...result, ...wrong }, [mission.id]).accepted, false, format);
    assert.equal(recordBattleCareerResult(progress, mission.id, result, [mission.id]).accepted, true, format);
  }
});
