import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { skillSystem, type SkillDef, type SkillSlot } from '../core/SkillSystem';
import {
  Colors, Fonts, FontSize, drawPanelBg, drawSlotBg, makeCloseButton,
} from './UITheme';
import { SCREEN_W, SCREEN_H } from '../core/constants';

const PANEL_W = 540;
const PANEL_H = 380;
const ACTIVE_SLOT_SIZE = 72;
const SKILL_SLOT_W = 110;
const SKILL_SLOT_H = 56;

let container: Container | null = null;
let selectedSlot: 'rmb' | 'e' | null = null;

export function isSkillAssignOpen(): boolean {
  return container !== null;
}

export function toggleSkillAssignPanel(): void {
  if (container) {
    hideSkillAssignPanel();
  } else {
    showSkillAssignPanel();
  }
}

function hideSkillAssignPanel(): void {
  if (container) {
    container.removeFromParent();
    container.destroy({ children: true });
    container = null;
    selectedSlot = null;
  }
}

function showSkillAssignPanel(): void {
  if (container) return;
  selectedSlot = null;

  rebuildPanel();
}

function rebuildPanel(): void {
  if (container) {
    container.removeFromParent();
    container.destroy({ children: true });
  }

  container = new Container();

  // Dim overlay
  const overlay = new Graphics();
  overlay.rect(0, 0, SCREEN_W, SCREEN_H).fill({ color: 0x000000, alpha: 0.5 });
  overlay.eventMode = 'static';
  container.addChild(overlay);

  const px = (SCREEN_W - PANEL_W) / 2;
  const py = (SCREEN_H - PANEL_H) / 2;

  // Panel background
  const bg = new Graphics();
  drawPanelBg(bg, px, py, PANEL_W, PANEL_H);
  container.addChild(bg);

  // Close button
  const closeBtn = makeCloseButton(px + PANEL_W - 40, py + 8, hideSkillAssignPanel);
  container.addChild(closeBtn);

  // Title
  const title = new Text({
    text: 'Skill Assignment [K]',
    style: new TextStyle({
      fill: Colors.accentCyan,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  title.anchor.set(0.5, 0);
  title.position.set(SCREEN_W / 2, py + 12);
  container.addChild(title);

  // Active slots row
  const slotLabels: { slot: SkillSlot; label: string; locked: boolean }[] = [
    { slot: 'lmb', label: 'LMB', locked: true },
    { slot: 'rmb', label: 'RMB', locked: false },
    { slot: 'space', label: 'SPC', locked: true },
    { slot: 'e', label: 'E', locked: false },
  ];

  const activeRowY = py + 48;
  const totalActiveW = 4 * ACTIVE_SLOT_SIZE + 3 * 12;
  const activeStartX = (SCREEN_W - totalActiveW) / 2;

  for (let i = 0; i < slotLabels.length; i++) {
    const { slot, label, locked } = slotLabels[i];
    const sx = activeStartX + i * (ACTIVE_SLOT_SIZE + 12);
    const sy = activeRowY;

    const slotGfx = new Graphics();
    const skillState = skillSystem.getSlot(slot);
    const isSelected = selectedSlot === slot;
    const borderColor = isSelected ? Colors.accentGold : locked ? Colors.borderMid : Colors.accentCyan;

    drawSlotBg(slotGfx, sx, sy, ACTIVE_SLOT_SIZE, borderColor, ACTIVE_SLOT_SIZE);
    container.addChild(slotGfx);

    // Keybind label
    const keybindText = new Text({
      text: label,
      style: new TextStyle({
        fill: locked ? Colors.textMuted : Colors.textSecondary,
        fontSize: 8,
        fontFamily: Fonts.display,
      }),
    });
    keybindText.position.set(sx + 4, sy + 2);
    container.addChild(keybindText);

    // Skill name in slot
    const nameText = new Text({
      text: skillState?.def.name ?? '--',
      style: new TextStyle({
        fill: skillState ? Colors.textPrimary : Colors.textMuted,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: ACTIVE_SLOT_SIZE - 8,
      }),
    });
    nameText.anchor.set(0.5, 0.5);
    nameText.position.set(sx + ACTIVE_SLOT_SIZE / 2, sy + ACTIVE_SLOT_SIZE / 2 + 4);
    container.addChild(nameText);

    if (locked) {
      // Locked indicator
      const lockText = new Text({
        text: 'FIXED',
        style: new TextStyle({
          fill: Colors.textMuted,
          fontSize: 8,
          fontFamily: Fonts.display,
        }),
      });
      lockText.anchor.set(1, 1);
      lockText.position.set(sx + ACTIVE_SLOT_SIZE - 4, sy + ACTIVE_SLOT_SIZE - 2);
      container.addChild(lockText);
    } else {
      // Clickable area for assignable slots
      const hitArea = new Graphics();
      hitArea.rect(sx, sy, ACTIVE_SLOT_SIZE, ACTIVE_SLOT_SIZE).fill({ color: 0x000000, alpha: 0.001 });
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';
      hitArea.on('pointertap', () => {
        selectedSlot = (slot as 'rmb' | 'e');
        rebuildPanel();
      });
      container.addChild(hitArea);
    }
  }

  // Divider
  const divY = activeRowY + ACTIVE_SLOT_SIZE + 16;
  const divGfx = new Graphics();
  divGfx.moveTo(px + 20, divY).lineTo(px + PANEL_W - 20, divY).stroke({ width: 2, color: Colors.divider });
  container.addChild(divGfx);

  // Subtitle
  const subtitle = new Text({
    text: selectedSlot ? `Select a skill for ${selectedSlot === 'rmb' ? 'RMB' : 'E'} slot:` : 'Click RMB or E slot above to reassign',
    style: new TextStyle({
      fill: selectedSlot ? Colors.accentGold : Colors.textMuted,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  subtitle.anchor.set(0.5, 0);
  subtitle.position.set(SCREEN_W / 2, divY + 6);
  container.addChild(subtitle);

  // All 6 class skills grid
  const allSkills = skillSystem.allClassSkills;
  const gridY = divY + 32;
  const cols = 3;
  const gridGap = 8;
  const totalGridW = cols * SKILL_SLOT_W + (cols - 1) * gridGap;
  const gridStartX = (SCREEN_W - totalGridW) / 2;

  const rmbSkill = skillSystem.getSlot('rmb');
  const eSkill = skillSystem.getSlot('e');

  for (let i = 0; i < allSkills.length; i++) {
    const skill = allSkills[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sx = gridStartX + col * (SKILL_SLOT_W + gridGap);
    const sy = gridY + row * (SKILL_SLOT_H + gridGap);

    // Determine assignment status
    let assignedTo = '';
    if (rmbSkill?.def.name === skill.name) assignedTo = 'RMB';
    if (eSkill?.def.name === skill.name) assignedTo = 'E';

    const isAssignable = skill.slotType === 'assignable';
    const canClick = selectedSlot !== null && isAssignable;

    const slotGfx = new Graphics();
    const borderColor = assignedTo ? Colors.accentGold : isAssignable ? Colors.borderHighlight : Colors.borderMid;
    slotGfx.rect(sx, sy, SKILL_SLOT_W, SKILL_SLOT_H).fill({ color: Colors.slotBg, alpha: 0.85 });
    drawSlotBg(slotGfx, sx, sy, SKILL_SLOT_W, borderColor, SKILL_SLOT_H);
    container.addChild(slotGfx);

    // Skill name
    const nameText = new Text({
      text: skill.name,
      style: new TextStyle({
        fill: isAssignable ? Colors.textPrimary : Colors.textMuted,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(sx + SKILL_SLOT_W / 2, sy + 4);
    container.addChild(nameText);

    // Cooldown + type info
    const info = `${skill.cooldown}s  ${skill.slotType}`;
    const infoText = new Text({
      text: info,
      style: new TextStyle({
        fill: Colors.textMuted,
        fontSize: FontSize.sm - 4,
        fontFamily: Fonts.body,
      }),
    });
    infoText.anchor.set(0.5, 1);
    infoText.position.set(sx + SKILL_SLOT_W / 2, sy + SKILL_SLOT_H - 4);
    container.addChild(infoText);

    // Assignment badge
    if (assignedTo) {
      const badge = new Text({
        text: assignedTo,
        style: new TextStyle({
          fill: Colors.accentGold,
          fontSize: 8,
          fontFamily: Fonts.display,
        }),
      });
      badge.anchor.set(1, 0);
      badge.position.set(sx + SKILL_SLOT_W - 4, sy + 2);
      container.addChild(badge);
    }

    // Click handler
    if (canClick) {
      const hitArea = new Graphics();
      hitArea.rect(sx, sy, SKILL_SLOT_W, SKILL_SLOT_H).fill({ color: 0x000000, alpha: 0.001 });
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';
      hitArea.on('pointertap', () => {
        if (selectedSlot) {
          skillSystem.assignSkill(selectedSlot, skill);
          selectedSlot = null;
          rebuildPanel();
        }
      });
      container.addChild(hitArea);
    }
  }

  game.hudLayer.addChild(container);
}

export function updateSkillAssignPanel(): void {
  // Panel is event-driven, no per-frame updates needed
}
