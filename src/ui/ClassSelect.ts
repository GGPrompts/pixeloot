import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { skillSystem } from '../core/SkillSystem';
import { rangerSkills } from '../entities/classes/Ranger';
import { mageSkills } from '../entities/classes/Mage';
import {
  Colors, Fonts, FontSize, drawPanelBg, drawPixelBorder, makeCloseButton,
} from './UITheme';
import { InputManager } from '../core/InputManager';
import { switchClass } from '../save/SaveManager';

import { SCREEN_W, SCREEN_H } from '../core/constants';

const PANEL_W = 800;
const PANEL_H = 480;
const BTN_W = 300;
const BTN_H = 200;
const BTN_GAP = 40;

let container: Container | null = null;
let selectionMade = false;
let onSelectCallback: (() => void) | null = null;
let dismissable = false;
let prevEscPressed = false;

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
  bg.rect(0, 0, BTN_W, BTN_H).fill({ color: Colors.slotBg, alpha: 0.95 });
  drawPixelBorder(bg, 0, 0, BTN_W, BTN_H, { borderWidth: 3, highlight: option.color, shadow: Colors.borderShadow });
  btn.addChild(bg);

  // Class name
  const nameText = new Text({
    text: option.name,
    style: new TextStyle({
      fill: option.color,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
      align: 'center',
    }),
  });
  nameText.anchor.set(0.5, 0);
  nameText.position.set(BTN_W / 2, 12);
  btn.addChild(nameText);

  // Description
  const descText = new Text({
    text: option.description,
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
      align: 'center',
      lineHeight: 24,
    }),
  });
  descText.anchor.set(0.5, 0);
  descText.position.set(BTN_W / 2, 40);
  btn.addChild(descText);

  // Hover effects
  btn.on('pointerover', () => {
    bg.clear();
    bg.rect(0, 0, BTN_W, BTN_H).fill({ color: 0x1a2a4e, alpha: 0.95 });
    drawPixelBorder(bg, 0, 0, BTN_W, BTN_H, { borderWidth: 3, highlight: option.color, shadow: Colors.borderShadow });
  });

  btn.on('pointerout', () => {
    bg.clear();
    bg.rect(0, 0, BTN_W, BTN_H).fill({ color: Colors.slotBg, alpha: 0.95 });
    drawPixelBorder(bg, 0, 0, BTN_W, BTN_H, { borderWidth: 3, highlight: option.color, shadow: Colors.borderShadow });
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

  // Use switchClass for per-class progression (saves current class, loads target)
  switchClass(option.name).then(() => {
    hideClassSelect();
    if (onSelectCallback) {
      onSelectCallback();
    }
  });
}

/**
 * Show the class selection panel. Returns when player selects.
 * Call with a callback that starts gameplay.
 */
export function showClassSelect(onSelect: () => void): void {
  if (container) return;
  selectionMade = false;
  onSelectCallback = onSelect;
  // Dismissable if the player already has a class (mid-game reclass)
  dismissable = skillSystem.activeClass !== '';

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
  drawPanelBg(panel, panelX, panelY, PANEL_W, PANEL_H);
  container.addChild(panel);

  // Close button (only when dismissable — mid-game reclass)
  if (dismissable) {
    const closeBtn = makeCloseButton(panelX + PANEL_W - 40, panelY + 8, () => {
      hideClassSelect();
    });
    container.addChild(closeBtn);
  }

  // Title
  const title = new Text({
    text: 'Choose Your Class',
    style: new TextStyle({
      fill: Colors.accentCyan,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  title.anchor.set(0.5, 0);
  title.position.set(SCREEN_W / 2, panelY + 16);
  container.addChild(title);

  // Subtitle
  const subtitle = new Text({
    text: 'Select a class to begin',
    style: new TextStyle({
      fill: Colors.textMuted,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  subtitle.anchor.set(0.5, 0);
  subtitle.position.set(SCREEN_W / 2, panelY + 52);
  container.addChild(subtitle);

  // Class buttons
  const totalBtnWidth = classes.length * BTN_W + (classes.length - 1) * BTN_GAP;
  const btnStartX = (SCREEN_W - totalBtnWidth) / 2;
  const btnY = panelY + 90;

  for (let i = 0; i < classes.length; i++) {
    const x = btnStartX + i * (BTN_W + BTN_GAP);
    createButton(classes[i], x, btnY, container);
  }

  // Keyboard hint
  const hint = new Text({
    text: dismissable ? 'Press Esc to cancel' : 'Press C anytime to change class',
    style: new TextStyle({
      fill: Colors.textMuted,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  hint.anchor.set(0.5, 1);
  hint.position.set(SCREEN_W / 2, panelY + PANEL_H - 12);
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

/** Called each frame to handle Escape dismissal when panel is open and dismissable. */
export function updateClassSelect(): void {
  if (!container || !dismissable) return;

  const escDown = InputManager.instance.isPressed('Escape');
  if (escDown && !prevEscPressed) {
    hideClassSelect();
  }
  prevEscPressed = escDown;
}

/** Look up class skills by name (used by save/load). */
export function getClassSkillsByName(name: string): typeof rangerSkills | null {
  const found = classes.find((c) => c.name === name);
  return found ? found.skills : null;
}

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
