import { TABLE_CLOTH_OPTIONS } from '../utils/tableCustomizationOptions.js';

export const MURLAN_TABLE_CLOTHS = Object.freeze(TABLE_CLOTH_OPTIONS);

export const MURLAN_TABLE_CLOTH_THUMBNAILS = Object.freeze(
  MURLAN_TABLE_CLOTHS.reduce((acc, cloth) => {
    acc[cloth.id] = cloth.thumbnail;
    return acc;
  }, {})
);
