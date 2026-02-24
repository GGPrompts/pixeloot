import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { BaseItem, Rarity, Slot } from '../loot/ItemTypes';
import type { MapItem } from '../loot/MapItem';
import { Colors, Fonts, FontSize, getRarityColor, RARITY_NAMES, drawPixelBorder } from './UITheme';
import { SCREEN_H } from '../core/constants';

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

  tooltip = new Container();

  const text = new Text({
    text: content,
    style: new TextStyle({
      fill: Colors.textPrimary,
      fontSize: FontSize.base,
      fontFamily: Fonts.body,
      lineHeight: 20,
      wordWrap: true,
      wordWrapWidth: 280,
    }),
  });

  const padding = 10;
  const tooltipW = text.width + padding * 2;
  const tooltipH = text.height + padding * 2;

  let tx = globalX - tooltipW - 12;
  let ty = globalY - 10;
  if (tx < 4) tx = globalX + 12;
  if (ty + tooltipH > SCREEN_H - 4) ty = SCREEN_H - tooltipH - 4;
  if (ty < 4) ty = 4;

  const bg = new Graphics();
  bg.rect(0, 0, tooltipW, tooltipH).fill({ color: Colors.slotBg, alpha: 0.95 });
  drawPixelBorder(bg, 0, 0, tooltipW, tooltipH, { borderWidth: 2, highlight: color, shadow: color });
  tooltip.addChild(bg);

  text.position.set(padding, padding);
  tooltip.addChild(text);

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

/**
 * Hide the active tooltip.
 */
export function hideTooltip(): void {
  if (tooltip) {
    tooltip.removeFromParent();
    tooltip.destroy({ children: true });
    tooltip = null;
  }
}
