import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { saveGame, loadGame, listSaves, deleteSave, exportSave, importSave, AUTOSAVE_NAME } from '../save/SaveManager';
import type { SaveSlot } from '../save/Database';

import { SCREEN_W, SCREEN_H } from '../core/constants';

const PANEL_W = 520;
const PANEL_H = 440;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

const BG_COLOR = 0x111122;
const BORDER_COLOR = 0x00ffff;
const BTN_COLOR = 0x1a1a33;
const BTN_HOVER = 0x2a2a44;

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
  bg.roundRect(0, 0, w, h, 4).fill({ color: BTN_COLOR, alpha: 0.95 });
  bg.roundRect(0, 0, w, h, 4).stroke({ color, width: 1 });
  btn.addChild(bg);

  const text = new Text({
    text: label,
    style: new TextStyle({ fill: color, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }),
  });
  text.anchor.set(0.5, 0.5);
  text.position.set(w / 2, h / 2);
  btn.addChild(text);

  btn.on('pointerover', () => {
    bg.clear();
    bg.roundRect(0, 0, w, h, 4).fill({ color: BTN_HOVER, alpha: 0.95 });
    bg.roundRect(0, 0, w, h, 4).stroke({ color, width: 2 });
  });

  btn.on('pointerout', () => {
    bg.clear();
    bg.roundRect(0, 0, w, h, 4).fill({ color: BTN_COLOR, alpha: 0.95 });
    bg.roundRect(0, 0, w, h, 4).stroke({ color, width: 1 });
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
  panelBg.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8).fill({ color: BG_COLOR, alpha: 0.95 });
  panelBg.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8).stroke({ color: BORDER_COLOR, width: 2 });
  root.addChild(panelBg);

  // Title
  const title = new Text({
    text: 'SAVE / LOAD',
    style: new TextStyle({ fill: BORDER_COLOR, fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold' }),
  });
  title.anchor.set(0.5, 0);
  title.position.set(SCREEN_W / 2, PANEL_Y + 14);
  root.addChild(title);

  // Close button
  const hint = new Text({
    text: '[X] close',
    style: new TextStyle({ fill: 0x555566, fontSize: 10, fontFamily: 'monospace' }),
  });
  hint.position.set(PANEL_X + PANEL_W - 80, PANEL_Y + 18);
  hint.eventMode = 'static';
  hint.cursor = 'pointer';
  hint.on('pointerover', () => { hint.style.fill = 0xff4444; });
  hint.on('pointerout', () => { hint.style.fill = 0x555566; });
  hint.on('pointertap', () => { hideSaveLoadPanel(); });
  root.addChild(hint);

  // Action buttons row at top
  const btnY = PANEL_Y + 48;
  const btnH = 28;
  const btnGap = 8;

  makeButton('New Save', PANEL_X + 16, btnY, 80, btnH, root, 0x44ff44, async () => {
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

  makeButton('Import', PANEL_X + 16 + 80 + btnGap, btnY, 72, btnH, root, 0xffaa44, async () => {
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
  const listY = PANEL_Y + 90;
  const rowH = 44;
  const maxVisible = Math.floor((PANEL_H - 110) / rowH);

  if (saves.length === 0) {
    const empty = new Text({
      text: 'No saves found. Clear a wave to auto-save, or click "New Save".',
      style: new TextStyle({ fill: 0x666688, fontSize: 12, fontFamily: 'monospace', wordWrap: true, wordWrapWidth: PANEL_W - 40 }),
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
    rowBg.rect(PANEL_X + 12, y, PANEL_W - 24, rowH - 4).fill({ color: 0x0a0a18, alpha: 0.7 });
    rowBg.rect(PANEL_X + 12, y, PANEL_W - 24, rowH - 4).stroke({ width: 1, color: 0x333355 });
    listContainer.addChild(rowBg);

    // Save info
    const nameText = new Text({
      text: displayName(slot),
      style: new TextStyle({ fill: 0xddddee, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }),
    });
    nameText.position.set(PANEL_X + 20, y + 4);
    listContainer.addChild(nameText);

    const infoText = new Text({
      text: `Lv.${slot.level} ${slot.classType}  |  ${formatTimestamp(slot.timestamp)}`,
      style: new TextStyle({ fill: 0x888899, fontSize: 10, fontFamily: 'monospace' }),
    });
    infoText.position.set(PANEL_X + 20, y + 22);
    listContainer.addChild(infoText);

    // Row buttons
    const btnX = PANEL_X + PANEL_W - 260;
    const btnW = 56;
    const btnRowH = 24;
    const btnRowY = y + 8;

    if (slot.id != null) {
      const sid = slot.id;

      makeButton('Load', btnX, btnRowY, btnW, btnRowH, listContainer, 0x44aaff, async () => {
        busy = true;
        try {
          await loadGame(sid);
          hideSaveLoadPanel();
        } catch (e) {
          console.error('Load failed:', e);
        }
        busy = false;
      });

      makeButton('Delete', btnX + btnW + 6, btnRowY, btnW, btnRowH, listContainer, 0xff4444, async () => {
        busy = true;
        try {
          await deleteSave(sid);
          await refreshSaveList(root);
        } catch (e) {
          console.error('Delete failed:', e);
        }
        busy = false;
      });

      makeButton('Export', btnX + (btnW + 6) * 2, btnRowY, btnW, btnRowH, listContainer, 0xffaa44, async () => {
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

      makeButton('Save', btnX + (btnW + 6) * 3, btnRowY, btnW, btnRowH, listContainer, 0x44ff44, async () => {
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
