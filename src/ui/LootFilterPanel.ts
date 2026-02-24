import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { lootFilter, LootFilterConfig } from '../core/LootFilter';
import {
  Colors, Fonts, FontSize, drawPanelBg, drawPixelBorder,
} from './UITheme';

const PANEL_W = 200;
const PANEL_X = 8;
const PANEL_Y = 140;
const ROW_H = 26;
const CHECKBOX_SIZE = 18;
const PADDING = 12;

interface FilterRow {
  key: keyof LootFilterConfig;
  label: string;
  color: number;
}

const ROWS: FilterRow[] = [
  { key: 'showNormal', label: 'Normal', color: 0xBCBCBC },
  { key: 'showMagic', label: 'Magic', color: 0x4488FF },
  { key: 'showRare', label: 'Rare', color: 0xFCBF00 },
  { key: 'showUnique', label: 'Unique', color: 0xFF7700 },
  { key: 'showWeapons', label: 'Weapons', color: Colors.textSecondary },
  { key: 'showArmor', label: 'Armor', color: Colors.textSecondary },
  { key: 'showJewelry', label: 'Jewelry', color: Colors.textSecondary },
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
  drawPanelBg(bg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, { borderWidth: 2 });
  root.addChild(bg);

  // Title
  const title = new Text({
    text: 'LOOT FILTER',
    style: new TextStyle({
      fill: Colors.accentGold,
      fontSize: 10,
      fontFamily: Fonts.display,
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
        fontSize: FontSize.base,
        fontFamily: Fonts.body,
      }),
    });
    label.position.set(PANEL_X + PADDING + CHECKBOX_SIZE + 8, rowY);
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
    cb.rect(0, 0, CHECKBOX_SIZE, CHECKBOX_SIZE).fill({ color: Colors.slotBg, alpha: 0.8 });
    drawPixelBorder(cb, 0, 0, CHECKBOX_SIZE, CHECKBOX_SIZE, {
      borderWidth: 2,
      highlight: checked ? Colors.accentLime : Colors.borderMid,
      shadow: Colors.borderShadow,
    });

    if (checked) {
      // Draw checkmark
      cb.moveTo(4, 9);
      cb.lineTo(7, 14);
      cb.lineTo(14, 4);
      cb.stroke({ width: 2, color: Colors.accentLime });
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
      fill: Colors.accentGold,
      fontSize: FontSize.base,
      fontFamily: Fonts.body,
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
