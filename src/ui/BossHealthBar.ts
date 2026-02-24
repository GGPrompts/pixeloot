import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';

const BAR_WIDTH = 400;
const BAR_HEIGHT = 20;
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
  barBg.roundRect(0, 0, BAR_WIDTH, BAR_HEIGHT, 4).fill({ color: 0x222222, alpha: 0.8 });
  barBg.roundRect(0, 0, BAR_WIDTH, BAR_HEIGHT, 4).stroke({ width: 1, color: 0x888888 });
  container.addChild(barBg);

  // Fill bar
  barFill = new Graphics();
  container.addChild(barFill);

  // Boss name text above bar
  nameText = new Text({
    text: 'Dungeon Guardian',
    style: new TextStyle({
      fill: 0xffffff,
      fontSize: 16,
      fontFamily: 'monospace',
      fontWeight: 'bold',
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
      fill: 0xcccccc,
      fontSize: 12,
      fontFamily: 'monospace',
      stroke: { color: 0x000000, width: 2 },
    }),
  });
  phaseText.anchor.set(0.5, 0);
  phaseText.position.set(BAR_WIDTH / 2, BAR_HEIGHT + 2);
  container.addChild(phaseText);

  // Position at top center of screen
  container.position.set((1280 - BAR_WIDTH) / 2, BAR_Y);
  container.visible = false;

  game.hudLayer.addChild(container);
}

function drawFill(ratio: number, phase: number): void {
  if (!barFill) return;
  barFill.clear();

  const fillWidth = Math.max(0, Math.min(1, ratio)) * (BAR_WIDTH - 2);
  if (fillWidth <= 0) return;

  // Color changes per phase: green -> yellow -> red
  let color: number;
  if (phase >= 3) {
    color = 0xff3333;
  } else if (phase >= 2) {
    color = 0xffaa00;
  } else {
    color = 0x44ff44;
  }

  barFill.roundRect(1, 1, fillWidth, BAR_HEIGHT - 2, 3).fill({ color });
}

/**
 * Update the boss health bar each frame. Call from frameUpdate.
 */
export function updateBossHealthBar(): void {
  if (!container) {
    createBar();
  }

  // Find an alive boss
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
