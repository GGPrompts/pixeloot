import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game, isAnyPanelOpen } from '../Game';
import { InputManager } from '../core/InputManager';
import { inventory } from '../core/Inventory';
import { activateMap } from '../core/MapDevice';
import type { MapItem } from '../loot/MapItem';
import {
  Colors, Fonts, FontSize, drawPanelBg, drawPixelBorder, makeCloseButton,
} from './UITheme';

import { SCREEN_W, SCREEN_H } from '../core/constants';

// Layout
const PANEL_W = 740;
const PANEL_H = 760;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

const TIER_COLORS: Record<number, number> = {
  1: 0xBCBCBC,
  2: 0x4488FF,
  3: 0xFCBF00,
  4: 0xFF7700,
  5: Colors.accentRed,
};

let container: Container | null = null;
let visible = false;
let prevMPressed = false;
let prevEscPressed = false;
let selectedMapIndex = -1;

function createPanel(): Container {
  const root = new Container();
  root.visible = false;
  return root;
}

function rebuildPanel(): void {
  if (!container) return;

  container.removeChildren();

  // Dim overlay
  const overlay = new Graphics();
  overlay.rect(0, 0, SCREEN_W, SCREEN_H).fill({ color: 0x000000, alpha: 0.5 });
  overlay.eventMode = 'static';
  container.addChild(overlay);

  // Panel background
  const bg = new Graphics();
  drawPanelBg(bg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  container.addChild(bg);

  // Title
  const title = new Text({
    text: 'MAP DEVICE',
    style: new TextStyle({
      fill: Colors.accentCyan,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  title.position.set(PANEL_X + 16, PANEL_Y + 16);
  container.addChild(title);

  // Close button
  const closeBtn = makeCloseButton(PANEL_X + PANEL_W - 70, PANEL_Y + 16, () => { hideMapDevice(); });
  container.addChild(closeBtn);

  const maps = inventory.maps;

  // "Training Grounds" free entry button
  const freeY = PANEL_Y + 64;
  const freeLabel = new Text({
    text: 'Free Entry:',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  freeLabel.position.set(PANEL_X + 16, freeY);
  container.addChild(freeLabel);

  const freeBtnW = PANEL_W - 24;
  const freeBtnH = 56;
  const freeBtnX = PANEL_X + 12;
  const freeBtnY = freeY + 20;

  const freeBtn = new Graphics();
  freeBtn.rect(freeBtnX, freeBtnY, freeBtnW, freeBtnH).fill({ color: 0x0a150a, alpha: 0.9 });
  drawPixelBorder(freeBtn, freeBtnX, freeBtnY, freeBtnW, freeBtnH, { borderWidth: 2, highlight: Colors.accentLime, shadow: Colors.borderShadow });
  freeBtn.eventMode = 'static';
  freeBtn.cursor = 'pointer';

  freeBtn.on('pointerover', () => {
    freeBtn.clear();
    freeBtn.rect(freeBtnX, freeBtnY, freeBtnW, freeBtnH).fill({ color: 0x1a2e1a, alpha: 0.9 });
    drawPixelBorder(freeBtn, freeBtnX, freeBtnY, freeBtnW, freeBtnH, { borderWidth: 2, highlight: Colors.accentLime, shadow: Colors.borderShadow });
  });

  freeBtn.on('pointerout', () => {
    freeBtn.clear();
    freeBtn.rect(freeBtnX, freeBtnY, freeBtnW, freeBtnH).fill({ color: 0x0a150a, alpha: 0.9 });
    drawPixelBorder(freeBtn, freeBtnX, freeBtnY, freeBtnW, freeBtnH, { borderWidth: 2, highlight: Colors.accentLime, shadow: Colors.borderShadow });
  });

  freeBtn.on('pointertap', () => {
    hideMapDevice();
    activateMap({ id: '__free__', tier: 1, modifiers: [], quantityBonus: 0, rarityBonus: 0 });
  });

  container.addChild(freeBtn);

  const freeBtnLabel = new Text({
    text: 'Training Grounds  (T1, no modifiers)',
    style: new TextStyle({
      fill: Colors.accentLime,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  freeBtnLabel.position.set(freeBtnX + 12, freeBtnY + 12);
  container.addChild(freeBtnLabel);

  if (maps.length === 0) {
    const emptyText = new Text({
      text: 'No maps in inventory.\nMaps drop from bosses and enemies.',
      style: new TextStyle({
        fill: Colors.textMuted,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
        lineHeight: 20,
      }),
    });
    emptyText.position.set(PANEL_X + 20, freeBtnY + freeBtnH + 16);
    container.addChild(emptyText);
    return;
  }

  // Map list
  const listStartY = freeBtnY + freeBtnH + 16;
  const listLabel = new Text({
    text: 'Available Maps:',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  listLabel.position.set(PANEL_X + 16, listStartY);
  container.addChild(listLabel);

  const maxVisible = 6;
  const itemH = 56;
  for (let i = 0; i < Math.min(maps.length, maxVisible); i++) {
    const mapItem = maps[i];
    const itemY = listStartY + 22 + i * (itemH + 4);
    const color = TIER_COLORS[mapItem.tier] ?? 0xBCBCBC;
    const isSelected = i === selectedMapIndex;

    const itemBg = new Graphics();
    itemBg.rect(PANEL_X + 12, itemY, PANEL_W - 24, itemH)
      .fill({ color: isSelected ? 0x1a2a4e : Colors.slotBg, alpha: 0.9 });
    if (isSelected) {
      drawPixelBorder(itemBg, PANEL_X + 12, itemY, PANEL_W - 24, itemH, { borderWidth: 2, highlight: color, shadow: Colors.borderShadow });
    } else {
      itemBg.rect(PANEL_X + 12, itemY, PANEL_W - 24, itemH).stroke({ width: 1, color: Colors.borderMid });
    }
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
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
        fontWeight: 'bold',
      }),
    });
    mapText.position.set(PANEL_X + 20, itemY + 12);
    container.addChild(mapText);
  }

  // Details for selected map
  if (selectedMapIndex >= 0 && selectedMapIndex < maps.length) {
    const selected = maps[selectedMapIndex];
    const detailY = listStartY + 22 + Math.min(maps.length, maxVisible) * (itemH + 4) + 10;
    const color = TIER_COLORS[selected.tier] ?? 0xBCBCBC;

    // Separator
    const sep = new Graphics();
    sep.moveTo(PANEL_X + 16, detailY)
      .lineTo(PANEL_X + PANEL_W - 16, detailY)
      .stroke({ width: 2, color: Colors.divider });
    container.addChild(sep);

    const modTitle = new Text({
      text: `Tier ${selected.tier} Map Modifiers:`,
      style: new TextStyle({
        fill: color,
        fontSize: FontSize.base,
        fontFamily: Fonts.body,
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
          fill: Colors.accentRed,
          fontSize: FontSize.sm,
          fontFamily: Fonts.body,
        }),
      });
      modText.position.set(PANEL_X + 16, detailY + 36 + m * 24);
      container.addChild(modText);
    }

    const bonusY = detailY + 36 + selected.modifiers.length * 24 + 10;
    const bonusText = new Text({
      text: `+${selected.quantityBonus}% Monster Quantity  |  +${selected.rarityBonus}% Item Rarity`,
      style: new TextStyle({
        fill: Colors.accentLime,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    bonusText.position.set(PANEL_X + 16, bonusY);
    container.addChild(bonusText);

    // Activate button
    const btnW = 200;
    const btnH = 44;
    const btnX = PANEL_X + (PANEL_W - btnW) / 2;
    const btnY = bonusY + 36;

    const btn = new Graphics();
    btn.rect(btnX, btnY, btnW, btnH).fill({ color: 0x113311, alpha: 0.9 });
    drawPixelBorder(btn, btnX, btnY, btnW, btnH, { borderWidth: 2, highlight: Colors.accentLime, shadow: Colors.borderShadow });
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    btn.on('pointerover', () => {
      btn.clear();
      btn.rect(btnX, btnY, btnW, btnH).fill({ color: 0x224422, alpha: 0.9 });
      drawPixelBorder(btn, btnX, btnY, btnW, btnH, { borderWidth: 2, highlight: Colors.accentLime, shadow: Colors.borderShadow });
    });

    btn.on('pointerout', () => {
      btn.clear();
      btn.rect(btnX, btnY, btnW, btnH).fill({ color: 0x113311, alpha: 0.9 });
      drawPixelBorder(btn, btnX, btnY, btnW, btnH, { borderWidth: 2, highlight: Colors.accentLime, shadow: Colors.borderShadow });
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
        fill: Colors.accentLime,
        fontSize: FontSize.base,
        fontFamily: Fonts.body,
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

export function updateMapDeviceUI(): void {
  const input = InputManager.instance;
  const mDown = input.isPressed('KeyM');
  const escDown = input.isPressed('Escape');

  if (escDown && !prevEscPressed && visible) {
    hideMapDevice();
    prevEscPressed = escDown;
    prevMPressed = mDown;
    return;
  }
  prevEscPressed = escDown;

  if (mDown && !prevMPressed) {
    if (visible) {
      hideMapDevice();
    } else if (!isAnyPanelOpen()) {
      showMapDevice();
    }
  }

  prevMPressed = mDown;
}

export function isMapDeviceOpen(): boolean {
  return visible;
}

export function openMapDevicePanel(): void {
  showMapDevice();
}
