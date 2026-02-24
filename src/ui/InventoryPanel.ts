import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { inventory, EquipSlots } from '../core/Inventory';
import { BaseItem, Rarity, Slot } from '../loot/ItemTypes';

// Layout constants
const SCREEN_W = 1280;
const SCREEN_H = 720;
const PANEL_W = 400;
const PANEL_H = 480;
const PANEL_X = SCREEN_W - PANEL_W - 20; // right side
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

const GEAR_SLOT_SIZE = 48;
const GEAR_SLOT_GAP = 6;
const GEAR_COL_X = 24; // relative to panel
const GEAR_START_Y = 50;

const BACKPACK_COLS = 4;
const BACKPACK_ROWS = 5;
const BACKPACK_SLOT_SIZE = 40;
const BACKPACK_GAP = 4;
const BACKPACK_X = 200; // relative to panel
const BACKPACK_Y = 50;

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
let visible = false;
let prevIPressed = false;
let prevEPressed = false;
let prevEscPressed = false;

// Track slot graphics for refresh
let gearSlotContainers: Container[] = [];
let backpackSlotContainers: Container[] = [];

function getRarityColor(rarity: Rarity): number {
  return RARITY_COLORS[rarity] ?? 0xcccccc;
}

function abbreviate(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '.';
}

function createPanel(): Container {
  const root = new Container();

  // Background
  const bg = new Graphics();
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).fill({ color: 0x111122, alpha: 0.9 });
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).stroke({ width: 2, color: 0x6666aa });
  root.addChild(bg);

  // Title
  const title = new Text({
    text: 'INVENTORY',
    style: new TextStyle({
      fill: 0xffd700,
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

  // --- Gear Slots ---
  const gearLabel = new Text({
    text: 'Equipment',
    style: new TextStyle({
      fill: 0xaaaacc,
      fontSize: 12,
      fontFamily: 'monospace',
    }),
  });
  gearLabel.position.set(PANEL_X + GEAR_COL_X, PANEL_Y + GEAR_START_Y - 16);
  root.addChild(gearLabel);

  gearSlotContainers = [];
  for (let i = 0; i < SLOT_LABELS.length; i++) {
    const slotInfo = SLOT_LABELS[i];
    const slotY = PANEL_Y + GEAR_START_Y + i * (GEAR_SLOT_SIZE + GEAR_SLOT_GAP);
    const slotX = PANEL_X + GEAR_COL_X;

    const slotContainer = new Container();
    slotContainer.position.set(slotX, slotY);

    // Slot background
    const slotBg = new Graphics();
    slotBg.rect(0, 0, GEAR_SLOT_SIZE * 3, GEAR_SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
    slotBg.rect(0, 0, GEAR_SLOT_SIZE * 3, GEAR_SLOT_SIZE).stroke({ width: 1, color: 0x333355 });
    slotContainer.addChild(slotBg);

    // Slot label (placeholder when empty)
    const labelText = new Text({
      text: slotInfo.label,
      style: new TextStyle({
        fill: 0x444466,
        fontSize: 11,
        fontFamily: 'monospace',
      }),
    });
    labelText.position.set(6, 4);
    slotContainer.addChild(labelText);

    // Make interactive for click to unequip
    slotBg.eventMode = 'static';
    slotBg.cursor = 'pointer';
    const key = slotInfo.key;
    slotBg.on('pointertap', () => {
      if (inventory.equipped[key]) {
        inventory.unequipItem(key);
        refreshSlots();
      }
    });

    // Hover for tooltip
    slotBg.on('pointerover', (e: FederatedPointerEvent) => {
      const item = inventory.equipped[key];
      if (item) showTooltip(item, e.globalX, e.globalY);
    });
    slotBg.on('pointermove', (e: FederatedPointerEvent) => {
      const item = inventory.equipped[key];
      if (item) showTooltip(item, e.globalX, e.globalY);
    });
    slotBg.on('pointerout', () => {
      hideTooltip();
    });

    root.addChild(slotContainer);
    gearSlotContainers.push(slotContainer);
  }

  // --- Backpack ---
  const bpLabel = new Text({
    text: 'Backpack',
    style: new TextStyle({
      fill: 0xaaaacc,
      fontSize: 12,
      fontFamily: 'monospace',
    }),
  });
  bpLabel.position.set(PANEL_X + BACKPACK_X, PANEL_Y + BACKPACK_Y - 16);
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
      slotBg.rect(0, 0, BACKPACK_SLOT_SIZE, BACKPACK_SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
      slotBg.rect(0, 0, BACKPACK_SLOT_SIZE, BACKPACK_SLOT_SIZE).stroke({ width: 1, color: 0x333355 });
      slotContainer.addChild(slotBg);

      // Make interactive for click to equip
      slotBg.eventMode = 'static';
      slotBg.cursor = 'pointer';
      const slotIdx = idx;
      slotBg.on('pointertap', () => {
        const item = inventory.backpack[slotIdx];
        if (item) {
          inventory.equipItem(slotIdx);
          refreshSlots();
        }
      });

      // Hover for tooltip
      slotBg.on('pointerover', (e: FederatedPointerEvent) => {
        const item = inventory.backpack[slotIdx];
        if (item) showTooltip(item, e.globalX, e.globalY);
      });
      slotBg.on('pointermove', (e: FederatedPointerEvent) => {
        const item = inventory.backpack[slotIdx];
        if (item) showTooltip(item, e.globalX, e.globalY);
      });
      slotBg.on('pointerout', () => {
        hideTooltip();
      });

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

    // Remove old item display (keep bg at index 0, label at index 1)
    while (slotContainer.children.length > 2) {
      slotContainer.removeChildAt(2);
    }

    // Get the label text child
    const labelText = slotContainer.children[1] as Text;
    const slotBg = slotContainer.children[0] as Graphics;

    if (item) {
      labelText.visible = false;
      const color = getRarityColor(item.rarity);

      // Redraw border with rarity color
      slotBg.clear();
      slotBg.rect(0, 0, GEAR_SLOT_SIZE * 3, GEAR_SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
      slotBg.rect(0, 0, GEAR_SLOT_SIZE * 3, GEAR_SLOT_SIZE).stroke({ width: 2, color });

      // Item name
      const nameText = new Text({
        text: abbreviate(item.name, 16),
        style: new TextStyle({
          fill: color,
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }),
      });
      nameText.position.set(6, 4);
      slotContainer.addChild(nameText);

      // Slot type + level
      const infoText = new Text({
        text: `Lv.${item.level} ${SLOT_NAME_MAP[item.slot]}`,
        style: new TextStyle({
          fill: 0x888899,
          fontSize: 9,
          fontFamily: 'monospace',
        }),
      });
      infoText.position.set(6, 20);
      slotContainer.addChild(infoText);

      // Brief stats
      const statsArr: string[] = [];
      if (item.baseStats.damage) statsArr.push(`DMG:${item.baseStats.damage}`);
      if (item.baseStats.armor) statsArr.push(`ARM:${item.baseStats.armor}`);
      if (item.baseStats.attackSpeed) statsArr.push(`SPD:${item.baseStats.attackSpeed}`);
      if (statsArr.length > 0) {
        const statText = new Text({
          text: statsArr.join(' '),
          style: new TextStyle({
            fill: 0x999999,
            fontSize: 9,
            fontFamily: 'monospace',
          }),
        });
        statText.position.set(6, 34);
        slotContainer.addChild(statText);
      }
    } else {
      labelText.visible = true;
      // Reset border
      slotBg.clear();
      slotBg.rect(0, 0, GEAR_SLOT_SIZE * 3, GEAR_SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
      slotBg.rect(0, 0, GEAR_SLOT_SIZE * 3, GEAR_SLOT_SIZE).stroke({ width: 1, color: 0x333355 });
    }
  }

  // Refresh backpack slots
  for (let i = 0; i < backpackSlotContainers.length; i++) {
    const slotContainer = backpackSlotContainers[i];
    const item = inventory.backpack[i];

    // Remove old item display (keep bg at index 0)
    while (slotContainer.children.length > 1) {
      slotContainer.removeChildAt(1);
    }

    const slotBg = slotContainer.children[0] as Graphics;

    if (item) {
      const color = getRarityColor(item.rarity);

      // Redraw with rarity border
      slotBg.clear();
      slotBg.rect(0, 0, BACKPACK_SLOT_SIZE, BACKPACK_SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
      slotBg.rect(0, 0, BACKPACK_SLOT_SIZE, BACKPACK_SLOT_SIZE).stroke({ width: 2, color });

      // Item abbreviation
      const nameText = new Text({
        text: abbreviate(item.name, 5),
        style: new TextStyle({
          fill: color,
          fontSize: 9,
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }),
      });
      nameText.position.set(3, 4);
      slotContainer.addChild(nameText);

      // Slot icon text
      const slotIcon = new Text({
        text: SLOT_NAME_MAP[item.slot].slice(0, 3),
        style: new TextStyle({
          fill: 0x666688,
          fontSize: 8,
          fontFamily: 'monospace',
        }),
      });
      slotIcon.position.set(3, 26);
      slotContainer.addChild(slotIcon);
    } else {
      // Reset border
      slotBg.clear();
      slotBg.rect(0, 0, BACKPACK_SLOT_SIZE, BACKPACK_SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
      slotBg.rect(0, 0, BACKPACK_SLOT_SIZE, BACKPACK_SLOT_SIZE).stroke({ width: 1, color: 0x333355 });
    }
  }
}

// --- Tooltip ---

function buildTooltipText(item: BaseItem): string {
  const rarityName = RARITY_NAMES[item.rarity];
  const slotName = SLOT_NAME_MAP[item.slot];
  const lines: string[] = [];

  lines.push(`[${rarityName}] ${item.name}`);
  lines.push(`Level ${item.level} ${slotName}`);
  lines.push('\u2500'.repeat(20));

  // Base stats
  if (item.baseStats.damage) lines.push(`Damage: ${item.baseStats.damage}`);
  if (item.baseStats.armor) lines.push(`Armor: ${item.baseStats.armor}`);
  if (item.baseStats.attackSpeed) lines.push(`Attack Speed: ${item.baseStats.attackSpeed}`);

  // Affixes
  if (item.affixes.length > 0) {
    lines.push('\u2500'.repeat(20));
    for (const affix of item.affixes) {
      const sign = affix.value >= 0 ? '+' : '';
      // Determine if stat looks like a percentage
      const isPercent = affix.stat.includes('%') || affix.stat.includes('percent')
        || affix.stat.includes('critical') || affix.stat.includes('speed')
        || affix.stat.includes('movement');
      lines.push(`${sign}${affix.value}${isPercent ? '%' : ''} ${affix.stat}`);
    }
  }

  // Unique effect
  if (item.uniqueEffect) {
    lines.push('\u2500'.repeat(20));
    lines.push(item.uniqueEffect);
  }

  return lines.join('\n');
}

function showTooltip(item: BaseItem, globalX: number, globalY: number): void {
  hideTooltip();

  tooltip = new Container();
  const color = getRarityColor(item.rarity);
  const content = buildTooltipText(item);

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

  // Position to the left of cursor, clamped to screen
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

// --- Public API ---

export function updateInventoryPanel(): void {
  const input = InputManager.instance;
  const iDown = input.isPressed('KeyI');
  const eDown = input.isPressed('KeyE');
  const escDown = input.isPressed('Escape');

  // Close on Escape rising edge
  if (escDown && !prevEscPressed && visible) {
    visible = false;
    if (container) container.visible = false;
    hideTooltip();
    prevEscPressed = escDown;
    prevIPressed = iDown;
    prevEPressed = eDown;
    return;
  }
  prevEscPressed = escDown;

  // Toggle on rising edge
  if ((iDown && !prevIPressed) || (eDown && !prevEPressed)) {
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

  prevIPressed = iDown;
  prevEPressed = eDown;

  // Refresh while visible
  if (visible && container) {
    refreshSlots();
  }
}

export function isInventoryOpen(): boolean {
  return visible;
}
