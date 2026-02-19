export const PLATFORM_HELP_KNOWLEDGE = [
  {
    id: 'home-overview',
    title: 'TonPlaygram overview',
    slug: 'platform-overview',
    sectionId: 'core-navigation',
    url: '/help/platform-overview',
    tags: ['home', 'overview', 'platform', 'how it works', 'navigation'],
    answer:
      'TonPlaygram is a game platform where you can play multiple game modes, manage wallet actions, track progress, and access store and NFT features from one account.',
    steps: [
      'Open Home to see balance, quick wallet actions, and platform cards.',
      'Open Games to enter each game lobby and start matchmaking.',
      'Use Wallet, Store, NFTs, Tasks, and Referral from the bottom navigation for feature-specific actions.'
    ],
    notes: [
      'Feature availability can vary by game mode and current app version.',
      'For policy-sensitive actions, support review may be required.'
    ]
  },
  {
    id: 'wallet-send-receive',
    title: 'Wallet: send and receive coins',
    slug: 'wallet-send-receive',
    sectionId: 'send-receive',
    url: '/wallet',
    tags: ['wallet', 'send', 'receive', 'coins', 'transfer', 'tpc'],
    answer:
      'Use the Wallet page to send and receive supported platform coins with explicit confirmation before submitting.',
    steps: [
      'Open Wallet and choose Send or Receive.',
      'For Send: enter the destination and amount, then review and confirm.',
      'For Receive: copy your receive details and share them with the sender.'
    ],
    notes: [
      'Always verify destination details before confirming any transfer.',
      'Network confirmations can take time depending on chain conditions.'
    ]
  },
  {
    id: 'store-overview',
    title: 'Store: items and purchases',
    slug: 'store-help',
    sectionId: 'buy-items',
    url: '/store/all',
    tags: ['store', 'shop', 'items', 'buy', 'purchase', 'skins', 'cue'],
    answer:
      'The Store is where you browse game-linked items and complete eligible purchases using available balances.',
    steps: [
      'Open Store and select a game category.',
      'Open an item card and review item details.',
      'Confirm purchase and verify that the item appears in your inventory.'
    ],
    notes: [
      'Some items are game-specific and appear only in matching inventories.',
      'If a purchase does not appear immediately, refresh and re-check inventory.'
    ]
  },
  {
    id: 'nft-buy',
    title: 'NFTs: buying flow',
    slug: 'nft-buy-flow',
    sectionId: 'buy-nft',
    url: '/nfts',
    tags: ['nft', 'buy nft', 'purchase nft', 'collectible', 'market'],
    answer:
      'You can review available NFTs on the NFTs page and complete purchases through the in-app supported flow.',
    steps: [
      'Open NFTs and select the collectible you want.',
      'Review visible details and confirm the purchase prompt.',
      'Wait for confirmation, then verify it appears in your NFT list.'
    ],
    notes: [
      'Final ownership reflects after network confirmation.',
      'If confirmation is delayed, check again after a short wait.'
    ]
  },
  {
    id: 'nft-burn',
    title: 'NFT burn support guidance',
    slug: 'nft-burn-guidance',
    sectionId: 'burn-nft',
    url: '/help/nft-burn-guidance',
    tags: ['burn nft', 'destroy nft', 'remove nft', 'nft burn'],
    answer:
      'If NFT burn is available to users in your current version, it will appear as an explicit action in NFTs; if not visible, use support to request current public guidance.',
    steps: [
      'Open NFTs and check actions shown on your collectible.',
      'If Burn is visible, review warning text and confirm carefully.',
      'If Burn is not visible, contact support from Help and ask for current user-available options.'
    ],
    notes: [
      'Burn actions are typically irreversible.',
      'Never approve actions unless you fully understand the prompt.'
    ]
  },
  {
    id: 'matchmaking-public',
    title: 'Matchmaking public behavior',
    slug: 'matchmaking-overview',
    sectionId: 'queue',
    url: '/help/how-matchmaking-works',
    tags: ['matchmaking', 'queue', 'lobby', 'wait time', 'opponent'],
    answer:
      'Matchmaking tries to pair players with compatible skill and connection conditions, then broadens tolerance if queue time increases.',
    steps: [
      'Enter your game lobby and join queue.',
      'Wait for an opponent match; avoid repeatedly leaving queue.',
      'If queues are long, retry during busier hours or verify connection stability.'
    ],
    notes: [
      'Connection quality can impact pairing quality.',
      'Queue times vary by game mode and regional activity.'
    ]
  },
  {
    id: 'roadmap-achievements',
    title: 'Roadmap and achievements',
    slug: 'roadmap-achievements',
    sectionId: 'project-progress',
    url: '/help/roadmap-achievements',
    tags: ['roadmap', 'achievements', 'project updates', 'progress', 'future'],
    answer:
      'Roadmap and development progress are shown in project/achievement sections, which summarize completed milestones and upcoming priorities.',
    steps: [
      'Open Home and review the Project Achievements section.',
      'Track completed milestones and announced next steps.',
      'Check updates regularly for newly shipped features.'
    ],
    notes: [
      'Roadmap priorities can change as platform needs evolve.',
      'Published updates are the reliable source for user-visible status.'
    ]
  },
  {
    id: 'coins-points',
    title: 'Coins and points',
    slug: 'coins-points-public',
    sectionId: 'difference',
    url: '/help/coins-points-explained',
    tags: ['coins', 'points', 'difference', 'balance', 'rewards'],
    answer:
      'Coins are used for platform transactions and selected actions, while points generally track progression and ranking-related milestones.',
    steps: [
      'Check wallet/store contexts for coin-related actions.',
      'Check game/profile progression areas for points and rank indicators.',
      'If unsure about one action, ask support with a screenshot of the exact screen.'
    ],
    notes: [
      'Coins and points are not always interchangeable.',
      'Some actions are mode-specific.'
    ]
  },
  {
    id: 'reporting-player',
    title: 'Reporting players',
    slug: 'report-player-help',
    sectionId: 'report-flow',
    url: '/help/report-player',
    tags: ['report', 'player report', 'abuse', 'toxic', 'fair play'],
    answer:
      'You can report users from profile or match-related screens using the in-app report flow.',
    steps: [
      'Open player profile or relevant history context.',
      'Tap Report and choose the correct reason category.',
      'Submit and wait for policy-based review processing.'
    ],
    notes: [
      'Provide accurate reason details to improve review quality.',
      'Moderation decisions are handled under public policy rules.'
    ]
  },
  {
    id: 'connectivity-mobile',
    title: 'Connection troubleshooting',
    slug: 'mobile-connection-help',
    sectionId: 'troubleshooting',
    url: '/help/mobile-connection-help',
    tags: ['lag', 'disconnect', 'connection', 'mobile', 'ios', 'android', 'performance'],
    answer:
      'For lag or disconnect issues, start with network switching, app restart, and version checks before escalation.',
    steps: [
      'Switch between Wi-Fi and mobile data.',
      'Restart the app and close background-heavy apps.',
      'Update to the latest app version and retry.'
    ],
    notes: [
      'VPN/proxy settings can cause unstable session quality.',
      'Include device model and app version when contacting support.'
    ]
  },
  {
    id: 'pool-rules',
    title: 'Pool and snooker rules help',
    slug: 'cue-sports-rules',
    sectionId: '8ball-9ball-snooker',
    url: '/help/cue-sports-rules',
    tags: ['8-ball', '9-ball', 'snooker', 'foul', 'rules', 'scoring', 'break'],
    answer:
      '8-ball, 9-ball, and snooker each use different legal-shot and foul systems, so always follow the specific game-mode rules.',
    steps: [
      'Confirm your active mode (8-ball, 9-ball, or snooker).',
      'Review objective and legal-shot rules for that mode.',
      'Track fouls carefully, since penalties differ between modes.'
    ],
    notes: [
      'In 9-ball, lowest-number first contact is required.',
      'In snooker, foul points are awarded to the opponent under public scoring rules.'
    ]
  },
  {
    id: 'games-lobbies',
    title: 'Games and lobby access',
    slug: 'games-lobby-access',
    sectionId: 'supported-games',
    url: '/games',
    tags: ['games', 'lobby', 'texas holdem', 'domino', 'air hockey', 'goal rush', 'snake', 'murlan', 'chess', 'ludo'],
    answer:
      'Each game has a dedicated lobby flow where you prepare and then enter the match for that mode.',
    steps: [
      'Go to Games and choose your game mode.',
      'Open the game lobby and select match options.',
      'Start match and wait for session setup.'
    ],
    notes: [
      'Rules and progression can differ per game mode.',
      'If a lobby does not load, retry after refreshing connection.'
    ]
  },
  {
    id: 'achievements-tasks',
    title: 'Tasks and achievements usage',
    slug: 'tasks-achievements',
    sectionId: 'rewards-flow',
    url: '/tasks',
    tags: ['tasks', 'achievements', 'missions', 'rewards', 'progress'],
    answer:
      'Tasks and achievement systems help you track progress and claim eligible rewards after completing conditions.',
    steps: [
      'Open Tasks and review active objectives.',
      'Complete objective conditions in-game or platform actions.',
      'Return to claim rewards once marked as complete.'
    ],
    notes: [
      'Some tasks are time-limited.',
      'Reward claim state can require a refresh after completion.'
    ]
  },
  {
    id: 'voice-help-conversation',
    title: 'Voice help and interruption behavior',
    slug: 'voice-help-live-conversation',
    sectionId: 'barge-in',
    url: '/help/voice-help',
    tags: ['voice help', 'microphone', 'interrupt', 'barge in', 'conversation', 'ai help'],
    answer:
      'TonPlaygram voice help supports natural back-and-forth: you can start speaking while guidance is playing and ask follow-up questions immediately.',
    steps: [
      'Open Help and tap Open Mic.',
      'Ask your question in a full sentence, then continue with follow-up questions naturally.',
      'If the reply is too long, interrupt and ask for a shorter or step-by-step answer.'
    ],
    notes: [
      'Use a quiet environment for more accurate speech recognition.',
      'If your browser blocks mic access, allow microphone permissions and retry.'
    ]
  },
  {
    id: 'wallet-security-basics',
    title: 'Wallet security basics',
    slug: 'wallet-security-basics',
    sectionId: 'safe-actions',
    url: '/help/wallet-security',
    tags: ['wallet security', 'private key', 'seed phrase', 'safe wallet', 'scam'],
    answer:
      'Keep wallet operations safe by verifying recipients, checking prompts carefully, and never sharing private recovery credentials.',
    steps: [
      'Double-check destination wallet addresses before sending.',
      'Review transaction amount and network details before confirming.',
      'Reject any request for your private key, seed phrase, or one-time code.'
    ],
    notes: [
      'TonPlaygram support will never ask for private keys.',
      'When unsure, pause and contact official support channels first.'
    ]
  },
  {
    id: 'matchmaking-quality',
    title: 'Improve matchmaking quality',
    slug: 'matchmaking-quality-help',
    sectionId: 'connection-fairness',
    url: '/help/matchmaking-quality',
    tags: ['ping', 'matchmaking quality', 'fair match', 'queue quality', 'region'],
    answer:
      'Better network stability and consistent queue behavior improve match quality and reduce unfair disconnect scenarios.',
    steps: [
      'Use the most stable connection available before joining queue.',
      'Avoid repeatedly entering and leaving queue in short intervals.',
      'Retry in peak hours if your selected mode has low player activity.'
    ],
    notes: [
      'Large ping spikes can reduce game quality even when matchmaking succeeds.',
      'Different modes can have different average queue times.'
    ]
  },
  {
    id: 'store-missing-item',
    title: 'Purchased item not visible',
    slug: 'store-missing-item',
    sectionId: 'inventory-sync',
    url: '/help/store-missing-item',
    tags: ['missing item', 'inventory', 'purchase issue', 'store problem'],
    answer:
      'If a purchased item is missing, verify that the item belongs to the game you are checking and refresh inventory state.',
    steps: [
      'Open the game inventory that matches the purchased item category.',
      'Refresh the page/app and check inventory again.',
      'If still missing, collect transaction details and contact support.'
    ],
    notes: [
      'Cross-game items may not appear in other game inventories.',
      'Delayed confirmations can temporarily delay visual sync.'
    ]
  },
  {
    id: 'game-performance-mobile',
    title: 'Mobile game performance tuning',
    slug: 'mobile-performance-help',
    sectionId: 'fps-stability',
    url: '/help/mobile-performance',
    tags: ['fps', 'stutter', 'mobile performance', 'lag spikes', 'heating'],
    answer:
      'For smoother gameplay, reduce background load, stabilize network quality, and keep your app/device updated.',
    steps: [
      'Close background-heavy apps and restart TonPlaygram.',
      'Disable battery saver for gaming sessions when possible.',
      'Update the app and OS, then retry the same mode.'
    ],
    notes: [
      'Thermal throttling can reduce FPS during long sessions.',
      'Different games may have different device requirements.'
    ]
  },
  {
    id: 'support-fallback',
    title: 'Support escalation',
    slug: 'support-escalation',
    sectionId: 'contact-support',
    url: '/help/support',
    tags: ['support', 'contact', 'unknown', 'not working', 'problem'],
    answer:
      'If public guidance does not resolve your issue, contact support with a short reproducible description and screenshots.',
    steps: [
      'Describe what you expected versus what happened.',
      'Include game mode/page name, device type, and app version.',
      'Attach screenshots and transaction references when relevant.'
    ],
    notes: [
      'Do not share private keys or recovery phrases with anyone.',
      'Support can only process requests with enough clear details.'
    ]
  }
]
