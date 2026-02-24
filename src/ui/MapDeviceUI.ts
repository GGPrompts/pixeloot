import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { inventory } from '../core/Inventory';
import { activateMap } from '../core/MapDevice';
import type { MapItem } from '../loot/MapItem';

// Layout
const SCREEN_W = 1280;
const SCREEN_H = 720;
const PANEL_W = 420;
const PANEL_H = 440;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

const TIER_COLORS: Record<number, number> = {
  1: 0xcccccc,
  2: 0x4488ff,
  3: 0xffff00,
  4: 0xff8800,
  5: 0xff4444,
};

let container: Container | null = null;
let visible = false;
let prevMPressed = false;
let selectedMapIndex = -1;

function createPanel(): Container {
  const root = new Container();
  root.visible = false;
  return root;
}

function rebuildPanel(): void {
  if (!container) return;

  // Clear all children
  container.removeChildren();

  // Dim overlay
  const overlay = new Graphics();
  overlay.rect(0, 0, SCREEN_W, SCREEN_H).fill({ color: 0x000000, alpha: 0.5 });
  overlay.eventMode = 'static'; // block clicks through
  container.addChild(overlay);

  // Panel background
  const bg = new Graphics();
  bg.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8).fill({ color: 0x111122, alpha: 0.95 });
  bg.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8).stroke({ width: 2, color: 0x00ffff });
  container.addChild(bg);

  // Title
  const title = new Text({
    text: 'MAP DEVICE',
    style: new TextStyle({
      fill: 0x00ffff,
      fontSize: 20,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  title.position.set(PANEL_X + 16, PANEL_Y + 14);
  container.addChild(title);

  // Close hint
  const hint = new Text({
    text: '[M] close',
    style: new TextStyle({
      fill: 0x666688,
      fontSize: 11,
      fontFamily: 'monospace',
    }),
  });
  hint.position.set(PANEL_X + PANEL_W - 80, PANEL_Y + 18);
  container.addChild(hint);

  const maps = inventory.maps;

  if (maps.length === 0) {
    const emptyText = new Text({
      text: 'No maps found.\n\nMaps drop from defeating enemies.\nBosses always drop maps.',
      style: new TextStyle({
        fill: 0x666688,
        fontSize: 13,
        fontFamily: 'monospace',
        lineHeight: 20,
      }),
    });
    emptyText.position.set(PANEL_X + 20, PANEL_Y + 60);
    container.addChild(emptyText);
    return;
  }

  // Map list (left side)
  const listLabel = new Text({
    text: 'Available Maps:',
    style: new TextStyle({
      fill: 0xaaaacc,
      fontSize: 12,
      fontFamily: 'monospace',
    }),
  });
  listLabel.position.set(PANEL_X + 16, PANEL_Y + 48);
  container.addChild(listLabel);

  const maxVisible = 8;
  const itemH = 32;
  for (let i = 0; i < Math.min(maps.length, maxVisible); i++) {
    const mapItem = maps[i];
    const itemY = PANEL_Y + 68 + i * (itemH + 4);
    const color = TIER_COLORS[mapItem.tier] ?? 0xcccccc;
    const isSelected = i === selectedMapIndex;

    const itemBg = new Graphics();
    itemBg.roundRect(PANEL_X + 12, itemY, PANEL_W - 24, itemH, 4)
      .fill({ color: isSelected ? 0x222244 : 0x0a0a15, alpha: 0.9 });
    itemBg.roundRect(PANEL_X + 12, itemY, PANEL_W - 24, itemH, 4)
      .stroke({ width: isSelected ? 2 : 1, color: isSelected ? color : 0x333355 });
    itemBg.eventMode = 'static';
    itemBg.cursor = 'pointer';

    const idx = i;
    itemBg.on('pointertap', () => {
      selectedMapIndex = idx;
      rebuildPanel();
    });

    container.addChild(itemBg);

    const modCount = mapItem.modifiers.length;
    const mapText = new Text({
      text: `T${mapItem.tier} Map  [${modCount} mod${modCount !== 1 ? 's' : ''}]  +${mapItem.quantityBonus}% qty  +${mapItem.rarityBonus}% rarity`,
      style: new TextStyle({
        fill: color,
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }),
    });
    mapText.position.set(PANEL_X + 20, itemY + 8);
    container.addChild(mapText);
  }

  // Details for selected map
  if (selectedMapIndex >= 0 && selectedMapIndex < maps.length) {
    const selected = maps[selectedMapIndex];
    const detailY = PANEL_Y + 68 + Math.min(maps.length, maxVisible) * (itemH + 4) + 10;
    const color = TIER_COLORS[selected.tier] ?? 0xcccccc;

    // Separator
    const sep = new Graphics();
    sep.moveTo(PANEL_X + 16, detailY)
      .lineTo(PANEL_X + PANEL_W - 16, detailY)
      .stroke({ width: 1, color: 0x333355 });
    container.addChild(sep);

    // Modifier list
    const modTitle = new Text({
      text: `Tier ${selected.tier} Map Modifiers:`,
      style: new TextStyle({
        fill: color,
        fontSize: 13,
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }),
    });
    modTitle.position.set(PANEL_X + 16, detailY + 8);
    container.addChild(modTitle);

    for (let m = 0; m < selected.modifiers.length; m++) {
      const mod = selected.modifiers[m];
      const modText = new Text({
        text: `  - ${mod.description}`,
        style: new TextStyle({
          fill: 0xff6666,
          fontSize: 11,
          fontFamily: 'monospace',
        }),
      });
      modText.position.set(PANEL_X + 16, detailY + 28 + m * 16);
      container.addChild(modText);
    }

    // Bonuses
    const bonusY = detailY + 28 + selected.modifiers.length * 16 + 8;
    const bonusText = new Text({
      text: `+${selected.quantityBonus}% Monster Quantity  |  +${selected.rarityBonus}% Item Rarity`,
      style: new TextStyle({
        fill: 0x44ff44,
        fontSize: 11,
        fontFamily: 'monospace',
      }),
    });
    bonusText.position.set(PANEL_X + 16, bonusY);
    container.addChild(bonusText);

    // Activate button
    const btnW = 140;
    const btnH = 32;
    const btnX = PANEL_X + (PANEL_W - btnW) / 2;
    const btnY = bonusY + 28;

    const btn = new Graphics();
    btn.roundRect(btnX, btnY, btnW, btnH, 4).fill({ color: 0x113311, alpha: 0.9 });
    btn.roundRect(btnX, btnY, btnW, btnH, 4).stroke({ width: 2, color: 0x44ff44 });
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    btn.on('pointerover', () => {
      btn.clear();
      btn.roundRect(btnX, btnY, btnW, btnH, 4).fill({ color: 0x224422, alpha: 0.9 });
      btn.roundRect(btnX, btnY, btnW, btnH, 4).stroke({ width: 2, color: 0x66ff66 });
    });

    btn.on('pointerout', () => {
      btn.clear();
      btn.roundRect(btnX, btnY, btnW, btnH, 4).fill({ color: 0x113311, alpha: 0.9 });
      btn.roundRect(btnX, btnY, btnW, btnH, 4).stroke({ width: 2, color: 0x44ff44 });
    });

    btn.on('pointertap', () => {
      const mapToActivate = inventory.maps[selectedMapIndex];
      if (mapToActivate) {
        inventory.removeMap(mapToActivate.id);
        selectedMapIndex = -1;
        hideMapDevice();
        activateMap(mapToActivate);
      }
    });

    container.addChild(btn);

    const btnLabel = new Text({
      text: 'ACTIVATE',
      style: new TextStyle({
        fill: 0x44ff44,
        fontSize: 14,
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }),
    });
    btnLabel.anchor.set(0.5, 0.5);
    btnLabel.position.set(btnX + btnW / 2, btnY + btnH / 2);
    container.addChild(btnLabel);
  }
}

function showMapDevice(): void {
  if (!container) {
    container = createPanel();
    game.hudLayer.addChild(container);
  }

  visible = true;
  container.visible = true;
  selectedMapIndex = inventory.maps.length > 0 ? 0 : -1;
  rebuildPanel();
}

function hideMapDevice(): void {
  visible = false;
  if (container) {
    container.visible = false;
  }
}

// ── Public API ──────────────────────────────────────────────────────

export function updateMapDeviceUI(): void {
  const input = InputManager.instance;
  const mDown = input.isPressed('KeyM');

  if (mDown && !prevMPressed) {
    if (visible) {
      hideMapDevice();
    } else {
      showMapDevice();
    }
  }

  prevMPressed = mDown;
}

export function isMapDeviceOpen(): boolean {
  return visible;
}
