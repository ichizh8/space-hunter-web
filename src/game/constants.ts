// World
export const WORLD_W = 4800;
export const WORLD_H = 4800;
export const GRID_STEP = 300;

// Player
export const PLAYER_BASE_SPEED = 200;
export const PLAYER_BASE_HP = 10;
export const PLAYER_RADIUS = 18;
export const PLAYER_COLOR = 0x00ccff;
export const PLAYER_GLOW = 0x0066aa;
export const ESSENCE_COLLECT_RADIUS = 80;

// Joystick
export const JOY_MAX_DIST = 60;
export const JOY_DEADZONE = 8;

// Corruption thresholds
export const CORR_CLEAN = 15;
export const CORR_VALLEY = 35;
export const CORR_CORRUPT = 60;

// XP -- fast curve (~486 total kills to cap; early levels every 10-15s, max reachable in 6-7min)
export const MAX_LEVEL = 12;
export const XP_PER_LEVEL = [0, 3, 5, 9, 14, 20, 30, 44, 60, 78, 98, 125, 125];

// Post-cap stat drip: every 100 kills after cap grants one buff
export const POST_CAP_XP = 100;

// Combat
export const ENEMY_MELEE_RANGE = 30;
export const ENEMY_LEASH_DEFAULT = 600;
export const BULLET_MAX_COUNT = 200;

// Waves
export const ELITE_BASE_INTERVAL = 120; // seconds

// Map features
export const RIVER_COUNT = 3;
export const CAVE_COUNT = 4;
export const VOID_POOL_COUNT = 5;
export const OBSTACLE_COUNT = 40;

// HUD
export const HP_BAR_W = 120;
export const HP_BAR_H = 12;
export const CORRUPTION_BAR_W = 80;
export const CORRUPTION_BAR_H = 10;

// Colors
export const COL_BG = 0x0a0a14;
export const COL_GRID = 0x111122;
export const COL_RIVER = 0x1a2a4a;
export const COL_CAVE = 0x0d0d1a;
export const COL_VOID_POOL = 0x2a0a3a;
export const COL_OBSTACLE = 0x222233;
export const COL_HP_BG = 0x4d1919;
export const COL_HP_FILL = 0x33e633;
export const COL_XP_FILL = 0x8000e6;
export const COL_AMMO_READY = 0xe6cc33;
export const COL_AMMO_RELOAD = 0xe66633;
