import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { game, isAnyPanelOpen } from '../Game';
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
  getRarityColor, abbreviate, drawPanelBg, drawSlotBg, drawPixelBorder, makeCloseButton,
  drawEquippedBadge, makeEquippedBadgeLabel,
} from './UITheme';
import { showItemTooltip, showItemTooltipWithCompare, showTooltip, hideTooltip, buildItemTooltipText, buildMapTooltipText } from './Tooltip';

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
let confirmOverlay: Container | null = null;
let pendingSellIdx: number | null = null;

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

// --- Confirmation Dialog ---

function showConfirmSell(backpackIdx: number): void {
  if (!container) return;
  hideConfirmDialog();

  const item = inventory.backpack[backpackIdx];
  if (!item) return;

  pendingSellIdx = backpackIdx;
  const overlay = new Container();

  // Dim background
  const dimBg = new Graphics();
  dimBg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).fill({ color: 0x000000, alpha: 0.6 });
  dimBg.eventMode = 'static';
  dimBg.on('pointertap', () => hideConfirmDialog());
  overlay.addChild(dimBg);

  // Dialog box
  const dlgW = 420;
  const dlgH = 160;
  const dlgX = PANEL_X + (PANEL_W - dlgW) / 2;
  const dlgY = PANEL_Y + (PANEL_H - dlgH) / 2;
  const dlgBg = new Graphics();
  drawPanelBg(dlgBg, dlgX, dlgY, dlgW, dlgH, { highlight: Colors.accentRed, shadow: Colors.borderShadow });
  overlay.addChild(dlgBg);

  const warnText = new Text({
    text: 'EQUIPPED ITEM',
    style: new TextStyle({
      fill: Colors.accentRed,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  warnText.position.set(dlgX + dlgW / 2 - warnText.width / 2, dlgY + 16);
  overlay.addChild(warnText);

  const msgText = new Text({
    text: `Sell "${abbreviate(item.name, 24)}" for ${getSellPrice(item)}g?\nThis item is currently equipped!`,
    style: new TextStyle({
      fill: Colors.textPrimary,
      fontSize: FontSize.base,
      fontFamily: Fonts.body,
      wordWrap: true,
      wordWrapWidth: dlgW - 40,
    }),
  });
  msgText.position.set(dlgX + 20, dlgY + 48);
  overlay.addChild(msgText);

  // Confirm button
  const confirmBtn = new Graphics();
  confirmBtn.rect(0, 0, 120, 36).fill({ color: 0x3a1a1a, alpha: 0.95 });
  drawPixelBorder(confirmBtn, 0, 0, 120, 36, { borderWidth: 2, highlight: Colors.accentRed, shadow: Colors.borderShadow });
  confirmBtn.position.set(dlgX + dlgW / 2 - 130, dlgY + dlgH - 50);
  confirmBtn.eventMode = 'static';
  confirmBtn.cursor = 'pointer';
  const confirmLabel = new Text({
    text: 'SELL',
    style: new TextStyle({
      fill: Colors.accentRed,
      fontSize: FontSize.sm,
      fontFamily: Fonts.display,
    }),
  });
  confirmLabel.position.set(34, 8);
  confirmBtn.addChild(confirmLabel);
  confirmBtn.on('pointertap', () => {
    if (pendingSellIdx !== null) {
      sellItem(pendingSellIdx);
    }
    hideConfirmDialog();
  });
  overlay.addChild(confirmBtn);

  // Cancel button
  const cancelBtn = new Graphics();
  cancelBtn.rect(0, 0, 120, 36).fill({ color: Colors.slotBg, alpha: 0.95 });
  drawPixelBorder(cancelBtn, 0, 0, 120, 36, { borderWidth: 2, highlight: Colors.borderHighlight, shadow: Colors.borderShadow });
  cancelBtn.position.set(dlgX + dlgW / 2 + 10, dlgY + dlgH - 50);
  cancelBtn.eventMode = 'static';
  cancelBtn.cursor = 'pointer';
  const cancelLabel = new Text({
    text: 'CANCEL',
    style: new TextStyle({
      fill: Colors.textPrimary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.display,
    }),
  });
  cancelLabel.position.set(18, 8);
  cancelBtn.addChild(cancelLabel);
  cancelBtn.on('pointertap', () => hideConfirmDialog());
  overlay.addChild(cancelBtn);

  confirmOverlay = overlay;
  container.addChild(overlay);
}

function hideConfirmDialog(): void {
  if (confirmOverlay && container) {
    container.removeChild(confirmOverlay);
    confirmOverlay.destroy({ children: true });
    confirmOverlay = null;
  }
  pendingSellIdx = null;
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
        showItemTooltipWithCompare(vendorItem.item, e.globalX, e.globalY, `Buy: ${vendorItem.price}g`);
      }
    });
    slotBg.on('pointermove', (e: FederatedPointerEvent) => {
      const vendorItem = vendorItems[idx];
      if (vendorItem) {
        showItemTooltipWithCompare(vendorItem.item, e.globalX, e.globalY, `Buy: ${vendorItem.price}g`);
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
        const isEquipped = inventory.isItemEquipped(item);
        drawSlotBg(slotBg, 0, 0, SLOT_SIZE, color);
        if (isEquipped) {
          drawEquippedBadge(slotBg, 0, 0, SLOT_SIZE);
        }
        slotC.addChild(slotBg);

        if (isEquipped) {
          const badge = makeEquippedBadgeLabel(SLOT_SIZE);
          slotC.addChild(badge);
        }

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
        slotBg.on('pointertap', () => {
          const bpItem = inventory.backpack[bpIdx];
          if (bpItem && inventory.isItemEquipped(bpItem)) {
            showConfirmSell(bpIdx);
          } else {
            sellItem(bpIdx);
          }
        });
        slotBg.on('pointerover', (e: FederatedPointerEvent) => {
          const bpItem = inventory.backpack[bpIdx];
          if (bpItem) {
            showItemTooltipWithCompare(bpItem, e.globalX, e.globalY, `Sell: ${getSellPrice(bpItem)}g`);
          }
        });
        slotBg.on('pointermove', (e: FederatedPointerEvent) => {
          const bpItem = inventory.backpack[bpIdx];
          if (bpItem) {
            showItemTooltipWithCompare(bpItem, e.globalX, e.globalY, `Sell: ${getSellPrice(bpItem)}g`);
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
    if (visible || !isAnyPanelOpen()) {
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
