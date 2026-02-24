import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { skillSystem } from '../core/SkillSystem';
import { rangerSkills } from '../entities/classes/Ranger';
import { mageSkills } from '../entities/classes/Mage';

const SCREEN_W = 1280;
const SCREEN_H = 720;
const PANEL_W = 420;
const PANEL_H = 260;
const BTN_W = 160;
const BTN_H = 100;
const BTN_GAP = 30;

const BG_COLOR = 0x111122;
const BORDER_COLOR = 0x00ffff;

let container: Container | null = null;
let selectionMade = false;
let onSelectCallback: (() => void) | null = null;

interface ClassOption {
  name: string;
  description: string;
  color: number;
  skills: typeof rangerSkills;
}

const classes: ClassOption[] = [
  {
    name: 'Ranger',
    description: 'Ranged DPS\nPower Shot, Multi Shot\nRain of Arrows, Roll',
    color: 0x44ff44,
    skills: rangerSkills,
  },
  {
    name: 'Mage',
    description: 'Arcane Caster\nFireball, Frost Nova\nLightning Bolt, Blink',
    color: 0x8844ff,
    skills: mageSkills,
  },
];

function createButton(
  option: ClassOption,
  x: number,
  y: number,
  parent: Container,
): Container {
  const btn = new Container();
  btn.position.set(x, y);
  btn.eventMode = 'static';
  btn.cursor = 'pointer';

  // Button background
  const bg = new Graphics();
  bg.roundRect(0, 0, BTN_W, BTN_H, 6).fill({ color: BG_COLOR, alpha: 0.95 });
  bg.roundRect(0, 0, BTN_W, BTN_H, 6).stroke({ color: option.color, width: 2 });
  btn.addChild(bg);

  // Class name
  const nameText = new Text({
    text: option.name,
    style: new TextStyle({
      fill: option.color,
      fontSize: 16,
      fontFamily: 'monospace',
      fontWeight: 'bold',
      align: 'center',
    }),
  });
  nameText.anchor.set(0.5, 0);
  nameText.position.set(BTN_W / 2, 8);
  btn.addChild(nameText);

  // Description
  const descText = new Text({
    text: option.description,
    style: new TextStyle({
      fill: 0xcccccc,
      fontSize: 10,
      fontFamily: 'monospace',
      align: 'center',
      lineHeight: 14,
    }),
  });
  descText.anchor.set(0.5, 0);
  descText.position.set(BTN_W / 2, 32);
  btn.addChild(descText);

  // Hover effects
  btn.on('pointerover', () => {
    bg.clear();
    bg.roundRect(0, 0, BTN_W, BTN_H, 6).fill({ color: 0x1a1a33, alpha: 0.95 });
    bg.roundRect(0, 0, BTN_W, BTN_H, 6).stroke({ color: option.color, width: 2, alpha: 1 });
  });

  btn.on('pointerout', () => {
    bg.clear();
    bg.roundRect(0, 0, BTN_W, BTN_H, 6).fill({ color: BG_COLOR, alpha: 0.95 });
    bg.roundRect(0, 0, BTN_W, BTN_H, 6).stroke({ color: option.color, width: 2 });
  });

  btn.on('pointertap', () => {
    selectClass(option);
  });

  parent.addChild(btn);
  return btn;
}

function selectClass(option: ClassOption): void {
  if (selectionMade) return;
  selectionMade = true;

  skillSystem.setClass(option.skills);
  hideClassSelect();

  if (onSelectCallback) {
    onSelectCallback();
  }
}

/**
 * Show the class selection panel. Returns when player selects.
 * Call with a callback that starts gameplay.
 */
export function showClassSelect(onSelect: () => void): void {
  if (container) return;
  selectionMade = false;
  onSelectCallback = onSelect;

  container = new Container();

  // Dim background overlay
  const overlay = new Graphics();
  overlay.rect(0, 0, SCREEN_W, SCREEN_H).fill({ color: 0x000000, alpha: 0.6 });
  overlay.eventMode = 'static'; // block clicks through
  container.addChild(overlay);

  // Panel background
  const panelX = (SCREEN_W - PANEL_W) / 2;
  const panelY = (SCREEN_H - PANEL_H) / 2;

  const panel = new Graphics();
  panel.roundRect(panelX, panelY, PANEL_W, PANEL_H, 8).fill({ color: BG_COLOR, alpha: 0.92 });
  panel.roundRect(panelX, panelY, PANEL_W, PANEL_H, 8).stroke({ color: BORDER_COLOR, width: 2 });
  container.addChild(panel);

  // Title
  const title = new Text({
    text: 'Choose Your Class',
    style: new TextStyle({
      fill: BORDER_COLOR,
      fontSize: 20,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  title.anchor.set(0.5, 0);
  title.position.set(SCREEN_W / 2, panelY + 16);
  container.addChild(title);

  // Subtitle
  const subtitle = new Text({
    text: 'Select a class to begin',
    style: new TextStyle({
      fill: 0x888888,
      fontSize: 11,
      fontFamily: 'monospace',
    }),
  });
  subtitle.anchor.set(0.5, 0);
  subtitle.position.set(SCREEN_W / 2, panelY + 42);
  container.addChild(subtitle);

  // Class buttons
  const totalBtnWidth = classes.length * BTN_W + (classes.length - 1) * BTN_GAP;
  const btnStartX = (SCREEN_W - totalBtnWidth) / 2;
  const btnY = panelY + 70;

  for (let i = 0; i < classes.length; i++) {
    const x = btnStartX + i * (BTN_W + BTN_GAP);
    createButton(classes[i], x, btnY, container);
  }

  // Keyboard hint
  const hint = new Text({
    text: 'Press C anytime to change class',
    style: new TextStyle({
      fill: 0x555555,
      fontSize: 10,
      fontFamily: 'monospace',
    }),
  });
  hint.anchor.set(0.5, 1);
  hint.position.set(SCREEN_W / 2, panelY + PANEL_H - 10);
  container.addChild(hint);

  game.hudLayer.addChild(container);
}

export function hideClassSelect(): void {
  if (container) {
    container.removeFromParent();
    container.destroy({ children: true });
    container = null;
  }
}

export function isClassSelectVisible(): boolean {
  return container !== null;
}

/**
 * Toggle class select on/off. Used for the 'C' keybind.
 */
export function toggleClassSelect(): void {
  if (container) {
    hideClassSelect();
  } else {
    selectionMade = false;
    showClassSelect(() => {
      // Class changed mid-game, nothing extra needed
    });
  }
}
