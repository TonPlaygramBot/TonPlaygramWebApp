import { STORE_GAMES, STORE_ITEMS } from '../../components/store/storeCatalog.ts';
import { MALL_GAMES } from './mallCatalog.mjs';

// Catalogue adapter: retain the store's existing prices/entitlements/checkout.
// The mall is a directory and never creates a second product list or purchase API.
export const MALL_SHOPS = Object.freeze([
  Object.freeze({ id: 'all', name: 'TonPlayGram Department Store', route: '/store/all',
    description: 'The full store: equipment, characters, outfits, environments, tables, pieces and home themes.',
    count: STORE_ITEMS.length }),
  ...STORE_GAMES.map(game => Object.freeze({
    id: game.slug, name: `${game.shortName} Shop`, route: `/store/${game.slug}`,
    description: `Browse all ${game.name} equipment and customization items in the existing store.`,
    count: STORE_ITEMS.filter(item => item.slug === game.slug).length,
    image: MALL_GAMES.find(item => item.slug === game.slug)?.image
  }))
]);
