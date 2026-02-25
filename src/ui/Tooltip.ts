import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { BaseItem, Rarity, Slot } from '../loot/ItemTypes';
import type { MapItem } from '../loot/MapItem';
import { inventory } from '../core/Inventory';
import { Colors, Fonts, FontSize, getRarityColor, RARITY_NAMES, drawPixelBorder } from './UITheme';
import { SCREEN_W, SCREEN_H } from '../core/constants';

const SLOT_NAME_MAP: Record<Slot, string> = {
  [Slot.Weapon]: 'Weapon',
  [Slot.Helmet]: 'Helmet',
  [Slot.Chest]: 'Chest',
  [Slot.Boots]: 'Boots',
  [Slot.Ring]: 'Ring',
  [Slot.Amulet]: 'Amulet',
  [Slot.Offhand]: 'Offhand',
};

let tooltip: Container | null = null;
let compareTooltip: Container | null = null;

/**
 * Build multi-line tooltip text for an item.
 */
export function buildItemTooltipText(item: BaseItem, extra?: string): string {
  const rarityName = RARITY_NAMES[item.rarity];
  const slotName = SLOT_NAME_MAP[item.slot];
  const lines: string[] = [];

  lines.push(`[${rarityName}] ${item.name}`);
  lines.push(`Level ${item.level} ${slotName}`);
  lines.push('\u2500'.repeat(22));

  if (item.baseStats.damage) lines.push(`Damage: ${item.baseStats.damage}`);
  if (item.baseStats.armor) lines.push(`Armor: ${item.baseStats.armor}`);
  if (item.baseStats.attackSpeed) lines.push(`Attack Speed: ${item.baseStats.attackSpeed}`);

  if (item.affixes.length > 0) {
    lines.push('\u2500'.repeat(22));
    for (const affix of item.affixes) {
      const sign = affix.value >= 0 ? '+' : '';
      const isPercent =
        affix.stat.includes('%') ||
        affix.stat.includes('percent') ||
        affix.stat.includes('critical') ||
        affix.stat.includes('speed') ||
        affix.stat.includes('movement');
      lines.push(`${sign}${affix.value}${isPercent ? '%' : ''} ${affix.stat}`);
    }
  }

  if (item.uniqueEffect) {
    lines.push('\u2500'.repeat(22));
    lines.push(item.uniqueEffect);
  }

  if (extra) {
    lines.push('\u2500'.repeat(22));
    lines.push(extra);
  }

  return lines.join('\n');
}

/**
 * Build multi-line tooltip text for a map item.
 */
export function buildMapTooltipText(mapItem: MapItem, price: number): string {
  const lines: string[] = [];
  lines.push(`[Map] Tier ${mapItem.tier}`);
  lines.push('\u2500'.repeat(22));
  lines.push(`Quantity: +${mapItem.quantityBonus}%`);
  lines.push(`Rarity: +${mapItem.rarityBonus}%`);
  if (mapItem.modifiers.length > 0) {
    lines.push('\u2500'.repeat(22));
    for (const mod of mapItem.modifiers) {
      lines.push(`${mod.name}: ${mod.description}`);
    }
  }
  lines.push('\u2500'.repeat(22));
  lines.push(`Buy: ${price}g`);
  return lines.join('\n');
}

// ── Tooltip rendering helpers ────────────────────────────────────────

const TOOLTIP_PADDING = 14;
const TOOLTIP_GAP = 4;

function createTooltipContainer(content: string, color: number): Container {
  const container = new Container();

  const text = new Text({
    text: content,
    style: new TextStyle({
      fill: Colors.textPrimary,
      fontSize: FontSize.base,
      fontFamily: Fonts.body,
      lineHeight: 28,
      wordWrap: true,
      wordWrapWidth: 380,
    }),
  });

  const w = text.width + TOOLTIP_PADDING * 2;
  const h = text.height + TOOLTIP_PADDING * 2;

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill({ color: Colors.slotBg, alpha: 0.95 });
  drawPixelBorder(bg, 0, 0, w, h, { borderWidth: 2, highlight: color, shadow: color });
  container.addChild(bg);

  text.position.set(TOOLTIP_PADDING, TOOLTIP_PADDING);
  container.addChild(text);

  return container;
}

/**
 * Show a themed tooltip at the given screen position.
 */
export function showTooltip(
  content: string,
  color: number,
  globalX: number,
  globalY: number,
): void {
  hideTooltip();

  tooltip = createTooltipContainer(content, color);
  const tooltipW = tooltip.width;
  const tooltipH = tooltip.height;

  let tx = globalX - tooltipW - 12;
  let ty = globalY - 10;
  if (tx < 4) tx = globalX + 12;
  if (ty + tooltipH > SCREEN_H - 4) ty = SCREEN_H - tooltipH - 4;
  if (ty < 4) ty = 4;

  tooltip.position.set(tx, ty);
  game.hudLayer.addChild(tooltip);
}

/**
 * Show an item tooltip using the item's rarity color.
 */
export function showItemTooltip(
  item: BaseItem,
  globalX: number,
  globalY: number,
  extra?: string,
): void {
  const content = buildItemTooltipText(item, extra);
  showTooltip(content, getRarityColor(item.rarity), globalX, globalY);
}

// ── Comparison tooltip ───────────────────────────────────────────────

/**
 * Get the currently equipped item for a given slot.
 * For rings, returns the first occupied ring slot.
 */
function getEquippedForSlot(slot: Slot): BaseItem | null {
  switch (slot) {
    case Slot.Weapon:  return inventory.equipped.weapon;
    case Slot.Helmet:  return inventory.equipped.helmet;
    case Slot.Chest:   return inventory.equipped.chest;
    case Slot.Boots:   return inventory.equipped.boots;
    case Slot.Ring:    return inventory.equipped.ring1 ?? inventory.equipped.ring2;
    case Slot.Amulet:  return inventory.equipped.amulet;
    case Slot.Offhand: return inventory.equipped.offhand;
    default: return null;
  }
}

/**
 * Show an item tooltip with a comparison tooltip for the currently equipped item
 * in the same slot. If nothing is equipped in that slot, only the main tooltip shows.
 */
export function showItemTooltipWithCompare(
  item: BaseItem,
  globalX: number,
  globalY: number,
  extra?: string,
): void {
  hideTooltip();

  const equipped = getEquippedForSlot(item.slot);

  // Build main tooltip
  const mainContent = buildItemTooltipText(item, extra);
  const mainColor = getRarityColor(item.rarity);
  tooltip = createTooltipContainer(mainContent, mainColor);
  const mainW = tooltip.width;
  const mainH = tooltip.height;

  // Build compare tooltip if there's an equipped item to compare against
  let compareW = 0;
  let compareH = 0;
  if (equipped && equipped !== item) {
    const compareContent = buildItemTooltipText(equipped, 'Equipped');
    const compareColor = getRarityColor(equipped.rarity);
    compareTooltip = createTooltipContainer(compareContent, compareColor);
    compareW = compareTooltip.width;
    compareH = compareTooltip.height;
  }

  const totalW = compareTooltip ? mainW + TOOLTIP_GAP + compareW : mainW;
  const tallestH = Math.max(mainH, compareH);

  // Position: try left of cursor, fall back to right
  let tx = globalX - totalW - 12;
  let ty = globalY - 10;
  if (tx < 4) tx = globalX + 12;
  if (ty + tallestH > SCREEN_H - 4) ty = SCREEN_H - tallestH - 4;
  if (tx + totalW > SCREEN_W - 4) tx = SCREEN_W - totalW - 4;
  if (ty < 4) ty = 4;

  // Main tooltip on the left, compare on the right
  tooltip.position.set(tx, ty);
  game.hudLayer.addChild(tooltip);

  if (compareTooltip) {
    compareTooltip.position.set(tx + mainW + TOOLTIP_GAP, ty);
    game.hudLayer.addChild(compareTooltip);
  }
}

/**
 * Hide the active tooltip (and comparison tooltip if shown).
 */
export function hideTooltip(): void {
  if (tooltip) {
    tooltip.removeFromParent();
    tooltip.destroy({ children: true });
    tooltip = null;
  }
  if (compareTooltip) {
    compareTooltip.removeFromParent();
    compareTooltip.destroy({ children: true });
    compareTooltip = null;
  }
}
