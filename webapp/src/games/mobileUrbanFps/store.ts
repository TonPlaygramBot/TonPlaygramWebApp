import { create } from 'zustand';
import { FIRST_PERSON_WEAPON, FPS_WEAPON_OPTIONS } from './assetCatalog';
import type {
  BulletTracer,
  GamePhase,
  ImpactFx,
  TouchInputState,
  VehicleMode,
  WeaponStats
} from './types';

export const rifleStats: WeaponStats = {
  magazineSize: 24,
  reserveAmmo: 96,
  fireRateMs: 145,
  reloadMs: 1450,
  damage: 34,
  spread: 0.013,
  recoilKick: 0.035,
  recoilRecovery: 8,
  falloffStart: 12,
  falloffEnd: 42
};

type GameStore = {
  phase: GamePhase;
  health: number;
  maxHealth: number;
  ammo: number;
  reserveAmmo: number;
  reloading: boolean;
  aimSensitivity: number;
  enemiesAlive: number;
  hitMarkerUntil: number;
  muzzleFlashUntil: number;
  recoil: number;
  input: TouchInputState;
  tracers: BulletTracer[];
  impacts: ImpactFx[];
  selectedWeaponId: string;
  vehicleMode: VehicleMode;
  canBoardHelicopter: boolean;
  setVehicleMode: (mode: VehicleMode) => void;
  setCanBoardHelicopter: (canBoard: boolean) => void;
  selectWeapon: (id: string) => void;
  cycleWeapon: (direction: 1 | -1) => void;
  setInput: (patch: Partial<TouchInputState>) => void;
  setAimSensitivity: (value: number) => void;
  damagePlayer: (amount: number) => void;
  setEnemiesAlive: (count: number) => void;
  spendRound: () => void;
  finishReload: () => void;
  beginReload: () => void;
  addRecoil: (amount: number) => void;
  recoverRecoil: (amount: number) => void;
  showHitMarker: () => void;
  showMuzzleFlash: () => void;
  addTracer: (tracer: BulletTracer) => void;
  addImpact: (impact: ImpactFx) => void;
  tickFx: (dt: number) => void;
  reset: () => void;
};

const initialInput: TouchInputState = {
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  firing: false,
  reloading: false,
  ascend: false,
  descend: false
};

export const useMobileFpsStore = create<GameStore>((set, get) => ({
  phase: 'playing',
  health: 100,
  maxHealth: 100,
  ammo: rifleStats.magazineSize,
  reserveAmmo: rifleStats.reserveAmmo,
  reloading: false,
  aimSensitivity: 1.55,
  enemiesAlive: 6,
  hitMarkerUntil: 0,
  muzzleFlashUntil: 0,
  recoil: 0,
  input: initialInput,
  tracers: [],
  impacts: [],
  selectedWeaponId: FIRST_PERSON_WEAPON.id,
  vehicleMode: 'onFoot',
  canBoardHelicopter: false,
  setVehicleMode: (mode) => set({ vehicleMode: mode }),
  setCanBoardHelicopter: (canBoard) =>
    set((state) =>
      state.canBoardHelicopter === canBoard
        ? state
        : { canBoardHelicopter: canBoard }
    ),
  selectWeapon: (id) => {
    if (FPS_WEAPON_OPTIONS.some((entry) => entry.id === id))
      set({ selectedWeaponId: id });
  },
  cycleWeapon: (direction) =>
    set((state) => {
      const currentIndex = FPS_WEAPON_OPTIONS.findIndex(
        (entry) => entry.id === state.selectedWeaponId
      );
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        (safeIndex + direction + FPS_WEAPON_OPTIONS.length) %
        FPS_WEAPON_OPTIONS.length;
      return { selectedWeaponId: FPS_WEAPON_OPTIONS[nextIndex].id };
    }),
  setInput: (patch) =>
    set((state) => ({ input: { ...state.input, ...patch } })),
  setAimSensitivity: (value) =>
    set({ aimSensitivity: Math.min(2.6, Math.max(0.7, value)) }),
  damagePlayer: (amount) =>
    set((state) => {
      const health = Math.max(0, state.health - amount);
      return { health, phase: health <= 0 ? 'lost' : state.phase };
    }),
  setEnemiesAlive: (count) =>
    set((state) => ({
      enemiesAlive: count,
      phase: count <= 0 ? 'won' : state.phase
    })),
  spendRound: () => set((state) => ({ ammo: Math.max(0, state.ammo - 1) })),
  beginReload: () => {
    const state = get();
    if (
      !state.reloading &&
      state.ammo < rifleStats.magazineSize &&
      state.reserveAmmo > 0
    ) {
      set({ reloading: true });
    }
  },
  finishReload: () =>
    set((state) => {
      const needed = rifleStats.magazineSize - state.ammo;
      const loaded = Math.min(needed, state.reserveAmmo);
      return {
        ammo: state.ammo + loaded,
        reserveAmmo: state.reserveAmmo - loaded,
        reloading: false
      };
    }),
  addRecoil: (amount) =>
    set((state) => ({ recoil: Math.min(0.18, state.recoil + amount) })),
  recoverRecoil: (amount) =>
    set((state) => ({ recoil: Math.max(0, state.recoil - amount) })),
  showHitMarker: () => set({ hitMarkerUntil: performance.now() + 120 }),
  showMuzzleFlash: () => set({ muzzleFlashUntil: performance.now() + 70 }),
  addTracer: (tracer) =>
    set((state) => ({ tracers: [...state.tracers.slice(-5), tracer] })),
  addImpact: (impact) =>
    set((state) => ({ impacts: [...state.impacts.slice(-10), impact] })),
  tickFx: (dt) =>
    set((state) => ({
      tracers: state.tracers
        .map((fx) => ({ ...fx, life: fx.life - dt }))
        .filter((fx) => fx.life > 0),
      impacts: state.impacts
        .map((fx) => ({ ...fx, life: fx.life - dt }))
        .filter((fx) => fx.life > 0)
    })),
  reset: () =>
    set({
      phase: 'playing',
      health: 100,
      ammo: rifleStats.magazineSize,
      reserveAmmo: rifleStats.reserveAmmo,
      reloading: false,
      aimSensitivity: 1.55,
      enemiesAlive: 6,
      hitMarkerUntil: 0,
      muzzleFlashUntil: 0,
      recoil: 0,
      selectedWeaponId: FIRST_PERSON_WEAPON.id,
      vehicleMode: 'onFoot',
      canBoardHelicopter: false,
      input: initialInput,
      tracers: [],
      impacts: []
    })
}));
