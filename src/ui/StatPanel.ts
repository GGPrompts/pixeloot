import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { applyStatEffects } from '../ecs/systems/StatEffects';

const PANEL_W = 320;
const PANEL_H = 280;
const STAT_NAMES = ['dexterity', 'intelligence', 'vitality', 'focus'] as const;
const STAT_LABELS: Record<string, string> = {
  dexterity: 'DEX',
  intelligence: 'INT',
  vitality: 'VIT',
  focus: 'FOC',
};
const STAT_DESCRIPTIONS: Record<string, string> = {
  dexterity: '+5% proj speed, +3% atk speed',
  intelligence: '+8% skill damage',
  vitality: '+10 max HP',
  focus: '+5% cooldown reduction',
};

const players = world.with('player', 'statPoints', 'stats', 'level', 'health');

let panel: Container | null = null;
let visible = false;
let tabWasPressed = false;

// UI elements that need updating
let titleText: Text;
let pointsText: Text;
const statValueTexts: Text[] = [];
const statBtnGraphics: Graphics[] = [];

function createPanel(): Container {
  const container = new Container();

  const screenW = game.app.screen.width;
  const screenH = game.app.screen.height;
  const px = (screenW - PANEL_W) / 2;
  const py = (screenH - PANEL_H) / 2;

  // Semi-transparent dark background
  const bg = new Graphics();
  bg.rect(px, py, PANEL_W, PANEL_H).fill({ color: 0x111122, alpha: 0.92 });
  bg.rect(px, py, PANEL_W, PANEL_H).stroke({ width: 2, color: 0x6666aa });
  container.addChild(bg);

  // Title
  titleText = new Text({
    text: 'STATS - Lv.1',
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 18,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  titleText.position.set(px + 16, py + 12);
  container.addChild(titleText);

  // Available points
  pointsText = new Text({
    text: 'Points: 0',
    style: new TextStyle({
      fill: 0x44ff44,
      fontSize: 14,
      fontFamily: 'monospace',
    }),
  });
  pointsText.position.set(px + 16, py + 38);
  container.addChild(pointsText);

  // Stat rows
  const startY = py + 70;
  const rowHeight = 46;

  for (let i = 0; i < STAT_NAMES.length; i++) {
    const statName = STAT_NAMES[i];
    const rowY = startY + i * rowHeight;

    // Stat label
    const label = new Text({
      text: STAT_LABELS[statName],
      style: new TextStyle({
        fill: 0xccccff,
        fontSize: 16,
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }),
    });
    label.position.set(px + 20, rowY);
    container.addChild(label);

    // Stat description
    const desc = new Text({
      text: STAT_DESCRIPTIONS[statName],
      style: new TextStyle({
        fill: 0x888899,
        fontSize: 11,
        fontFamily: 'monospace',
      }),
    });
    desc.position.set(px + 20, rowY + 18);
    container.addChild(desc);

    // Stat value
    const valText = new Text({
      text: '0',
      style: new TextStyle({
        fill: 0xffffff,
        fontSize: 16,
        fontFamily: 'monospace',
      }),
    });
    valText.position.set(px + 210, rowY);
    container.addChild(valText);
    statValueTexts.push(valText);

    // [+] button
    const btn = new Graphics();
    const btnX = px + 250;
    const btnY = rowY - 2;
    const btnSize = 24;
    btn.rect(btnX, btnY, btnSize, btnSize).fill({ color: 0x335533 });
    btn.rect(btnX, btnY, btnSize, btnSize).stroke({ width: 1, color: 0x44ff44 });
    container.addChild(btn);
    statBtnGraphics.push(btn);

    const btnLabel = new Text({
      text: '+',
      style: new TextStyle({
        fill: 0x44ff44,
        fontSize: 16,
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }),
    });
    btnLabel.position.set(btnX + 7, btnY + 2);
    container.addChild(btnLabel);

    // Make button interactive
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = { contains: (x: number, y: number) => x >= btnX && x <= btnX + btnSize && y >= btnY && y <= btnY + btnSize };
    btn.on('pointerdown', () => allocateStat(statName));
  }

  // Close hint
  const hint = new Text({
    text: '[Tab] to close',
    style: new TextStyle({
      fill: 0x666688,
      fontSize: 12,
      fontFamily: 'monospace',
    }),
  });
  hint.position.set(px + 16, py + PANEL_H - 24);
  container.addChild(hint);

  container.visible = false;
  return container;
}

function allocateStat(stat: typeof STAT_NAMES[number]): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];
  if (player.statPoints <= 0) return;

  player.statPoints -= 1;
  player.stats[stat] += 1;

  // Apply stat effects immediately
  applyStatEffects(player);

  refreshValues();
}

function refreshValues(): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  titleText.text = `STATS - Lv.${player.level}`;
  pointsText.text = `Points: ${player.statPoints}`;

  if (player.statPoints > 0) {
    pointsText.style.fill = 0x44ff44;
  } else {
    pointsText.style.fill = 0x888888;
  }

  for (let i = 0; i < STAT_NAMES.length; i++) {
    statValueTexts[i].text = `${player.stats[STAT_NAMES[i]]}`;
    // Dim buttons when no points
    statBtnGraphics[i].alpha = player.statPoints > 0 ? 1 : 0.3;
  }
}

/**
 * Call every frame to handle Tab toggle and refresh displayed values.
 */
export function updateStatPanel(): void {
  const input = InputManager.instance;
  const tabPressed = input.isPressed('Tab');

  // Toggle on rising edge of Tab press
  if (tabPressed && !tabWasPressed) {
    visible = !visible;

    if (!panel) {
      panel = createPanel();
      game.hudLayer.addChild(panel);
    }

    panel.visible = visible;
    if (visible) {
      refreshValues();
    }
  }
  tabWasPressed = tabPressed;

  // Update values while visible
  if (visible && panel) {
    refreshValues();
  }
}

/**
 * Returns true if the stat panel is currently open.
 * Used to disable game input while the panel is open.
 */
export function isStatPanelOpen(): boolean {
  return visible;
}
