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
import {
  Colors, Fonts, FontSize,
  getRarityColor, abbreviate, drawPanelBg, drawSlotBg, makeCloseButton,
} from './UITheme';
import { showItemTooltip, showTooltip, hideTooltip, buildItemTooltipText, buildMapTooltipText } from './Tooltip';

import { SCREEN_W, SCREEN_H } from '../core/constants';

// Layout constants
const PANEL_W = 1000;
const PANEL_H = 960;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

const SLOT_SIZE = 100;
const SLOT_GAP = 8;
const VENDOR_COLS = 5;
const BACKPACK_COLS = 5;
const BACKPACK_ROWS = 4;

const VENDOR_GRID_X = 20;
const VENDOR_GRID_Y = 90;
const BACKPACK_GRID_X = 20;
const BACKPACK_GRID_Y = 550;

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
let feedbackText: Text | null = null;
let feedbackTimer = 0;
let visible = false;
let prevVPressed = false;
let prevEscPressed = false;

let vendorItems: VendorItem[] = [];
let vendorMaps: VendorMapItem[] = [];
let goldText: Text | null = null;

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

// --- Panel Creation ---

function createPanel(): Container {
  const root = new Container();

  // Background
  const bg = new Graphics();
  drawPanelBg(bg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, { highlight: Colors.accentLime, shadow: Colors.borderShadow });
  root.addChild(bg);

  // Title
  const title = new Text({
    text: 'VENDOR',
    style: new TextStyle({
      fill: Colors.accentLime,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  title.position.set(PANEL_X + 16, PANEL_Y + 16);
  root.addChild(title);

  // Close button
  const closeBtn = makeCloseButton(PANEL_X + PANEL_W - 70, PANEL_Y + 16, () => {
    visible = false;
    if (container) container.visible = false;
    hideTooltip();
  });
  root.addChild(closeBtn);

  // Gold display
  goldText = new Text({
    text: 'Gold: 0',
    style: new TextStyle({
      fill: Colors.accentGold,
      fontSize: FontSize.lg,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
    }),
  });
  goldText.position.set(PANEL_X + PANEL_W / 2 - 20, PANEL_Y + 16);
  root.addChild(goldText);

  // Vendor section label
  const vendorLabel = new Text({
    text: 'Items for Sale (click to buy)',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  vendorLabel.position.set(PANEL_X + VENDOR_GRID_X, PANEL_Y + VENDOR_GRID_Y - 30);
  root.addChild(vendorLabel);

  // Backpack section label
  const bpLabel = new Text({
    text: 'Your Backpack (click to sell)',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  bpLabel.position.set(PANEL_X + BACKPACK_GRID_X, PANEL_Y + BACKPACK_GRID_Y - 30);
  root.addChild(bpLabel);

  // Feedback text
  feedbackText = new Text({
    text: '',
    style: new TextStyle({
      fill: Colors.accentRed,
      fontSize: FontSize.base,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
    }),
  });
  feedbackText.position.set(PANEL_X + PANEL_W / 2 - 60, PANEL_Y + PANEL_H - 32);
  feedbackText.visible = false;
  root.addChild(feedbackText);

  root.visible = false;
  return root;
}

function refreshPanel(): void {
  if (!container) return;

  // Remove dynamic children (keep first 7: bg, title, close, gold, vendorLabel, bpLabel, feedback)
  while (container.children.length > 7) {
    const child = container.children[container.children.length - 1];
    container.removeChild(child);
    child.destroy({ children: true });
  }

  if (goldText) {
    goldText.text = `Gold: ${getPlayerGold()}`;
  }

  // Vendor gear items
  for (let i = 0; i < vendorItems.length; i++) {
    const vi = vendorItems[i];
    const col = i % VENDOR_COLS;
    const row = Math.floor(i / VENDOR_COLS);
    const sx = PANEL_X + VENDOR_GRID_X + col * (SLOT_SIZE + SLOT_GAP);
    const sy = PANEL_Y + VENDOR_GRID_Y + row * (SLOT_SIZE + SLOT_GAP);

    const slotC = new Container();
    slotC.position.set(sx, sy);

    const color = getRarityColor(vi.item.rarity);

    const slotBg = new Graphics();
    drawSlotBg(slotBg, 0, 0, SLOT_SIZE, color);
    slotC.addChild(slotBg);

    const nameText = new Text({
      text: vi.item.name,
      style: new TextStyle({
        fill: color,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: SLOT_SIZE - 6,
      }),
    });
    nameText.position.set(3, 3);
    slotC.addChild(nameText);

    const priceText = new Text({
      text: `${vi.price}g`,
      style: new TextStyle({
        fill: Colors.accentGold,
        fontSize: FontSize.xs,
        fontFamily: Fonts.body,
      }),
    });
    priceText.position.set(3, SLOT_SIZE - 20);
    slotC.addChild(priceText);

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

  // Vendor map items
  for (let i = 0; i < vendorMaps.length; i++) {
    const vm = vendorMaps[i];
    const globalIdx = vendorItems.length + i;
    const col = globalIdx % VENDOR_COLS;
    const row = Math.floor(globalIdx / VENDOR_COLS);
    const sx = PANEL_X + VENDOR_GRID_X + col * (SLOT_SIZE + SLOT_GAP);
    const sy = PANEL_Y + VENDOR_GRID_Y + row * (SLOT_SIZE + SLOT_GAP);

    const slotC = new Container();
    slotC.position.set(sx, sy);

    const mapColor = Colors.accentCyan;
    const slotBg = new Graphics();
    drawSlotBg(slotBg, 0, 0, SLOT_SIZE, mapColor);
    slotC.addChild(slotBg);

    const nameText = new Text({
      text: `Map T${vm.mapItem.tier}`,
      style: new TextStyle({
        fill: mapColor,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
        fontWeight: 'bold',
      }),
    });
    nameText.position.set(3, 3);
    slotC.addChild(nameText);

    const priceText = new Text({
      text: `${vm.price}g`,
      style: new TextStyle({
        fill: Colors.accentGold,
        fontSize: FontSize.xs,
        fontFamily: Fonts.body,
      }),
    });
    priceText.position.set(3, SLOT_SIZE - 20);
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

  // Player backpack (for selling)
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
        drawSlotBg(slotBg, 0, 0, SLOT_SIZE, color);
        slotC.addChild(slotBg);

        const nameText = new Text({
          text: item.name,
          style: new TextStyle({
            fill: color,
            fontSize: FontSize.sm,
            fontFamily: Fonts.body,
            fontWeight: 'bold',
            wordWrap: true,
            wordWrapWidth: SLOT_SIZE - 6,
          }),
        });
        nameText.position.set(3, 3);
        slotC.addChild(nameText);

        const sellPrice = getSellPrice(item);
        const priceText = new Text({
          text: `${sellPrice}g`,
          style: new TextStyle({
            fill: Colors.accentGold,
            fontSize: FontSize.xs,
            fontFamily: Fonts.body,
          }),
        });
        priceText.position.set(3, SLOT_SIZE - 20);
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
        drawSlotBg(slotBg, 0, 0, SLOT_SIZE);
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
    showFeedback('Not enough gold!', Colors.accentRed);
    return;
  }

  const added = inventory.addItem(vi.item);
  if (!added) {
    showFeedback('Backpack full!', Colors.accentRed);
    return;
  }

  setPlayerGold(gold - vi.price);
  removeFromStock(vendorIdx);
  vendorItems.splice(vendorIdx, 1);
  showFeedback(`Bought ${vi.item.name}`, Colors.accentLime);
  hideTooltip();
  refreshPanel();
}

function buyMap(mapIdx: number): void {
  const vm = vendorMaps[mapIdx];
  if (!vm) return;

  const gold = getPlayerGold();
  if (gold < vm.price) {
    showFeedback('Not enough gold!', Colors.accentRed);
    return;
  }

  inventory.addMap(vm.mapItem);
  setPlayerGold(gold - vm.price);
  removeMapFromStock(mapIdx);
  vendorMaps.splice(mapIdx, 1);
  showFeedback(`Bought Map T${vm.mapItem.tier}`, Colors.accentLime);
  hideTooltip();
  refreshPanel();
}

function sellItem(backpackIdx: number): void {
  const item = inventory.backpack[backpackIdx];
  if (!item) return;

  const price = getSellPrice(item);
  setPlayerGold(getPlayerGold() + price);
  inventory.backpack[backpackIdx] = null;
  showFeedback(`Sold for ${price}g`, Colors.accentGold);
  hideTooltip();
  refreshPanel();
}

// --- Public API ---

export function updateVendorPanel(): void {
  const input = InputManager.instance;
  const vDown = input.isPressed('KeyV');
  const escDown = input.isPressed('Escape');

  if (escDown && !prevEscPressed && visible) {
    visible = false;
    if (container) container.visible = false;
    hideTooltip();
    prevEscPressed = escDown;
    prevVPressed = vDown;
    return;
  }
  prevEscPressed = escDown;

  if (vDown && !prevVPressed) {
    visible = !visible;

    if (!container) {
      container = createPanel();
      game.hudLayer.addChild(container);
    }

    container.visible = visible;
    if (visible) {
      const stock = refreshVendorStock(getPlayerLevel());
      vendorItems = stock.items;
      vendorMaps = stock.maps;
      refreshPanel();
    } else {
      hideTooltip();
    }
  }

  prevVPressed = vDown;

  if (feedbackTimer > 0) {
    feedbackTimer -= 1 / 60;
    if (feedbackTimer <= 0 && feedbackText) {
      feedbackText.visible = false;
    }
  }

  if (visible && goldText) {
    goldText.text = `Gold: ${getPlayerGold()}`;
  }
}

export function isVendorOpen(): boolean {
  return visible;
}

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
