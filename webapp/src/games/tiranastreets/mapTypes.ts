export type CityMapStatus = {
  phase: 'local' | 'loading' | 'ready' | 'unavailable';
  available: boolean;
  message: string;
  credits: string[];
};
export type CityMapService = {
  configUrl: string;
  headers?: () => Record<string, string>;
};
export const LOCAL_MAP_STATUS: CityMapStatus = {
  phase: 'local',
  available: false,
  message: 'Tirana · Built city',
  credits: []
};
