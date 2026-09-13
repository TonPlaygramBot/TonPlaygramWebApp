import fs from 'node:fs';

const arenaSource = fs.readFileSync(
  new URL('../webapp/src/pages/Games/TexasHoldemArena.jsx', import.meta.url),
  'utf8'
);

describe("Texas Hold'em restored human characters", () => {
  test('keeps the original seven-character model roster', () => {
    const themeBlock = arenaSource.match(
      /const TEXAS_DOMINO_CHARACTER_THEMES = Object\.freeze\(\[([\s\S]*?)\]\);/
    )?.[1];

    expect(themeBlock).toBeDefined();
    expect(themeBlock.match(/\{ id:/g)).toHaveLength(7);
    expect(themeBlock).toContain("id: 'rpm-current-domino'");
    expect(themeBlock).toContain("id: 'rpm-67d411-domino'");
    expect(themeBlock).toContain("id: 'rpm-67f433-domino'");
    expect(themeBlock).toContain("id: 'rpm-67e1b5-domino'");
    expect(themeBlock).toContain("id: 'webgl-vietnam-human-domino'");
    expect(themeBlock).toContain("id: 'webgl-ai-teacher-domino'");
    expect(themeBlock).toContain("id: 'webgl-ai-teacher-1-domino'");
  });

  test('locks the restored size and seating calibration', () => {
    expect(arenaSource).toMatch(/TEXAS_DOMINO_CHARACTER_PROPORTION_SCALE = 1\.82;/);
    expect(arenaSource).toMatch(/TEXAS_DOMINO_HUMAN_CHARACTER_SCALE_BOOST = 0;/);
    expect(arenaSource).toMatch(/TEXAS_MURLAN_SEATED_OFFSET_Y = -0\.92;/);
    expect(arenaSource).toMatch(/TEXAS_MURLAN_SEATED_OFFSET_Z = -0\.24;/);
    expect(arenaSource).toMatch(/TEXAS_MURLAN_CHARACTER_EXTRA_OUTWARD_OFFSET = 0\.88;/);
    expect(arenaSource).toMatch(/TEXAS_MURLAN_CHARACTER_EXTRA_LOWER_OFFSET = 0\.28;/);
    expect(arenaSource).toMatch(/TEXAS_CHARACTER_TABLE_INWARD_OFFSET = 1\.2;/);
    expect(arenaSource).toMatch(/TEXAS_HUMAN_CHARACTER_TABLE_INWARD_OFFSET = 1\.0;/);
    expect(arenaSource).toMatch(/TEXAS_HUMAN_CHARACTER_EXTRA_LOWER_OFFSET = 0\.24;/);
  });

  test('mounts a character at every seat and retains interaction poses', () => {
    expect(arenaSource).toMatch(
      /seatGroups\.push\(seatGroup\);\s*attachTexasDominoCharacterToSeat\(seatGroup, seatIndex, renderer\)/
    );
    expect(arenaSource).toContain("runTexasCharacterPoseAction(seat, 'CARDS')");
    expect(arenaSource).toContain("runTexasCharacterPoseAction(seat, 'FOLD')");
    expect(arenaSource).toContain("runTexasCharacterPoseAction(seat, 'CHIP')");
    expect(arenaSource).toContain("runTexasCharacterPoseAction(seat, 'CHECK')");
  });
});
