// Reviewed against main 3927dd5 on 2026-11-17. Merged code is not a release certification.
export const ecosystemReviewDate = '2026-11-17';
export const deliveryNotice = 'Snapshot of merged code and work in progress. Merged does not mean device-tested, deployed or approved by an app store. No completion percentages or launch dates are promised.';
const pr = (number) => `https://github.com/TonPlaygramBot/TonPlaygramWebApp/pull/${number}`;
export const achievements = [
  { title: 'Native mobile foundations', status: 'Merged', source: pr(26080), summary: 'Android and iOS packaging preparation is in the shared codebase.', details: ['Capacitor synchronization and signing configuration corrected', 'iOS bridge and camera/microphone descriptions added', 'Signed binaries, device tests and store approval still required'] },
  { title: 'iOS visual asset preparation', status: 'Merged', source: pr(26086), summary: 'Icon and launch-screen generation now has regression checks.', details: ['Opaque iOS icons and unique catalog entries', 'Separate 1x, 2x and 3x splash entries', 'Xcode and physical-device validation still required'] },
  { title: 'Telegram credential validation', status: 'Merged', source: pr(26085), summary: 'A focused improvement to signed Telegram credential checking.', details: ['Timestamp, duplicate-field and user-identifier validation', 'Invalid Telegram data cannot downgrade to identity hints', 'Broader authentication and session recovery remain under review'] },
  { title: 'Snooker presentation update', status: 'Merged', source: pr(26081), summary: 'Snooker avatar/score layout and higher-resolution table assets updated.', details: ['Pool-style player and score presentation', '4K table textures added', 'Phone performance and commercial asset rights still need verification'] },
  { title: 'Snake & Ladder presentation update', status: 'Merged', source: pr(26083), summary: 'Ludo-style portrait layout and seated dice motion added.', details: ['Shared visual direction with Ludo Battle Royal', 'Board fit, controls and turn flow need physical-phone checks'] },
  { title: 'Instagram reward-video foundation', status: 'Merged', source: pr(26084), summary: 'Earn video playback now has an Instagram integration path.', details: ['Server token configuration required for direct playback', 'Live autoplay remains to be verified', 'The 15-second popup timer is not proof of video viewing'] }
];

export const roadmap = [
  { phase: 'Now', status: 'In progress', title: 'Account and reward safety', goal: 'Validate ownership and prevent duplicate or conflicting credits before release.', deliverables: ['Server-owned spin and daily reward migrations in draft review', 'Resolve legacy balance writers and reward/bonus compatibility', 'Run real database concurrency and interrupted-request tests'] },
  { phase: 'Now', status: 'In progress', title: 'Privacy and community safety', goal: 'Complete account deletion and safe community operations.', deliverables: ['Verified-identity deletion and report intake in draft review', 'Finish media cleanup, session revocation and retention handling', 'Implement user blocking and assign moderation responsibility'] },
  { phase: 'Now', status: 'In progress', title: 'Gifts and in-game communication', goal: 'Refresh the TonPlayGram gift experience without interrupting matches.', deliverables: ['Modern ecosystem gift artwork, animations and optional sound', 'Simpler purchase/send flow with safe balance handling', 'Replace game chat shortcuts with Ludo/Murlan-style audio/video controls and test each game'] },
  { phase: 'Next', status: 'Validation required', title: 'Android and iOS beta', goal: 'Produce and test signed native builds before store submission.', deliverables: ['Validate Android toolchain and iOS build on supported environments', 'Configure developer accounts, signing and store declarations', 'Test real phones, permissions, login and game performance; then stage beta rollout'] },
  { phase: 'Next', status: 'Validation required', title: 'Consistent game quality', goal: 'Verify the whole catalogue on mobile, not only individual components.', deliverables: ['Test multiplayer reconnection, call lifecycle and portrait controls', 'Measure loading, memory and frame rate on mid-range devices', 'Review asset licences and accessibility before public release'] },
  { phase: 'Later', status: 'Planned', title: 'TON and Solana ecosystem', goal: 'Plan token utility responsibly, without treating proposals as launched features.', deliverables: ['Confirm token model, global supply and network architecture', 'Complete legal, security and economic review before presale or minting', 'Validate any ownership, marketplace and cross-chain claims before promotion'] }
];

export const tokenomics = [
  { value: '90%', title: 'Player-side value', text: 'On a paid match, 90% is outside the platform fee and follows the clearly displayed match or prize rules.' },
  { value: '4%', title: 'Player rewards', text: 'Competitive incentives, prize programs and rewards that bring value back to active players.' },
  { value: '3%', title: 'Treasury & liquidity', text: 'Reserves intended to support long-term ecosystem stability and responsible liquidity planning.' },
  { value: '2%', title: 'Product & infrastructure', text: 'Servers, security, development, audits, support and continuous game improvements.' },
  { value: '1%', title: 'Community growth', text: 'Campaigns, creator initiatives, education and carefully selected partnerships.' }
]

export const gameDetails = [
  ['Texas Hold’em', 'Poker competition with quick matchmaking, table stakes, private play, AI practice and hand evaluation.'],
  ['Domino Royal 3D', 'Classic domino tactics with online rooms, AI opponents, turn controls and a polished 3D table.'],
  ['Pool Royale', 'A full cue-sports experience with training, career progression, online matches, aim assistance, spin and equipment.'],
  ['Snooker Royal', 'Precision snooker with regulation-inspired tables, online lobbies, inventory choices and tactical shot play.'],
  ['Air Hockey', 'Fast one-on-one puck battles designed for immediate touch controls and short competitive sessions.'],
  ['Snake & Ladder', 'A friendly dice race with solo and multiplayer routes, quick rooms and shareable results.'],
  ['Murlan Royale', 'Competitive card tactics with online matchmaking, character presentation and room-based play.'],
  ['Chess Battle Royal', 'Chess with AI and online competition, private codes, side preferences, validation and themed 3D presentation.'],
  ['Checkers Battle Royal', 'Authoritative checkers rules, matchmaking, AI play and a premium shared arena.'],
  ['4 in a Row', 'Quick strategic rounds against players or AI on the Battle Royal visual system.'],

  ['Ludo Battle Royal', 'A lively multi-player race with configurable player counts, AI, safe spaces and home-lane progression.']
]
