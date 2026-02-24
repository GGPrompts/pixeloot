import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { Colors, Fonts, FontSize, drawPixelBorder } from './UITheme';
import { SCREEN_W } from '../core/constants';

const BAR_WIDTH = 440;
const BAR_HEIGHT = 24;
const BAR_Y = 40;

const bosses = world.with('boss', 'enemy', 'health');

let container: Container | null = null;
let barBg: Graphics | null = null;
let barFill: Graphics | null = null;
let nameText: Text | null = null;
let phaseText: Text | null = null;

function createBar(): void {
  container = new Container();

  // Background bar
  barBg = new Graphics();
  barBg.rect(0, 0, BAR_WIDTH, BAR_HEIGHT).fill({ color: 0x222222, alpha: 0.8 });
  drawPixelBorder(barBg, 0, 0, BAR_WIDTH, BAR_HEIGHT, { borderWidth: 2 });
  container.addChild(barBg);

  // Fill bar
  barFill = new Graphics();
  container.addChild(barFill);

  // Boss name text above bar
  nameText = new Text({
    text: 'Dungeon Guardian',
    style: new TextStyle({
      fill: Colors.textPrimary,
      fontSize: 10,
      fontFamily: Fonts.display,
      stroke: { color: 0x000000, width: 3 },
    }),
  });
  nameText.anchor.set(0.5, 1);
  nameText.position.set(BAR_WIDTH / 2, -4);
  container.addChild(nameText);

  // Phase text below bar
  phaseText = new Text({
    text: 'Phase 1',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.base,
      fontFamily: Fonts.body,
      stroke: { color: 0x000000, width: 2 },
    }),
  });
  phaseText.anchor.set(0.5, 0);
  phaseText.position.set(BAR_WIDTH / 2, BAR_HEIGHT + 2);
  container.addChild(phaseText);

  container.position.set((SCREEN_W - BAR_WIDTH) / 2, BAR_Y);
  container.visible = false;

  game.hudLayer.addChild(container);
}

function drawFill(ratio: number, phase: number): void {
  if (!barFill) return;
  barFill.clear();

  const fillWidth = Math.max(0, Math.min(1, ratio)) * (BAR_WIDTH - 4);
  if (fillWidth <= 0) return;

  let color: number;
  if (phase >= 3) {
    color = Colors.accentRed;
  } else if (phase >= 2) {
    color = Colors.accentOrange;
  } else {
    color = Colors.accentLime;
  }

  barFill.rect(2, 2, fillWidth, BAR_HEIGHT - 4).fill({ color });
}

export function updateBossHealthBar(): void {
  if (!container) {
    createBar();
  }

  let activeBoss: (typeof bosses.entities)[number] | null = null;
  for (const b of bosses) {
    if (!b.dead) {
      activeBoss = b;
      break;
    }
  }

  if (!activeBoss) {
    if (container) container.visible = false;
    return;
  }

  container!.visible = true;

  const ratio = activeBoss.health.current / activeBoss.health.max;
  const phase = activeBoss.bossPhase ?? 1;

  drawFill(ratio, phase);

  if (phaseText) {
    phaseText.text = `Phase ${phase}`;
  }
}
