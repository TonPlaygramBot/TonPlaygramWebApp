const GAMES = [
  { key: 'pool-royale', title: 'Pool Royale', url: '/games/pool-royale-lobby' },
  { key: 'snooker-royal', title: 'Snooker Royal', url: '/games/snooker-royal-lobby' },
  { key: 'texas-holdem', title: 'Texas Holdem Arena', url: '/games/texas-holdem-lobby' },
  { key: 'domino-royal', title: 'Domino Royal', url: '/games/domino-royal-lobby' },
  { key: 'air-hockey', title: 'Air Hockey', url: '/games/air-hockey-lobby' },
  { key: 'goal-rush', title: 'Goal Rush', url: '/games/goal-rush-lobby' },
  { key: 'snake-multiplayer', title: 'Snake Multiplayer', url: '/games/snake' },
  { key: 'chess-battle-royal', title: 'Chess Battle Royal', url: '/games/chess-battle-royal-lobby' },
  { key: 'ludo-battle-royal', title: 'Ludo Battle Royal', url: '/games/ludo-battle-royal-lobby' },
  { key: 'murlan-royale', title: 'Murlan Royale', url: '/games/murlan-royale-lobby' }
];

const INTENTS = [
  {
    key: 'start-match',
    questionTemplate: (game, channel, profile) =>
      `How do I start a ${game.title} match on ${channel} with ${profile} settings?`,
    answerTemplate: (game, channel, profile) =>
      `Open ${game.title}, choose ${profile} options, and confirm matchmaking from ${channel}.`,
    tags: ['start', 'matchmaking', 'queue']
  },
  {
    key: 'lag-fix',
    questionTemplate: (game, channel) =>
      `Why is ${game.title} lagging on ${channel} and what should I do first?`,
    answerTemplate: (game) =>
      `For ${game.title} lag, switch network, restart the app, and retry from the lobby before rejoining.`,
    tags: ['lag', 'performance', 'troubleshooting']
  },
  {
    key: 'wallet-payment',
    questionTemplate: (game, _channel, profile) =>
      `How do I pay entry fees for ${game.title} using my ${profile} wallet setup?`,
    answerTemplate: (game) =>
      `Use Wallet to verify TPC/TON balance, then return to ${game.title} and confirm the fee prompt.`,
    tags: ['wallet', 'fees', 'payment']
  },
  {
    key: 'rules',
    questionTemplate: (game, channel) =>
      `Where can I review official ${game.title} rules before playing on ${channel}?`,
    answerTemplate: (game) =>
      `From the ${game.title} lobby open Rules/Info, read the win conditions, then start your match.`,
    tags: ['rules', 'how to play', 'foul']
  },
  {
    key: 'inventory',
    questionTemplate: (game, _channel, profile) =>
      `How do I equip my ${profile} inventory items in ${game.title}?`,
    answerTemplate: (game) =>
      `Open Store or inventory, equip supported cosmetics for ${game.title}, and verify them in pre-match preview.`,
    tags: ['inventory', 'skins', 'customization']
  },
  {
    key: 'voice-audio',
    questionTemplate: (game, channel) =>
      `I cannot hear AI voice in ${game.title} on ${channel}. How can I fix it?`,
    answerTemplate: (game, channel) =>
      `Enable voice toggle, tap Voice Test, raise phone media volume, and retry ${game.title} while ${channel} remains in foreground.`,
    tags: ['voice', 'audio', 'telegram']
  },
  {
    key: 'screenshots',
    questionTemplate: (game) =>
      `When should I attach screenshots for ${game.title} support?`,
    answerTemplate: (game) =>
      `Attach screenshots for ${game.title} when UI state, error text, or result mismatch is important for support triage.`,
    tags: ['screenshot', 'support', 'bug report']
  },
  {
    key: 'rewards',
    questionTemplate: (game, _channel, profile) =>
      `How do rewards work in ${game.title} for ${profile} players?`,
    answerTemplate: (game) =>
      `${game.title} rewards depend on match result and task completion; claim from Tasks/Wallet once marked complete.`,
    tags: ['rewards', 'tasks', 'progress']
  },
  {
    key: 'fair-play',
    questionTemplate: (game, channel) =>
      `How do I report unfair play in ${game.title} on ${channel}?`,
    answerTemplate: (game) =>
      `Open profile or match history, submit a report with reason and screenshot evidence for ${game.title}.`,
    tags: ['report', 'fair play', 'safety']
  },
  {
    key: 'reconnect',
    questionTemplate: (game, channel, profile) =>
      `How do I reconnect to ${game.title} after disconnection on ${channel} (${profile})?`,
    answerTemplate: (game) =>
      `Reopen the app, return to ${game.title} lobby, and use reconnect/queue resume if the session is still active.`,
    tags: ['disconnect', 'reconnect', 'session']
  }
];

const CHANNELS = ['Telegram mobile app', 'web browser', 'desktop app', 'Android', 'iOS', 'mobile data', 'Wi-Fi', 'slow network', 'public hotspot', 'travel mode'];
const PROFILES = ['new user', 'casual player', 'ranked player', 'high-stakes player', 'returning player', 'PWA player', 'wallet-connected player', 'guest profile', 'competitive profile', 'daily player'];

function buildScenario(game, intent, channel, profile, index) {
  const slug = `${game.key}-${intent.key}-${channel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${profile.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const question = intent.questionTemplate(game, channel, profile);
  const answer = intent.answerTemplate(game, channel, profile);

  return {
    id: `generated-${index + 1}`,
    title: `${game.title}: ${intent.key.replace('-', ' ')}`,
    slug,
    sectionId: `scenario-${String(index + 1).padStart(4, '0')}`,
    url: game.url,
    tags: [...intent.tags, game.key, channel.toLowerCase(), profile.toLowerCase()],
    question,
    answer,
    steps: [
      `Go to Home → Games → ${game.title}.`,
      `Apply the scenario context: ${channel} + ${profile}.`,
      'Follow the in-app prompts and confirm all visible warnings before proceeding.'
    ],
    notes: [
      'For visual mismatches, attach screenshot(s) with visible time and page name.',
      'Use Voice Test first on Telegram mobile, then keep the app foreground while listening.'
    ]
  };
}

export function buildGeneratedHelpScenarios() {
  const scenarios = [];
  let index = 0;
  for (const game of GAMES) {
    for (const intent of INTENTS) {
      for (const channel of CHANNELS) {
        for (const profile of PROFILES) {
          scenarios.push(buildScenario(game, intent, channel, profile, index));
          index += 1;
        }
      }
    }
  }
  return scenarios;
}

export const GENERATED_PLATFORM_HELP_SCENARIOS = buildGeneratedHelpScenarios();
