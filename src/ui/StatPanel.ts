import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { applyStatEffects } from '../ecs/systems/StatEffects';
import { getComputedStats, type FinalStats } from '../core/ComputedStats';
import {
  Colors, Fonts, FontSize, drawPanelBg, drawDivider, makeCloseButton,
} from './UITheme';

const PANEL_W = 360;
const PANEL_H = 560;
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

let titleText: Text;
let pointsText: Text;
const statValueTexts: Text[] = [];
const statBtnGraphics: Graphics[] = [];
let computedStatsText: Text;

function createPanel(): Container {
  const container = new Container();

  const screenW = game.app.screen.width;
  const screenH = game.app.screen.height;
  const px = (screenW - PANEL_W) / 2;
  const py = (screenH - PANEL_H) / 2;

  // Panel background with 3D border
  const bg = new Graphics();
  drawPanelBg(bg, px, py, PANEL_W, PANEL_H);
  container.addChild(bg);

  // Title
  titleText = new Text({
    text: 'STATS - Lv.1',
    style: new TextStyle({
      fill: Colors.accentGold,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  titleText.position.set(px + 16, py + 16);
  container.addChild(titleText);

  // Available points
  pointsText = new Text({
    text: 'Points: 0',
    style: new TextStyle({
      fill: Colors.accentLime,
      fontSize: FontSize.lg,
      fontFamily: Fonts.body,
    }),
  });
  pointsText.position.set(px + 16, py + 42);
  container.addChild(pointsText);

  // Stat rows
  const startY = py + 74;
  const rowHeight = 50;

  for (let i = 0; i < STAT_NAMES.length; i++) {
    const statName = STAT_NAMES[i];
    const rowY = startY + i * rowHeight;

    // Stat label
    const label = new Text({
      text: STAT_LABELS[statName],
      style: new TextStyle({
        fill: Colors.accentCyan,
        fontSize: 10,
        fontFamily: Fonts.display,
      }),
    });
    label.position.set(px + 20, rowY);
    container.addChild(label);

    // Stat description
    const desc = new Text({
      text: STAT_DESCRIPTIONS[statName],
      style: new TextStyle({
        fill: Colors.textMuted,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    desc.position.set(px + 20, rowY + 20);
    container.addChild(desc);

    // Stat value
    const valText = new Text({
      text: '0',
      style: new TextStyle({
        fill: Colors.textPrimary,
        fontSize: FontSize.xl,
        fontFamily: Fonts.body,
      }),
    });
    valText.position.set(px + 230, rowY);
    container.addChild(valText);
    statValueTexts.push(valText);

    // [+] button with 3D border
    const btn = new Graphics();
    const btnX = px + 278;
    const btnY = rowY - 2;
    const btnSize = 28;
    btn.rect(btnX, btnY, btnSize, btnSize).fill({ color: 0x1a2e1a });
    btn.rect(btnX, btnY, btnSize, btnSize).stroke({ width: 2, color: Colors.accentLime });
    container.addChild(btn);
    statBtnGraphics.push(btn);

    const btnLabel = new Text({
      text: '+',
      style: new TextStyle({
        fill: Colors.accentLime,
        fontSize: FontSize.xl,
        fontFamily: Fonts.body,
        fontWeight: 'bold',
      }),
    });
    btnLabel.position.set(btnX + 8, btnY + 2);
    container.addChild(btnLabel);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = { contains: (x: number, y: number) => x >= btnX && x <= btnX + btnSize && y >= btnY && y <= btnY + btnSize };
    btn.on('pointerdown', () => allocateStat(statName));
  }

  // Divider
  const dividerY = startY + STAT_NAMES.length * rowHeight + 4;
  const divGfx = new Graphics();
  drawDivider(divGfx, px + 16, dividerY, PANEL_W - 32);
  container.addChild(divGfx);

  // Computed Stats Section
  const computedTitle = new Text({
    text: 'COMPUTED STATS',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: 10,
      fontFamily: Fonts.display,
    }),
  });
  computedTitle.position.set(px + 16, dividerY + 10);
  container.addChild(computedTitle);

  computedStatsText = new Text({
    text: '',
    style: new TextStyle({
      fill: Colors.textPrimary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
      lineHeight: 20,
    }),
  });
  computedStatsText.position.set(px + 16, dividerY + 30);
  container.addChild(computedStatsText);

  // Close button
  const closeBtn = makeCloseButton(px + PANEL_W - 50, py + 16, () => {
    visible = false;
    if (panel) panel.visible = false;
  });
  container.addChild(closeBtn);

  container.visible = false;
  return container;
}

function formatComputedStats(stats: FinalStats): string {
  const lines: string[] = [];

  lines.push(`DMG: ${stats.damage}    ATK SPD: x${stats.attackSpeed.toFixed(2)}`);
  lines.push(`PROJ SPD: x${stats.projectileSpeed.toFixed(2)}  CRIT: ${(stats.critChance * 100).toFixed(1)}%`);

  lines.push(`MAX HP: ${stats.maxHP}  ARMOR: ${stats.armor}`);
  lines.push(`DR: ${(stats.damageReduction * 100).toFixed(1)}%  REGEN: ${stats.hpRegen.toFixed(1)}/s`);

  lines.push(`MOVE: ${Math.round(stats.moveSpeed)}  CDR: ${(stats.cooldownReduction * 100).toFixed(1)}%`);
  lines.push(`XP: x${stats.xpMultiplier.toFixed(2)}  GOLD: x${stats.goldMultiplier.toFixed(2)}`);

  return lines.join('\n');
}

function allocateStat(stat: typeof STAT_NAMES[number]): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];
  if (player.statPoints <= 0) return;

  player.statPoints -= 1;
  player.stats[stat] += 1;

  applyStatEffects(player);
  refreshValues();
}

function refreshValues(): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  titleText.text = `STATS - Lv.${player.level}`;
  pointsText.text = `Points: ${player.statPoints}`;

  if (player.statPoints > 0) {
    pointsText.style.fill = Colors.accentLime;
  } else {
    pointsText.style.fill = Colors.textMuted;
  }

  for (let i = 0; i < STAT_NAMES.length; i++) {
    statValueTexts[i].text = `${player.stats[STAT_NAMES[i]]}`;
    statBtnGraphics[i].alpha = player.statPoints > 0 ? 1 : 0.3;
  }

  const computed = getComputedStats();
  computedStatsText.text = formatComputedStats(computed);
}

export function updateStatPanel(): void {
  const input = InputManager.instance;
  const tabPressed = input.isPressed('Tab');

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

  if (visible && panel) {
    refreshValues();
  }
}

export function isStatPanelOpen(): boolean {
  return visible;
}
