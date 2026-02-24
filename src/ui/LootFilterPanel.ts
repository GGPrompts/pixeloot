import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { lootFilter, LootFilterConfig } from '../core/LootFilter';

const PANEL_W = 180;
const PANEL_X = 8;
const PANEL_Y = 140;
const ROW_H = 22;
const CHECKBOX_SIZE = 14;
const PADDING = 10;

interface FilterRow {
  key: keyof LootFilterConfig;
  label: string;
  color: number;
}

const ROWS: FilterRow[] = [
  { key: 'showNormal', label: 'Normal', color: 0xcccccc },
  { key: 'showMagic', label: 'Magic', color: 0x4444ff },
  { key: 'showRare', label: 'Rare', color: 0xffff00 },
  { key: 'showUnique', label: 'Unique', color: 0xff8800 },
  { key: 'showWeapons', label: 'Weapons', color: 0xaaaacc },
  { key: 'showArmor', label: 'Armor', color: 0xaaaacc },
  { key: 'showJewelry', label: 'Jewelry', color: 0xaaaacc },
];

const PANEL_H = PADDING + 24 + ROWS.length * ROW_H + PADDING;

let container: Container | null = null;
let visible = false;
let prevAltFPressed = false;
let prevAltZPressed = false;
let notificationText: Text | null = null;
let notificationTimer = 0;

// Track checkbox graphics for refresh
let checkboxGraphics: Graphics[] = [];

function createPanel(): Container {
  const root = new Container();

  // Background
  const bg = new Graphics();
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).fill({ color: 0x111122, alpha: 0.85 });
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).stroke({ width: 1, color: 0x6666aa });
  root.addChild(bg);

  // Title
  const title = new Text({
    text: 'LOOT FILTER [Alt+F]',
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 12,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  title.position.set(PANEL_X + PADDING, PANEL_Y + PADDING);
  root.addChild(title);

  // Filter rows
  checkboxGraphics = [];
  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i];
    const rowY = PANEL_Y + PADDING + 24 + i * ROW_H;

    // Checkbox
    const cb = new Graphics();
    cb.position.set(PANEL_X + PADDING, rowY);
    cb.eventMode = 'static';
    cb.cursor = 'pointer';
    cb.hitArea = { contains: (x: number, y: number) => x >= 0 && x <= CHECKBOX_SIZE && y >= 0 && y <= CHECKBOX_SIZE };
    const filterKey = row.key;
    cb.on('pointertap', () => {
      lootFilter.toggleFilter(filterKey);
      refreshCheckboxes();
    });
    root.addChild(cb);
    checkboxGraphics.push(cb);

    // Label
    const label = new Text({
      text: row.label,
      style: new TextStyle({
        fill: row.color,
        fontSize: 12,
        fontFamily: 'monospace',
      }),
    });
    label.position.set(PANEL_X + PADDING + CHECKBOX_SIZE + 6, rowY);
    root.addChild(label);
  }

  refreshCheckboxes();
  root.visible = false;
  return root;
}

function refreshCheckboxes(): void {
  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i];
    const cb = checkboxGraphics[i];
    const checked = lootFilter.config[row.key];

    cb.clear();
    cb.rect(0, 0, CHECKBOX_SIZE, CHECKBOX_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
    cb.rect(0, 0, CHECKBOX_SIZE, CHECKBOX_SIZE).stroke({ width: 1, color: checked ? 0x44ff44 : 0x444466 });

    if (checked) {
      // Draw checkmark
      cb.moveTo(3, 7);
      cb.lineTo(6, 11);
      cb.lineTo(11, 3);
      cb.stroke({ width: 2, color: 0x44ff44 });
    }
  }
}

function showNotification(message: string): void {
  if (notificationText) {
    notificationText.removeFromParent();
    notificationText.destroy();
  }

  notificationText = new Text({
    text: message,
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 14,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 3 },
    }),
  });
  notificationText.anchor.set(0.5, 0);
  notificationText.position.set(640, 60);
  game.hudLayer.addChild(notificationText);
  notificationTimer = 2.0; // seconds
}

/**
 * Called every frame from Game.ts frameUpdate.
 * Handles Alt+F toggle, Alt+Z preset cycling, and notification fade.
 */
export function updateLootFilterPanel(dt: number): void {
  const input = InputManager.instance;

  // Alt+F: toggle panel visibility
  const altFDown = input.isPressed('KeyF') && input.isPressed('AltLeft');
  if (altFDown && !prevAltFPressed) {
    visible = !visible;

    if (!container) {
      container = createPanel();
      game.hudLayer.addChild(container);
    }

    container.visible = visible;
    if (visible) {
      refreshCheckboxes();
    }
  }
  prevAltFPressed = altFDown;

  // Alt+Z: cycle filter presets
  const altZDown = input.isPressed('KeyZ') && input.isPressed('AltLeft');
  if (altZDown && !prevAltZPressed) {
    const label = lootFilter.cyclePreset();
    showNotification(`Filter: ${label}`);
    if (visible) {
      refreshCheckboxes();
    }
  }
  prevAltZPressed = altZDown;

  // Fade notification
  if (notificationText && notificationTimer > 0) {
    notificationTimer -= dt;
    if (notificationTimer <= 0.5) {
      notificationText.alpha = Math.max(0, notificationTimer / 0.5);
    }
    if (notificationTimer <= 0) {
      notificationText.removeFromParent();
      notificationText.destroy();
      notificationText = null;
    }
  }
}

export function isLootFilterOpen(): boolean {
  return visible;
}
