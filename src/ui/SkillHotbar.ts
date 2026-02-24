import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { skillSystem } from '../core/SkillSystem';
import { Colors, Fonts, FontSize, drawPixelBorder } from './UITheme';

const SLOT_SIZE = 80;
const SLOT_GAP = 8;
const SLOT_COUNT = 6;

import { SCREEN_W, SCREEN_H } from '../core/constants';

let container: Container;
let slots: SlotUI[] = [];
let initialized = false;
let pulseTime = 0;

interface SlotUI {
  bg: Graphics;
  nameText: Text;
  keybindText: Text;
  cooldownOverlay: Graphics;
  cooldownText: Text;
  glowBorder: Graphics;
}

function createSlot(index: number): SlotUI {
  const slotContainer = new Container();
  const totalWidth = SLOT_COUNT * SLOT_SIZE + (SLOT_COUNT - 1) * SLOT_GAP;
  const startX = (SCREEN_W - totalWidth) / 2;
  const x = startX + index * (SLOT_SIZE + SLOT_GAP);
  const y = SCREEN_H - SLOT_SIZE - 12;

  slotContainer.position.set(x, y);

  // Background panel with pixel border
  const bg = new Graphics();
  bg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: Colors.panelBg, alpha: 0.9 });
  drawPixelBorder(bg, 0, 0, SLOT_SIZE, SLOT_SIZE, { borderWidth: 2, highlight: Colors.accentCyan, shadow: Colors.borderShadow });
  slotContainer.addChild(bg);

  // Glow border (shown when ready, animated)
  const glowBorder = new Graphics();
  glowBorder.rect(-1, -1, SLOT_SIZE + 2, SLOT_SIZE + 2).stroke({ color: Colors.accentCyan, width: 2, alpha: 0.5 });
  glowBorder.alpha = 0;
  slotContainer.addChild(glowBorder);

  // Skill name text
  const nameText = new Text({
    text: '',
    style: new TextStyle({
      fill: Colors.textPrimary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: SLOT_SIZE - 4,
    }),
  });
  nameText.anchor.set(0.5, 0);
  nameText.position.set(SLOT_SIZE / 2, 3);
  slotContainer.addChild(nameText);

  // Keybind label in bottom-right corner
  const keybindText = new Text({
    text: `${index + 1}`,
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: 8,
      fontFamily: Fonts.display,
      fontWeight: 'bold',
    }),
  });
  keybindText.anchor.set(1, 1);
  keybindText.position.set(SLOT_SIZE - 3, SLOT_SIZE - 2);
  slotContainer.addChild(keybindText);

  // Cooldown overlay (clock-sweep effect)
  const cooldownOverlay = new Graphics();
  slotContainer.addChild(cooldownOverlay);

  // Cooldown remaining text (center)
  const cooldownText = new Text({
    text: '',
    style: new TextStyle({
      fill: Colors.textPrimary,
      fontSize: FontSize.lg,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
    }),
  });
  cooldownText.anchor.set(0.5, 0.5);
  cooldownText.position.set(SLOT_SIZE / 2, SLOT_SIZE / 2);
  cooldownText.visible = false;
  slotContainer.addChild(cooldownText);

  container.addChild(slotContainer);

  return { bg, nameText, keybindText, cooldownOverlay, cooldownText, glowBorder };
}

/**
 * Draw a clockwise sweep overlay showing cooldown progress.
 * fraction: 0 = fully on cooldown (full overlay), 1 = ready (no overlay)
 */
function drawCooldownSweep(g: Graphics, fraction: number): void {
  g.clear();
  if (fraction >= 1) return;

  const cx = SLOT_SIZE / 2;
  const cy = SLOT_SIZE / 2;
  const r = SLOT_SIZE * 0.8;

  const sweepAngle = (1 - fraction) * Math.PI * 2;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + sweepAngle;

  g.moveTo(cx, cy);
  g.arc(cx, cy, r, startAngle, endAngle);
  g.lineTo(cx, cy);
  g.fill({ color: 0x000000, alpha: 0.6 });
}

export function initHotbar(): void {
  if (initialized) return;

  container = new Container();
  game.hudLayer.addChild(container);

  for (let i = 0; i < SLOT_COUNT; i++) {
    slots.push(createSlot(i));
  }

  initialized = true;
}

export function updateHotbar(): void {
  if (!initialized) return;

  const skills = skillSystem.getSkills();
  pulseTime += 0.016;

  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = slots[i];
    const skill = skills[i];

    if (!skill) {
      slot.nameText.text = '';
      slot.cooldownText.visible = false;
      slot.cooldownOverlay.clear();
      slot.glowBorder.alpha = 0;
      continue;
    }

    slot.nameText.text = skill.def.name;

    if (skill.cooldownRemaining > 0) {
      const fraction = 1 - skill.cooldownRemaining / skill.def.cooldown;
      drawCooldownSweep(slot.cooldownOverlay, fraction);

      slot.cooldownText.visible = true;
      slot.cooldownText.text = skill.cooldownRemaining.toFixed(1);

      slot.glowBorder.alpha = 0;
      slot.nameText.alpha = 0.5;
      slot.keybindText.alpha = 0.5;
    } else {
      slot.cooldownOverlay.clear();
      slot.cooldownText.visible = false;

      const pulse = 0.3 + 0.3 * Math.sin(pulseTime * 3);
      slot.glowBorder.alpha = pulse;
      slot.nameText.alpha = 1;
      slot.keybindText.alpha = 1;
    }
  }
}
