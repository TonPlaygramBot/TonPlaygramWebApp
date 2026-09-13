import { groundHeight } from '../tirana-east/terrainCore.mjs';

export const surfaceHeight = (track, x, z) => track.terrainMode === 'regional' ? groundHeight(x, z) : 0;
export const surfaceColor = track => track.surface === 'gravel' ? '#9a8260' : track.surface === 'dirt' ? '#95704c' : '#69737a';
export const surfaceGrip = track => track.surface === 'gravel' ? .88 : track.surface === 'dirt' ? .84 : 1;
