import { Graphics, Text, TextStyle } from 'pixi.js';
import { Rarity } from '../loot/ItemTypes';

// ── Color Palette ─────────────────────────────────────────────────────

export const Colors = {
  panelBg: 0x16213E,
  slotBg: 0x0D0D1A,
  borderHighlight: 0xBCBCBC,
  borderShadow: 0x0F0F0F,
  borderMid: 0x3C3C3C,
  divider: 0x3C3C3C,
  textPrimary: 0xFCFCFC,
  textSecondary: 0xBCBCBC,
  textMuted: 0x7C7C7C,
  accentCyan: 0x00D4FF,
  accentGold: 0xFCBF00,
  accentLime: 0x7CFC00,
  accentRed: 0xE4002B,
  accentOrange: 0xFF7700,
} as const;

// ── Rarity Colors ─────────────────────────────────────────────────────

export const RARITY_COLORS: Record<Rarity, number> = {
  [Rarity.Normal]: 0xBCBCBC,
  [Rarity.Magic]: 0x4488FF,
  [Rarity.Rare]: 0xFCBF00,
  [Rarity.Unique]: 0xFF7700,
};

export const RARITY_NAMES: Record<Rarity, string> = {
  [Rarity.Normal]: 'Normal',
  [Rarity.Magic]: 'Magic',
  [Rarity.Rare]: 'Rare',
  [Rarity.Unique]: 'Unique',
};

export function getRarityColor(rarity: Rarity): number {
  return RARITY_COLORS[rarity] ?? 0xBCBCBC;
}

// ── Fonts ─────────────────────────────────────────────────────────────

export const Fonts = {
  display: "'Press Start 2P', monospace",
  body: "'VT323', monospace",
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
} as const;

// ── Drawing Helpers ───────────────────────────────────────────────────

export interface PixelBorderOpts {
  borderWidth?: number;
  highlight?: number;
  shadow?: number;
  fill?: number;
  fillAlpha?: number;
}

/**
 * Draw a 3D pixel border (highlight top/left, shadow bottom/right).
 */
export function drawPixelBorder(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: PixelBorderOpts,
): void {
  const bw = opts?.borderWidth ?? 4;
  const hi = opts?.highlight ?? Colors.borderHighlight;
  const sh = opts?.shadow ?? Colors.borderShadow;

  // Highlight (top + left)
  g.rect(x, y, w, bw).fill({ color: hi });           // top
  g.rect(x, y, bw, h).fill({ color: hi });            // left
  // Shadow (bottom + right)
  g.rect(x, y + h - bw, w, bw).fill({ color: sh });   // bottom
  g.rect(x + w - bw, y, bw, h).fill({ color: sh });   // right
}

/**
 * Draw a themed panel background (navy fill + 3D border).
 */
export function drawPanelBg(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: PixelBorderOpts,
): void {
  const fill = opts?.fill ?? Colors.panelBg;
  const alpha = opts?.fillAlpha ?? 0.95;
  g.rect(x, y, w, h).fill({ color: fill, alpha });
  drawPixelBorder(g, x, y, w, h, opts);
}

/**
 * Draw a slot background with optional rarity border.
 */
export function drawSlotBg(
  g: Graphics,
  x: number,
  y: number,
  size: number,
  rarityColor?: number,
): void {
  g.rect(x, y, size, size).fill({ color: Colors.slotBg, alpha: 0.85 });
  if (rarityColor) {
    drawPixelBorder(g, x, y, size, size, { borderWidth: 2, highlight: rarityColor, shadow: rarityColor });
  } else {
    g.rect(x, y, size, size).stroke({ width: 2, color: Colors.borderMid });
  }
}

/**
 * Draw a dashed horizontal divider line.
 */
export function drawDivider(g: Graphics, x: number, y: number, width: number): void {
  const dashLen = 6;
  const gapLen = 4;
  let cx = x;
  while (cx < x + width) {
    const end = Math.min(cx + dashLen, x + width);
    g.moveTo(cx, y).lineTo(end, y).stroke({ width: 2, color: Colors.divider });
    cx = end + gapLen;
  }
}

// ── Text Helpers ──────────────────────────────────────────────────────

export interface MakeTextOpts {
  fill?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  align?: 'left' | 'center' | 'right';
  wordWrap?: boolean;
  wordWrapWidth?: number;
  lineHeight?: number;
  stroke?: { color: number; width: number };
}

/**
 * Factory for themed Text objects. Defaults to VT323 body font.
 */
export function makeText(text: string, opts?: MakeTextOpts): Text {
  return new Text({
    text,
    style: new TextStyle({
      fill: opts?.fill ?? Colors.textPrimary,
      fontSize: opts?.fontSize ?? FontSize.base,
      fontFamily: opts?.fontFamily ?? Fonts.body,
      fontWeight: opts?.fontWeight as any,
      align: opts?.align,
      wordWrap: opts?.wordWrap,
      wordWrapWidth: opts?.wordWrapWidth,
      lineHeight: opts?.lineHeight,
      stroke: opts?.stroke,
    }),
  });
}

/**
 * Standard [X] close button.
 */
export function makeCloseButton(
  x: number,
  y: number,
  onClose: () => void,
): Text {
  const btn = new Text({
    text: '[X]',
    style: new TextStyle({
      fill: Colors.textMuted,
      fontSize: FontSize.sm,
      fontFamily: Fonts.display,
    }),
  });
  btn.position.set(x, y);
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointerover', () => { btn.style.fill = Colors.accentRed; });
  btn.on('pointerout', () => { btn.style.fill = Colors.textMuted; });
  btn.on('pointertap', onClose);
  return btn;
}

// ── Utility ───────────────────────────────────────────────────────────

/**
 * Abbreviate a name to maxLen chars with trailing dot.
 */
export function abbreviate(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '.';
}
