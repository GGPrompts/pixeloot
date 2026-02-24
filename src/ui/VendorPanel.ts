import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { inventory } from '../core/Inventory';
import { world } from '../ecs/world';
import { BaseItem, Rarity, Slot } from '../loot/ItemTypes';
import type { MapItem } from '../loot/MapItem';
import {
  type VendorItem,
  type VendorMapItem,
  refreshVendorStock,
  removeFromStock,
  removeMapFromStock,
  getSellPrice,
} from '../core/Vendor';

import { SCREEN_W, SCREEN_H } from '../core/constants';

// Layout constants
const PANEL_W = 520;
const PANEL_H = 560;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

const SLOT_SIZE = 42;
const SLOT_GAP = 4;
const VENDOR_COLS = 4;
const VENDOR_ROWS = 4; // up to 14 items (12 gear + 2 maps) in 4x4 grid with overflow
const BACKPACK_COLS = 4;
const BACKPACK_ROWS = 5;

const VENDOR_GRID_X = 20;
const VENDOR_GRID_Y = 70;
const BACKPACK_GRID_X = 20;
const BACKPACK_GRID_Y = 320;

// Rarity colors
const RARITY_COLORS: Record<Rarity, number> = {
  [Rarity.Normal]: 0xcccccc,
  [Rarity.Magic]: 0x4488ff,
  [Rarity.Rare]: 0xffff00,
  [Rarity.Unique]: 0xff8800,
};

const RARITY_NAMES: Record<Rarity, string> = {
  [Rarity.Normal]: 'Normal',
  [Rarity.Magic]: 'Magic',
  [Rarity.Rare]: 'Rare',
  [Rarity.Unique]: 'Unique',
};

const SLOT_NAME_MAP: Record<Slot, string> = {
  [Slot.Weapon]: 'Weapon',
  [Slot.Helmet]: 'Helmet',
  [Slot.Chest]: 'Chest',
  [Slot.Boots]: 'Boots',
  [Slot.Ring]: 'Ring',
  [Slot.Amulet]: 'Amulet',
  [Slot.Offhand]: 'Offhand',
};

let container: Container | null = null;
let tooltip: Container | null = null;
let feedbackText: Text | null = null;
let feedbackTimer = 0;
let visible = false;
let prevVPressed = false;
let prevEscPressed = false;

// Cached stock for current open session
let vendorItems: VendorItem[] = [];
let vendorMaps: VendorMapItem[] = [];
let goldText: Text | null = null;

function getRarityColor(rarity: Rarity): number {
  return RARITY_COLORS[rarity] ?? 0xcccccc;
}

function abbreviate(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '.';
}

function getPlayerGold(): number {
  const players = world.with('player', 'gold').entities;
  return players.length > 0 ? (players[0].gold ?? 0) : 0;
}

function setPlayerGold(amount: number): void {
  const players = world.with('player', 'gold').entities;
  if (players.length > 0) {
    players[0].gold = amount;
  }
}

function getPlayerLevel(): number {
  const players = world.with('player', 'level').entities;
  return players.length > 0 ? (players[0].level ?? 1) : 1;
}

function showFeedback(msg: string, color: number): void {
  if (feedbackText && container) {
    feedbackText.text = msg;
    feedbackText.style.fill = color;
    feedbackText.visible = true;
    feedbackTimer = 2.0;
  }
}

// --- Tooltip ---

function buildItemTooltipText(item: BaseItem, extra?: string): string {
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

function buildMapTooltipText(mapItem: MapItem, price: number): string {
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

function showTooltip(content: string, color: number, globalX: number, globalY: number): void {
  hideTooltip();

  tooltip = new Container();

  const text = new Text({
    text: content,
    style: new TextStyle({
      fill: 0xeeeeee,
      fontSize: 11,
      fontFamily: 'monospace',
      lineHeight: 16,
      wordWrap: true,
      wordWrapWidth: 240,
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
  bg.rect(0, 0, tooltipW, tooltipH).fill({ color: 0x0a0a18, alpha: 0.95 });
  bg.rect(0, 0, tooltipW, tooltipH).stroke({ width: 1, color });
  tooltip.addChild(bg);

  text.position.set(padding, padding);
  tooltip.addChild(text);

  tooltip.position.set(tx, ty);
  game.hudLayer.addChild(tooltip);
}

function hideTooltip(): void {
  if (tooltip) {
    tooltip.removeFromParent();
    tooltip.destroy({ children: true });
    tooltip = null;
  }
}

// --- Panel Creation ---

function createPanel(): Container {
  const root = new Container();

  // Background
  const bg = new Graphics();
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).fill({ color: 0x111122, alpha: 0.92 });
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).stroke({ width: 2, color: 0x88aa44 });
  root.addChild(bg);

  // Title
  const title = new Text({
    text: 'VENDOR',
    style: new TextStyle({
      fill: 0x88cc44,
      fontSize: 18,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  title.position.set(PANEL_X + 16, PANEL_Y + 14);
  root.addChild(title);

  // Close button
  const hint = new Text({
    text: '[X] close',
    style: new TextStyle({
      fill: 0x666688,
      fontSize: 11,
      fontFamily: 'monospace',
    }),
  });
  hint.position.set(PANEL_X + PANEL_W - 80, PANEL_Y + 18);
  hint.eventMode = 'static';
  hint.cursor = 'pointer';
  hint.on('pointerover', () => { hint.style.fill = 0xff4444; });
  hint.on('pointerout', () => { hint.style.fill = 0x666688; });
  hint.on('pointertap', () => {
    visible = false;
    if (container) container.visible = false;
    hideTooltip();
  });
  root.addChild(hint);

  // Gold display
  goldText = new Text({
    text: 'Gold: 0',
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 14,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  goldText.position.set(PANEL_X + PANEL_W / 2 - 20, PANEL_Y + 14);
  root.addChild(goldText);

  // --- Vendor section label ---
  const vendorLabel = new Text({
    text: 'Items for Sale (click to buy)',
    style: new TextStyle({
      fill: 0xaaccaa,
      fontSize: 12,
      fontFamily: 'monospace',
    }),
  });
  vendorLabel.position.set(PANEL_X + VENDOR_GRID_X, PANEL_Y + VENDOR_GRID_Y - 16);
  root.addChild(vendorLabel);

  // --- Backpack section label ---
  const bpLabel = new Text({
    text: 'Your Backpack (click to sell)',
    style: new TextStyle({
      fill: 0xaaaacc,
      fontSize: 12,
      fontFamily: 'monospace',
    }),
  });
  bpLabel.position.set(PANEL_X + BACKPACK_GRID_X, PANEL_Y + BACKPACK_GRID_Y - 16);
  root.addChild(bpLabel);

  // Feedback text
  feedbackText = new Text({
    text: '',
    style: new TextStyle({
      fill: 0xff4444,
      fontSize: 13,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  feedbackText.position.set(PANEL_X + PANEL_W / 2 - 60, PANEL_Y + PANEL_H - 30);
  feedbackText.visible = false;
  root.addChild(feedbackText);

  root.visible = false;
  return root;
}

/** Rebuild vendor + backpack slots inside the panel. */
function refreshPanel(): void {
  if (!container) return;

  // Remove all dynamic children (keep first 7: bg, title, hint, gold, vendorLabel, bpLabel, feedback)
  while (container.children.length > 7) {
    const child = container.children[container.children.length - 1];
    container.removeChild(child);
    child.destroy({ children: true });
  }

  // Update gold
  if (goldText) {
    goldText.text = `Gold: ${getPlayerGold()}`;
  }

  // --- Render vendor gear items ---
  const vendorCols = VENDOR_COLS;

  for (let i = 0; i < vendorItems.length; i++) {
    const vi = vendorItems[i];
    const col = i % vendorCols;
    const row = Math.floor(i / vendorCols);
    const sx = PANEL_X + VENDOR_GRID_X + col * (SLOT_SIZE + SLOT_GAP);
    const sy = PANEL_Y + VENDOR_GRID_Y + row * (SLOT_SIZE + SLOT_GAP);

    const slotC = new Container();
    slotC.position.set(sx, sy);

    const color = getRarityColor(vi.item.rarity);

    const slotBg = new Graphics();
    slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
    slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 2, color });
    slotC.addChild(slotBg);

    // Item name abbreviation
    const nameText = new Text({
      text: abbreviate(vi.item.name, 6),
      style: new TextStyle({
        fill: color,
        fontSize: 9,
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }),
    });
    nameText.position.set(3, 3);
    slotC.addChild(nameText);

    // Price
    const priceText = new Text({
      text: `${vi.price}g`,
      style: new TextStyle({
        fill: 0xffd700,
        fontSize: 8,
        fontFamily: 'monospace',
      }),
    });
    priceText.position.set(3, 30);
    slotC.addChild(priceText);

    // Interactivity
    slotBg.eventMode = 'static';
    slotBg.cursor = 'pointer';
    const idx = i;
    slotBg.on('pointertap', () => buyItem(idx));
    slotBg.on('pointerover', (e: FederatedPointerEvent) => {
      const vendorItem = vendorItems[idx];
      if (vendorItem) {
        const content = buildItemTooltipText(vendorItem.item, `Buy: ${vendorItem.price}g`);
        showTooltip(content, getRarityColor(vendorItem.item.rarity), e.globalX, e.globalY);
      }
    });
    slotBg.on('pointermove', (e: FederatedPointerEvent) => {
      const vendorItem = vendorItems[idx];
      if (vendorItem) {
        const content = buildItemTooltipText(vendorItem.item, `Buy: ${vendorItem.price}g`);
        showTooltip(content, getRarityColor(vendorItem.item.rarity), e.globalX, e.globalY);
      }
    });
    slotBg.on('pointerout', () => hideTooltip());

    container.addChild(slotC);
  }

  // --- Render vendor map items (after gear items) ---
  for (let i = 0; i < vendorMaps.length; i++) {
    const vm = vendorMaps[i];
    const globalIdx = vendorItems.length + i;
    const col = globalIdx % vendorCols;
    const row = Math.floor(globalIdx / vendorCols);
    const sx = PANEL_X + VENDOR_GRID_X + col * (SLOT_SIZE + SLOT_GAP);
    const sy = PANEL_Y + VENDOR_GRID_Y + row * (SLOT_SIZE + SLOT_GAP);

    const slotC = new Container();
    slotC.position.set(sx, sy);

    const mapColor = 0x44ddaa;
    const slotBg = new Graphics();
    slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
    slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 2, color: mapColor });
    slotC.addChild(slotBg);

    const nameText = new Text({
      text: `Map T${vm.mapItem.tier}`,
      style: new TextStyle({
        fill: mapColor,
        fontSize: 9,
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }),
    });
    nameText.position.set(3, 3);
    slotC.addChild(nameText);

    const priceText = new Text({
      text: `${vm.price}g`,
      style: new TextStyle({
        fill: 0xffd700,
        fontSize: 8,
        fontFamily: 'monospace',
      }),
    });
    priceText.position.set(3, 30);
    slotC.addChild(priceText);

    slotBg.eventMode = 'static';
    slotBg.cursor = 'pointer';
    const mIdx = i;
    slotBg.on('pointertap', () => buyMap(mIdx));
    slotBg.on('pointerover', (e: FederatedPointerEvent) => {
      const vendorMap = vendorMaps[mIdx];
      if (vendorMap) {
        const content = buildMapTooltipText(vendorMap.mapItem, vendorMap.price);
        showTooltip(content, mapColor, e.globalX, e.globalY);
      }
    });
    slotBg.on('pointermove', (e: FederatedPointerEvent) => {
      const vendorMap = vendorMaps[mIdx];
      if (vendorMap) {
        const content = buildMapTooltipText(vendorMap.mapItem, vendorMap.price);
        showTooltip(content, mapColor, e.globalX, e.globalY);
      }
    });
    slotBg.on('pointerout', () => hideTooltip());

    container.addChild(slotC);
  }

  // --- Render player backpack (for selling) ---
  // Show price overlay on backpack items, shifted to right side of panel
  const bpOffsetX = PANEL_X + BACKPACK_GRID_X;
  for (let row = 0; row < BACKPACK_ROWS; row++) {
    for (let col = 0; col < BACKPACK_COLS; col++) {
      const idx = row * BACKPACK_COLS + col;
      const sx = bpOffsetX + col * (SLOT_SIZE + SLOT_GAP);
      const sy = PANEL_Y + BACKPACK_GRID_Y + row * (SLOT_SIZE + SLOT_GAP);

      const slotC = new Container();
      slotC.position.set(sx, sy);

      const item = inventory.backpack[idx];
      const slotBg = new Graphics();

      if (item) {
        const color = getRarityColor(item.rarity);
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 2, color });
        slotC.addChild(slotBg);

        const nameText = new Text({
          text: abbreviate(item.name, 6),
          style: new TextStyle({
            fill: color,
            fontSize: 9,
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }),
        });
        nameText.position.set(3, 3);
        slotC.addChild(nameText);

        // Show sell price
        const sellPrice = getSellPrice(item);
        const priceText = new Text({
          text: `${sellPrice}g`,
          style: new TextStyle({
            fill: 0xffcc44,
            fontSize: 8,
            fontFamily: 'monospace',
          }),
        });
        priceText.position.set(3, 30);
        slotC.addChild(priceText);

        slotBg.eventMode = 'static';
        slotBg.cursor = 'pointer';
        const bpIdx = idx;
        slotBg.on('pointertap', () => sellItem(bpIdx));
        slotBg.on('pointerover', (e: FederatedPointerEvent) => {
          const bpItem = inventory.backpack[bpIdx];
          if (bpItem) {
            const sp = getSellPrice(bpItem);
            const content = buildItemTooltipText(bpItem, `Sell: ${sp}g`);
            showTooltip(content, getRarityColor(bpItem.rarity), e.globalX, e.globalY);
          }
        });
        slotBg.on('pointermove', (e: FederatedPointerEvent) => {
          const bpItem = inventory.backpack[bpIdx];
          if (bpItem) {
            const sp = getSellPrice(bpItem);
            const content = buildItemTooltipText(bpItem, `Sell: ${sp}g`);
            showTooltip(content, getRarityColor(bpItem.rarity), e.globalX, e.globalY);
          }
        });
        slotBg.on('pointerout', () => hideTooltip());
      } else {
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 1, color: 0x333355 });
        slotC.addChild(slotBg);
      }

      container.addChild(slotC);
    }
  }
}

// --- Buy / Sell ---

function buyItem(vendorIdx: number): void {
  const vi = vendorItems[vendorIdx];
  if (!vi) return;

  const gold = getPlayerGold();
  if (gold < vi.price) {
    showFeedback('Not enough gold!', 0xff4444);
    return;
  }

  const added = inventory.addItem(vi.item);
  if (!added) {
    showFeedback('Backpack full!', 0xff4444);
    return;
  }

  setPlayerGold(gold - vi.price);
  removeFromStock(vendorIdx);
  vendorItems.splice(vendorIdx, 1);
  showFeedback(`Bought ${vi.item.name}`, 0x44ff44);
  hideTooltip();
  refreshPanel();
}

function buyMap(mapIdx: number): void {
  const vm = vendorMaps[mapIdx];
  if (!vm) return;

  const gold = getPlayerGold();
  if (gold < vm.price) {
    showFeedback('Not enough gold!', 0xff4444);
    return;
  }

  inventory.addMap(vm.mapItem);
  setPlayerGold(gold - vm.price);
  removeMapFromStock(mapIdx);
  vendorMaps.splice(mapIdx, 1);
  showFeedback(`Bought Map T${vm.mapItem.tier}`, 0x44ff44);
  hideTooltip();
  refreshPanel();
}

function sellItem(backpackIdx: number): void {
  const item = inventory.backpack[backpackIdx];
  if (!item) return;

  const price = getSellPrice(item);
  setPlayerGold(getPlayerGold() + price);
  inventory.backpack[backpackIdx] = null;
  showFeedback(`Sold for ${price}g`, 0xffd700);
  hideTooltip();
  refreshPanel();
}

// --- Public API ---

export function updateVendorPanel(): void {
  const input = InputManager.instance;
  const vDown = input.isPressed('KeyV');
  const escDown = input.isPressed('Escape');

  // Close on Escape rising edge
  if (escDown && !prevEscPressed && visible) {
    visible = false;
    if (container) container.visible = false;
    hideTooltip();
    prevEscPressed = escDown;
    prevVPressed = vDown;
    return;
  }
  prevEscPressed = escDown;

  // Toggle on rising edge
  if (vDown && !prevVPressed) {
    visible = !visible;

    if (!container) {
      container = createPanel();
      game.hudLayer.addChild(container);
    }

    container.visible = visible;
    if (visible) {
      // Refresh stock on open
      const stock = refreshVendorStock(getPlayerLevel());
      vendorItems = stock.items;
      vendorMaps = stock.maps;
      refreshPanel();
    } else {
      hideTooltip();
    }
  }

  prevVPressed = vDown;

  // Tick feedback timer
  if (feedbackTimer > 0) {
    feedbackTimer -= 1 / 60; // approximate per-frame
    if (feedbackTimer <= 0 && feedbackText) {
      feedbackText.visible = false;
    }
  }

  // Refresh gold display while visible
  if (visible && goldText) {
    goldText.text = `Gold: ${getPlayerGold()}`;
  }
}

export function isVendorOpen(): boolean {
  return visible;
}

/** Programmatically open the vendor panel (used by NPC click). */
export function openVendorPanel(): void {
  if (!container) {
    container = createPanel();
    game.hudLayer.addChild(container);
  }
  visible = true;
  container.visible = true;
  const stock = refreshVendorStock(getPlayerLevel());
  vendorItems = stock.items;
  vendorMaps = stock.maps;
  refreshPanel();
}
