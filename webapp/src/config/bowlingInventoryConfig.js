const makeHdri = (id, label, previewId = id, price = 1800) => ({
  id: `bowling-hdri-${id}`,
  type: 'environmentHdri',
  optionId: id,
  name: label,
  description: 'Poly Haven HDRI for realistic bowling lane reflections and lighting.',
  price,
  currency: 'TPC',
  rarity: 'rare',
  thumbnail: `https://cdn.polyhaven.com/asset_img/thumbs/${previewId}.png?width=780&height=780`
});

export const BOWLING_HDRI_VARIANTS = [
  { id: 'studio_small_09', label: 'Studio Small 09', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_09.png?width=780&height=780' },
  { id: 'aerodynamics_workshop', label: 'Aerodynamics Workshop', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/aerodynamics_workshop.png?width=780&height=780' },
  { id: 'autoshop_01', label: 'Autoshop 01', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autoshop_01_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/autoshop_01.png?width=780&height=780' },
  { id: 'carpentry_shop_02', label: 'Carpentry Shop 02', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/carpentry_shop_02_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/carpentry_shop_02.png?width=780&height=780' },
  { id: 'lebombo', label: 'Lebombo', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/lebombo_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/lebombo.png?width=780&height=780' },
  { id: 'peppermint_powerplant', label: 'Peppermint Powerplant', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/peppermint_powerplant_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/peppermint_powerplant.png?width=780&height=780' },
  { id: 'photo_studio_01', label: 'Photo Studio 01', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/photo_studio_01_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/photo_studio_01.png?width=780&height=780' },
  { id: 'studio_small_08', label: 'Studio Small 08', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_08.png?width=780&height=780' },
  { id: 'the_sky_is_on_fire', label: 'The Sky is on Fire', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/the_sky_is_on_fire_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/the_sky_is_on_fire.png?width=780&height=780' },
  { id: 'ulmer_muenster', label: 'Ulmer Muenster', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/ulmer_muenster_1k.hdr', thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/ulmer_muenster.png?width=780&height=780' }
];

export const BOWLING_DEFAULT_LOADOUT = ['studio_small_09'];
export const BOWLING_STORE_ITEMS = BOWLING_HDRI_VARIANTS.map((item, index) => makeHdri(item.id, item.label, item.id, index === 0 ? 0 : 1800 + index * 150));
export const BOWLING_OPTION_LABELS = { environmentHdri: Object.fromEntries(BOWLING_HDRI_VARIANTS.map((h) => [h.id, h.label])) };
