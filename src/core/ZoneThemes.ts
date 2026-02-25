/**
 * Zone Themes: distinct visual palettes applied per-map.
 *
 * Each theme controls background color, grid color/alpha, wall color, and an
 * accent color used for UI tints and particle effects.
 */

export interface ZoneTheme {
  name: string;
  backgroundColor: number;
  gridColor: number;
  gridAlpha: number;
  wallColor: number;
  accentColor: number;
  /** Optional color-shift multiplier for enemy tinting. */
  enemyTintMultiplier?: number;
}

// ── Theme Definitions ─────────────────────────────────────────────

export const ZONE_THEMES: Record<string, ZoneTheme> = {
  the_grid: {
    name: 'The Grid',
    backgroundColor: 0x1a1a2e,
    gridColor: 0x00ffff,
    gridAlpha: 0.06,
    wallColor: 0x0d0d1a,
    accentColor: 0x00ffff,
  },
  neon_wastes: {
    name: 'Neon Wastes',
    backgroundColor: 0x1a0a2e,
    gridColor: 0xff00ff,
    gridAlpha: 0.06,
    wallColor: 0x150a20,
    accentColor: 0xff00ff,
  },
  reactor_core: {
    name: 'Reactor Core',
    backgroundColor: 0x2e1a0a,
    gridColor: 0xff6600,
    gridAlpha: 0.06,
    wallColor: 0x201005,
    accentColor: 0xff6600,
  },
  frozen_array: {
    name: 'Frozen Array',
    backgroundColor: 0x0a1a2e,
    gridColor: 0x88ccff,
    gridAlpha: 0.06,
    wallColor: 0x051020,
    accentColor: 0x88ccff,
  },
  town: {
    name: 'Town',
    backgroundColor: 0x1a2e2e,
    gridColor: 0x44aaaa,
    gridAlpha: 0.08,
    wallColor: 0x0d1a1a,
    accentColor: 0x44aaaa,
  },
  overgrowth: {
    name: 'Overgrowth',
    backgroundColor: 0x0a1f0a,
    gridColor: 0x44dd88,
    gridAlpha: 0.06,
    wallColor: 0x2d6b2d,
    accentColor: 0x44dd88,
  },
  storm_network: {
    name: 'Storm Network',
    backgroundColor: 0x1a1a0a,
    gridColor: 0xffdd44,
    gridAlpha: 0.06,
    wallColor: 0x5a5a2a,
    accentColor: 0xffdd44,
  },
  the_abyss: {
    name: 'The Abyss',
    backgroundColor: 0x050508,
    gridColor: 0x4444aa,
    gridAlpha: 0.04,
    wallColor: 0x101018,
    accentColor: 0x4444aa,
    enemyTintMultiplier: 0.3,
  },
  chromatic_rift: {
    name: 'Chromatic Rift',
    backgroundColor: 0x1a0a1a,
    gridColor: 0xff44ff,
    gridAlpha: 0.06,
    wallColor: 0x3a2a3a,
    accentColor: 0xff44ff,
  },
  rust_hollow: {
    name: 'Rust Hollow',
    backgroundColor: 0x1a1210,
    gridColor: 0xcc8844,
    gridAlpha: 0.05,
    wallColor: 0x3a2a1a,
    accentColor: 0xcc8844,
  },
  signal_spire: {
    name: 'Signal Spire',
    backgroundColor: 0x0a0a20,
    gridColor: 0x6688ff,
    gridAlpha: 0.07,
    wallColor: 0x1a1a40,
    accentColor: 0x6688ff,
  },
  memory_leak: {
    name: 'Memory Leak',
    backgroundColor: 0x0f0a1a,
    gridColor: 0xaa44ff,
    gridAlpha: 0.05,
    wallColor: 0x201830,
    accentColor: 0xaa44ff,
  },
  null_sector: {
    name: 'Null Sector',
    backgroundColor: 0x020202,
    gridColor: 0x333333,
    gridAlpha: 0.03,
    wallColor: 0x0a0a0a,
    accentColor: 0xffffff,
    enemyTintMultiplier: 0.8,
  },
};

/** All theme keys for random selection. */
export const ZONE_THEME_KEYS = Object.keys(ZONE_THEMES);

/** Returns a random theme key. */
export function randomThemeKey(): string {
  return ZONE_THEME_KEYS[Math.floor(Math.random() * ZONE_THEME_KEYS.length)];
}

// ── Active Theme State ────────────────────────────────────────────

let currentTheme: ZoneTheme = ZONE_THEMES.the_grid;

/** Returns the currently active zone theme. */
export function getActiveTheme(): ZoneTheme {
  return currentTheme;
}

/** Returns the active theme key (e.g. 'neon_wastes'). */
export function getActiveThemeKey(): string {
  for (const [key, theme] of Object.entries(ZONE_THEMES)) {
    if (theme === currentTheme) return key;
  }
  return 'the_grid';
}

/**
 * Apply a zone theme: updates background color, redraws the grid and walls.
 * This is called by MapDevice when activating a map, and by Game on init.
 */
export function applyTheme(themeKey: string): void {
  const theme = ZONE_THEMES[themeKey];
  if (!theme) {
    console.warn(`Unknown zone theme: ${themeKey}, falling back to the_grid`);
    currentTheme = ZONE_THEMES.the_grid;
  } else {
    currentTheme = theme;
  }

  // Defer the actual rendering work to the caller (MapDevice / Game)
  // so we don't create circular imports. The caller should:
  //   1. Set renderer.background.color
  //   2. Clear worldLayer children
  //   3. Redraw grid with getActiveTheme() colors
  //   4. Re-render the tile map
}
