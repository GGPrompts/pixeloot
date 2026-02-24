import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { saveGame, loadGame, listSaves, deleteSave, exportSave, importSave, AUTOSAVE_NAME } from '../save/SaveManager';
import type { SaveSlot } from '../save/Database';
import {
  Colors, Fonts, FontSize, drawPanelBg, drawPixelBorder, makeCloseButton,
} from './UITheme';

import { SCREEN_W, SCREEN_H } from '../core/constants';

const PANEL_W = 860;
const PANEL_H = 740;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

let container: Container | null = null;
let visible = false;
let prevEscPressed = false;
let busy = false;

// ---- Helpers ----

function makeButton(
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  parent: Container,
  color: number,
  onClick: () => void,
): Container {
  const btn = new Container();
  btn.position.set(x, y);
  btn.eventMode = 'static';
  btn.cursor = 'pointer';

  const bg = new Graphics();
  bg.rect(0, 0, w, h).fill({ color: Colors.slotBg, alpha: 0.95 });
  drawPixelBorder(bg, 0, 0, w, h, { borderWidth: 2, highlight: color, shadow: Colors.borderShadow });
  btn.addChild(bg);

  const text = new Text({
    text: label,
    style: new TextStyle({ fill: color, fontSize: FontSize.sm, fontFamily: Fonts.body, fontWeight: 'bold' }),
  });
  text.anchor.set(0.5, 0.5);
  text.position.set(w / 2, h / 2);
  btn.addChild(text);

  btn.on('pointerover', () => {
    bg.clear();
    bg.rect(0, 0, w, h).fill({ color: 0x1a2a4e, alpha: 0.95 });
    drawPixelBorder(bg, 0, 0, w, h, { borderWidth: 2, highlight: color, shadow: Colors.borderShadow });
  });

  btn.on('pointerout', () => {
    bg.clear();
    bg.rect(0, 0, w, h).fill({ color: Colors.slotBg, alpha: 0.95 });
    drawPixelBorder(bg, 0, 0, w, h, { borderWidth: 2, highlight: color, shadow: Colors.borderShadow });
  });

  btn.on('pointertap', () => {
    if (!busy) onClick();
  });

  parent.addChild(btn);
  return btn;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function displayName(slot: SaveSlot): string {
  if (slot.name === AUTOSAVE_NAME) return 'Autosave';
  return slot.name;
}

// ---- Build Panel ----

async function buildPanel(): Promise<Container> {
  const root = new Container();

  // Overlay to block clicks
  const overlay = new Graphics();
  overlay.rect(0, 0, SCREEN_W, SCREEN_H).fill({ color: 0x000000, alpha: 0.5 });
  overlay.eventMode = 'static';
  root.addChild(overlay);

  // Panel bg
  const panelBg = new Graphics();
  drawPanelBg(panelBg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  root.addChild(panelBg);

  // Title
  const title = new Text({
    text: 'SAVE / LOAD',
    style: new TextStyle({ fill: Colors.accentCyan, fontSize: FontSize.xs, fontFamily: Fonts.display }),
  });
  title.position.set(PANEL_X + 16, PANEL_Y + 16);
  root.addChild(title);

  // Close button
  const closeBtn = makeCloseButton(PANEL_X + PANEL_W - 70, PANEL_Y + 16, () => { hideSaveLoadPanel(); });
  root.addChild(closeBtn);

  // Action buttons row at top
  const btnY = PANEL_Y + 60;
  const btnH = 38;
  const btnGap = 10;

  makeButton('New Save', PANEL_X + 16, btnY, 120, btnH, root, Colors.accentLime, async () => {
    busy = true;
    try {
      const name = prompt('Save name:');
      if (name) {
        await saveGame(name);
        await refreshSaveList(root);
      }
    } catch (e) {
      console.error('Save failed:', e);
    }
    busy = false;
  });

  makeButton('Import', PANEL_X + 16 + 120 + btnGap, btnY, 110, btnH, root, Colors.accentOrange, async () => {
    busy = true;
    try {
      const json = prompt('Paste save JSON:');
      if (json) {
        await importSave(json);
        await refreshSaveList(root);
      }
    } catch (e) {
      console.error('Import failed:', e);
      alert('Import failed: invalid save data');
    }
    busy = false;
  });

  // Save list area
  await renderSaveList(root);

  return root;
}

async function renderSaveList(root: Container): Promise<void> {
  // Remove old list container if exists
  const existing = root.children.find((c) => c.label === 'saveList');
  if (existing) {
    root.removeChild(existing);
    existing.destroy({ children: true });
  }

  const listContainer = new Container();
  listContainer.label = 'saveList';
  root.addChild(listContainer);

  const saves = await listSaves();
  const listY = PANEL_Y + 116;
  const rowH = 64;
  const maxVisible = Math.floor((PANEL_H - 140) / rowH);

  if (saves.length === 0) {
    const empty = new Text({
      text: 'No saves found. Clear a wave to auto-save, or click "New Save".',
      style: new TextStyle({ fill: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.body, wordWrap: true, wordWrapWidth: PANEL_W - 40 }),
    });
    empty.position.set(PANEL_X + 20, listY + 20);
    listContainer.addChild(empty);
    return;
  }

  const visibleSaves = saves.slice(0, maxVisible);

  for (let i = 0; i < visibleSaves.length; i++) {
    const slot = visibleSaves[i];
    const y = listY + i * rowH;

    // Row background
    const rowBg = new Graphics();
    rowBg.rect(PANEL_X + 12, y, PANEL_W - 24, rowH - 4).fill({ color: Colors.slotBg, alpha: 0.7 });
    rowBg.rect(PANEL_X + 12, y, PANEL_W - 24, rowH - 4).stroke({ width: 2, color: Colors.borderMid });
    listContainer.addChild(rowBg);

    // Save info
    const nameText = new Text({
      text: displayName(slot),
      style: new TextStyle({ fill: Colors.textPrimary, fontSize: FontSize.lg, fontFamily: Fonts.body, fontWeight: 'bold' }),
    });
    nameText.position.set(PANEL_X + 20, y + 4);
    listContainer.addChild(nameText);

    const infoText = new Text({
      text: `Lv.${slot.level} ${slot.classType}  |  ${formatTimestamp(slot.timestamp)}`,
      style: new TextStyle({ fill: Colors.textMuted, fontSize: FontSize.sm, fontFamily: Fonts.body }),
    });
    infoText.position.set(PANEL_X + 20, y + 24);
    listContainer.addChild(infoText);

    // Row buttons
    const btnX = PANEL_X + PANEL_W - 340;
    const btnW = 72;
    const btnRowH = 32;
    const btnRowY = y + 8;

    if (slot.id != null) {
      const sid = slot.id;

      makeButton('Load', btnX, btnRowY, btnW, btnRowH, listContainer, Colors.accentCyan, async () => {
        busy = true;
        try {
          await loadGame(sid);
          hideSaveLoadPanel();
        } catch (e) {
          console.error('Load failed:', e);
        }
        busy = false;
      });

      makeButton('Delete', btnX + btnW + 6, btnRowY, btnW, btnRowH, listContainer, Colors.accentRed, async () => {
        busy = true;
        try {
          await deleteSave(sid);
          await refreshSaveList(root);
        } catch (e) {
          console.error('Delete failed:', e);
        }
        busy = false;
      });

      makeButton('Export', btnX + (btnW + 6) * 2, btnRowY, btnW, btnRowH, listContainer, Colors.accentOrange, async () => {
        busy = true;
        try {
          const json = await exportSave(sid);
          // Copy to clipboard if available, otherwise prompt
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(json);
            alert('Save data copied to clipboard!');
          } else {
            prompt('Copy this save data:', json);
          }
        } catch (e) {
          console.error('Export failed:', e);
        }
        busy = false;
      });

      makeButton('Save', btnX + (btnW + 6) * 3, btnRowY, btnW, btnRowH, listContainer, Colors.accentLime, async () => {
        busy = true;
        try {
          await saveGame(slot.name);
          await refreshSaveList(root);
        } catch (e) {
          console.error('Save failed:', e);
        }
        busy = false;
      });
    }
  }
}

async function refreshSaveList(root: Container): Promise<void> {
  await renderSaveList(root);
}

// ---- Public API ----

export function showSaveLoadPanel(): void {
  if (visible) return;
  visible = true;

  buildPanel().then((panel) => {
    container = panel;
    game.hudLayer.addChild(container);
  });
}

export function hideSaveLoadPanel(): void {
  if (!visible) return;
  visible = false;

  if (container) {
    container.removeFromParent();
    container.destroy({ children: true });
    container = null;
  }
}

export function toggleSaveLoadPanel(): void {
  if (visible) {
    hideSaveLoadPanel();
  } else {
    showSaveLoadPanel();
  }
}

export function isSaveLoadPanelOpen(): boolean {
  return visible;
}

/** Call every frame to handle Escape key toggle. */
export function updateSaveLoadPanel(): void {
  const input = InputManager.instance;
  const escDown = input.isPressed('Escape');

  if (escDown && !prevEscPressed) {
    toggleSaveLoadPanel();
  }

  prevEscPressed = escDown;
}
