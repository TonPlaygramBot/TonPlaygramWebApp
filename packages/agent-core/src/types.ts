export type SupportIntent =
  | 'account_login'
  | 'profile'
  | 'lobby_matchmaking'
  | 'gameplay_rules'
  | 'fair_play'
  | 'store_items'
  | 'payments_coins_points'
  | 'refunds'
  | 'tournaments'
  | 'connectivity_performance'
  | 'reporting_moderation'
  | 'how_to_guides'
  | 'bugs_feedback'
  | 'unknown';

export interface ExtractedEntities {
  game?: string;
  feature?: string;
  platform?: string;
  version?: string;
}

export interface NluResult {
  normalizedText: string;
  language: 'en' | 'sq' | 'mixed' | 'unknown';
  intent: SupportIntent;
  entities: ExtractedEntities;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export interface PublicArticle {
  id: string;
  title: string;
  slug: string;
  sectionId: string;
  content: string;
  url: string;
  locale: string;
  version: string;
  contentHash: string;
  sourcePath: string;
}

export interface RetrievalResult {
  article: PublicArticle;
  score: number;
}

export interface Citation {
  title: string;
  slug: string;
  sectionId: string;
  url: string;
}
