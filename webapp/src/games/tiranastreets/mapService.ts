import { API_BASE_URL } from '../../utils/api.js';
import type { CityMapService } from './mapTypes';

export const mapService: CityMapService = {
  configUrl: API_BASE_URL + '/api/tirana-3d/config',
  headers: (): Record<string, string> => {
    const telegram = (
      window as Window & { Telegram?: { WebApp?: { initData?: string } } }
    ).Telegram?.WebApp?.initData;
    return telegram ? { 'X-Telegram-Init-Data': telegram } : {};
  }
};
