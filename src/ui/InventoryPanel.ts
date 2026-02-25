import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { game, isAnyPanelOpen } from '../Game';
import { InputManager } from '../core/InputManager';
import { inventory, EquipSlots } from '../core/Inventory';
import { BaseItem, Rarity, Slot } from '../loot/ItemTypes';
import {
  Colors, Fonts, FontSize, RARITY_COLORS, RARITY_NAMES,
  getRarityColor, abbreviate, drawPanelBg, drawSlotBg, drawDivider,
  makeCloseButton,
} from './UITheme';
import { showItemTooltip, showItemTooltipWithCompare, hideTooltip } from './Tooltip';
import { spawnFloatingText } from './DamageNumbers';

import { SCREEN_W, SCREEN_H } from '../core/constants';

// Layout constants
const PANEL_W = 780;
const PANEL_H = 820;
const PANEL_X = SCREEN_W - PANEL_W - 20;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

const GEAR_SLOT_SIZE = 72;
const GEAR_SLOT_GAP = 7;
const GEAR_COL_X = 24;
const GEAR_START_Y = 64;

const BACKPACK_COLS = 5;
const BACKPACK_ROWS = 4;
const BACKPACK_SLOT_SIZE = 88;
const BACKPACK_GAP = 8;
const BACKPACK_X = 300;
const BACKPACK_Y = 64;

const SLOT_NAME_MAP: Record<Slot, string> = {
  [Slot.Weapon]: 'Weapon',
  [Slot.Helmet]: 'Helmet',
  [Slot.Chest]: 'Chest',
  [Slot.Boots]: 'Boots',
  [Slot.Ring]: 'Ring',
  [Slot.Amulet]: 'Amulet',
  [Slot.Offhand]: 'Offhand',
};

const SLOT_LABELS: { key: keyof EquipSlots; label: string }[] = [
  { key: 'weapon', label: 'Weapon' },
  { key: 'helmet', label: 'Helmet' },
  { key: 'chest', label: 'Chest' },
  { key: 'boots', label: 'Boots' },
  { key: 'ring1', label: 'Ring 1' },
  { key: 'ring2', label: 'Ring 2' },
  { key: 'amulet', label: 'Amulet' },
  { key: 'offhand', label: 'Offhand' },
];

let container: Container | null = null;
let visible = false;
let prevIPressed = false;
let prevEscPressed = false;

let gearSlotContainers: Container[] = [];
let backpackSlotContainers: Container[] = [];

function createPanel(): Container {
  const root = new Container();

  // Background with 3D border
  const bg = new Graphics();
  drawPanelBg(bg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  root.addChild(bg);

  // Title
  const title = new Text({
    text: 'INVENTORY',
    style: new TextStyle({
      fill: Colors.accentGold,
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

  // --- Equipment section label ---
  const gearLabel = new Text({
    text: 'Equipment',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  gearLabel.position.set(PANEL_X + GEAR_COL_X, PANEL_Y + GEAR_START_Y - 28);
  root.addChild(gearLabel);

  gearSlotContainers = [];
  for (let i = 0; i < SLOT_LABELS.length; i++) {
    const slotInfo = SLOT_LABELS[i];
    const slotY = PANEL_Y + GEAR_START_Y + i * (GEAR_SLOT_SIZE + GEAR_SLOT_GAP);
    const slotX = PANEL_X + GEAR_COL_X;

    const slotContainer = new Container();
    slotContainer.position.set(slotX, slotY);

    const slotBg = new Graphics();
    drawSlotBg(slotBg, 0, 0, GEAR_SLOT_SIZE * 3.5, undefined, GEAR_SLOT_SIZE);
    slotContainer.addChild(slotBg);

    const labelText = new Text({
      text: slotInfo.label,
      style: new TextStyle({
        fill: Colors.textMuted,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    labelText.position.set(6, 4);
    slotContainer.addChild(labelText);

    slotBg.eventMode = 'static';
    slotBg.cursor = 'pointer';
    const key = slotInfo.key;
    slotBg.on('pointertap', () => {
      if (inventory.equipped[key]) {
        inventory.unequipItem(key);
        refreshSlots();
      }
    });

    slotBg.on('pointerover', (e: FederatedPointerEvent) => {
      const item = inventory.equipped[key];
      if (item) showItemTooltip(item, e.globalX, e.globalY);
    });
    slotBg.on('pointermove', (e: FederatedPointerEvent) => {
      const item = inventory.equipped[key];
      if (item) showItemTooltip(item, e.globalX, e.globalY);
    });
    slotBg.on('pointerout', () => hideTooltip());

    root.addChild(slotContainer);
    gearSlotContainers.push(slotContainer);
  }

  // --- Divider between gear and backpack ---
  const dividerGfx = new Graphics();
  drawDivider(dividerGfx, PANEL_X + BACKPACK_X - 16, PANEL_Y + GEAR_START_Y, PANEL_H - 80);
  root.addChild(dividerGfx);

  // --- Backpack label ---
  const bpLabel = new Text({
    text: 'Backpack',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  bpLabel.position.set(PANEL_X + BACKPACK_X, PANEL_Y + BACKPACK_Y - 28);
  root.addChild(bpLabel);

  backpackSlotContainers = [];
  for (let row = 0; row < BACKPACK_ROWS; row++) {
    for (let col = 0; col < BACKPACK_COLS; col++) {
      const idx = row * BACKPACK_COLS + col;
      const sx = PANEL_X + BACKPACK_X + col * (BACKPACK_SLOT_SIZE + BACKPACK_GAP);
      const sy = PANEL_Y + BACKPACK_Y + row * (BACKPACK_SLOT_SIZE + BACKPACK_GAP);

      const slotContainer = new Container();
      slotContainer.position.set(sx, sy);

      const slotBg = new Graphics();
      drawSlotBg(slotBg, 0, 0, BACKPACK_SLOT_SIZE);
      slotContainer.addChild(slotBg);

      slotBg.eventMode = 'static';
      slotBg.cursor = 'pointer';
      const slotIdx = idx;
      slotBg.on('pointertap', (e: FederatedPointerEvent) => {
        const item = inventory.backpack[slotIdx];
        if (item) {
          const err = inventory.equipItem(slotIdx);
          if (err) {
            spawnFloatingText(e.globalX, e.globalY - 20, err, 0xff4444);
          }
          refreshSlots();
        }
      });

      slotBg.on('pointerover', (e: FederatedPointerEvent) => {
        const item = inventory.backpack[slotIdx];
        if (item) showItemTooltipWithCompare(item, e.globalX, e.globalY);
      });
      slotBg.on('pointermove', (e: FederatedPointerEvent) => {
        const item = inventory.backpack[slotIdx];
        if (item) showItemTooltipWithCompare(item, e.globalX, e.globalY);
      });
      slotBg.on('pointerout', () => hideTooltip());

      root.addChild(slotContainer);
      backpackSlotContainers.push(slotContainer);
    }
  }

  root.visible = false;
  return root;
}

function refreshSlots(): void {
  // Refresh gear slots
  for (let i = 0; i < SLOT_LABELS.length; i++) {
    const slotInfo = SLOT_LABELS[i];
    const slotContainer = gearSlotContainers[i];
    const item = inventory.equipped[slotInfo.key];

    while (slotContainer.children.length > 2) {
      slotContainer.removeChildAt(2);
    }

    const labelText = slotContainer.children[1] as Text;
    const slotBg = slotContainer.children[0] as Graphics;

    if (item) {
      labelText.visible = false;
      const color = getRarityColor(item.rarity);

      slotBg.clear();
      drawSlotBg(slotBg, 0, 0, GEAR_SLOT_SIZE * 3.5, color, GEAR_SLOT_SIZE);

      const nameText = new Text({
        text: abbreviate(item.name, 22),
        style: new TextStyle({
          fill: color,
          fontSize: FontSize.base,
          fontFamily: Fonts.body,
          fontWeight: 'bold',
        }),
      });
      nameText.position.set(6, 4);
      slotContainer.addChild(nameText);

      const infoText = new Text({
        text: `Lv.${item.level} ${SLOT_NAME_MAP[item.slot]}`,
        style: new TextStyle({
          fill: Colors.textMuted,
          fontSize: FontSize.sm,
          fontFamily: Fonts.body,
        }),
      });
      infoText.position.set(6, 22);
      slotContainer.addChild(infoText);

      const statsArr: string[] = [];
      if (item.baseStats.damage) statsArr.push(`DMG:${item.baseStats.damage}`);
      if (item.baseStats.armor) statsArr.push(`ARM:${item.baseStats.armor}`);
      if (item.baseStats.attackSpeed) statsArr.push(`SPD:${item.baseStats.attackSpeed}`);
      if (statsArr.length > 0) {
        const statText = new Text({
          text: statsArr.join(' '),
          style: new TextStyle({
            fill: Colors.textSecondary,
            fontSize: FontSize.sm,
            fontFamily: Fonts.body,
          }),
        });
        statText.position.set(6, 38);
        slotContainer.addChild(statText);
      }
    } else {
      labelText.visible = true;
      slotBg.clear();
      drawSlotBg(slotBg, 0, 0, GEAR_SLOT_SIZE * 3.5, undefined, GEAR_SLOT_SIZE);
    }
  }

  // Refresh backpack slots
  for (let i = 0; i < backpackSlotContainers.length; i++) {
    const slotContainer = backpackSlotContainers[i];
    const item = inventory.backpack[i];

    while (slotContainer.children.length > 1) {
      slotContainer.removeChildAt(1);
    }

    const slotBg = slotContainer.children[0] as Graphics;

    if (item) {
      const color = getRarityColor(item.rarity);

      slotBg.clear();
      drawSlotBg(slotBg, 0, 0, BACKPACK_SLOT_SIZE, color);

      const nameText = new Text({
        text: abbreviate(item.name, 12),
        style: new TextStyle({
          fill: color,
          fontSize: FontSize.sm,
          fontFamily: Fonts.body,
          fontWeight: 'bold',
        }),
      });
      nameText.position.set(3, 4);
      slotContainer.addChild(nameText);

      const slotIcon = new Text({
        text: SLOT_NAME_MAP[item.slot].slice(0, 3),
        style: new TextStyle({
          fill: Colors.textMuted,
          fontSize: FontSize.xs,
          fontFamily: Fonts.body,
        }),
      });
      slotIcon.position.set(3, 50);
      slotContainer.addChild(slotIcon);
    } else {
      slotBg.clear();
      drawSlotBg(slotBg, 0, 0, BACKPACK_SLOT_SIZE);
    }
  }
}

// --- Public API ---

export function updateInventoryPanel(): void {
  const input = InputManager.instance;
  const iDown = input.isPressed('KeyI');
  const escDown = input.isPressed('Escape');

  if (escDown && !prevEscPressed && visible) {
    visible = false;
    if (container) container.visible = false;
    hideTooltip();
    prevEscPressed = escDown;
    prevIPressed = iDown;
    return;
  }
  prevEscPressed = escDown;

  if (iDown && !prevIPressed) {
    // Only open if no other panel is visible; always allow closing
    if (visible || !isAnyPanelOpen()) {
      visible = !visible;

      if (!container) {
        container = createPanel();
        game.hudLayer.addChild(container);
      }

      container.visible = visible;
      if (visible) {
        refreshSlots();
      } else {
        hideTooltip();
      }
    }
  }

  prevIPressed = iDown;

  if (visible && container) {
    refreshSlots();
  }
}

export function isInventoryOpen(): boolean {
  return visible;
}
