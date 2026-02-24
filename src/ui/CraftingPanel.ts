import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { inventory } from '../core/Inventory';
import { materials, MATERIAL_NAMES, MATERIAL_COLORS, MaterialType } from '../loot/Materials';
import { salvageItem } from '../loot/Salvage';
import { RECIPES, craft, Recipe } from '../loot/Crafting';
import { BaseItem, Rarity } from '../loot/ItemTypes';
import { GEM_BONUSES, GEM_COLORS, Gem } from '../loot/Gems';
import { markStatsDirty } from '../core/ComputedStats';

import { SCREEN_W, SCREEN_H } from '../core/constants';

// Layout constants
const PANEL_W = 720;
const PANEL_H = 520;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

// Rarity colors
const RARITY_COLORS: Record<Rarity, number> = {
  [Rarity.Normal]: 0xcccccc,
  [Rarity.Magic]: 0x4488ff,
  [Rarity.Rare]: 0xffff00,
  [Rarity.Unique]: 0xff8800,
};

const RARITY_NAMES: Record<Rarity, string> = {
  [Rarity.Normal]: 'Normal',
  [Rarity.Magic]: 'Magic',
  [Rarity.Rare]: 'Rare',
  [Rarity.Unique]: 'Unique',
};

// Section positions (relative to PANEL_X, PANEL_Y)
const SECTION_LEFT_X = 16;       // salvage section
const SECTION_RIGHT_X = 370;     // crafting section
const MATERIALS_Y = 42;
const SALVAGE_Y = 90;
const CRAFT_Y = 90;
const GEM_Y = 340;

const SLOT_SIZE = 36;
const SLOT_GAP = 4;
const SLOTS_PER_ROW = 4;

let container: Container | null = null;
let visible = false;
let prevKPressed = false;
let prevEscPressed = false;

// State for crafting workflow
let selectedRecipe: Recipe | null = null;
let selectedCraftTargetIdx: number | null = null;
let selectedGem: Gem | null = null;
let selectedGemTargetIdx: number | null = null;
let feedbackText: Text | null = null;
let feedbackTimer = 0;

function showFeedback(message: string, color: number): void {
  if (feedbackText) {
    feedbackText.text = message;
    feedbackText.style.fill = color;
  }
  feedbackTimer = 2;
}

function createPanel(): Container {
  const root = new Container();
  root.visible = false;
  return root;
}

function rebuildPanel(): void {
  if (!container) return;

  // Clear everything
  container.removeChildren();

  // Background
  const bg = new Graphics();
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).fill({ color: 0x111122, alpha: 0.95 });
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).stroke({ width: 2, color: 0x6666aa });
  container.addChild(bg);

  // Title
  const title = new Text({
    text: 'CRAFTING',
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 18,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  title.position.set(PANEL_X + 16, PANEL_Y + 12);
  container.addChild(title);

  // Close button
  const hint = new Text({
    text: '[X] close',
    style: new TextStyle({ fill: 0x666688, fontSize: 11, fontFamily: 'monospace' }),
  });
  hint.position.set(PANEL_X + PANEL_W - 80, PANEL_Y + 16);
  hint.eventMode = 'static';
  hint.cursor = 'pointer';
  hint.on('pointerover', () => { hint.style.fill = 0xff4444; });
  hint.on('pointerout', () => { hint.style.fill = 0x666688; });
  hint.on('pointertap', () => {
    visible = false;
    if (container) container.visible = false;
  });
  container.addChild(hint);

  // Feedback text
  feedbackText = new Text({
    text: '',
    style: new TextStyle({ fill: 0x66ff66, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }),
  });
  feedbackText.position.set(PANEL_X + PANEL_W / 2 - 100, PANEL_Y + PANEL_H - 22);
  container.addChild(feedbackText);

  // --- Materials display ---
  buildMaterialsDisplay();

  // --- Left side: Salvage ---
  buildSalvageSection();

  // --- Right side: Crafting ---
  buildCraftingSection();

  // --- Bottom: Gem socketing ---
  buildGemSection();
}

function buildMaterialsDisplay(): void {
  if (!container) return;
  const matLabel = new Text({
    text: 'Materials:',
    style: new TextStyle({ fill: 0xaaaacc, fontSize: 11, fontFamily: 'monospace' }),
  });
  matLabel.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + MATERIALS_Y);
  container.addChild(matLabel);

  const matTypes: MaterialType[] = ['scrap', 'essence', 'crystal', 'prism'];
  const inv = materials.inventory;
  let offsetX = 80;
  for (const mat of matTypes) {
    const text = new Text({
      text: `${MATERIAL_NAMES[mat]}: ${inv[mat]}`,
      style: new TextStyle({ fill: MATERIAL_COLORS[mat], fontSize: 11, fontFamily: 'monospace' }),
    });
    text.position.set(PANEL_X + SECTION_LEFT_X + offsetX, PANEL_Y + MATERIALS_Y);
    container.addChild(text);
    offsetX += 120;
  }

  // Gem count
  const gemCountText = new Text({
    text: `Gems: ${inventory.gems.length}`,
    style: new TextStyle({ fill: 0xeeeeff, fontSize: 11, fontFamily: 'monospace' }),
  });
  gemCountText.position.set(PANEL_X + SECTION_LEFT_X + offsetX, PANEL_Y + MATERIALS_Y);
  container.addChild(gemCountText);
}

function buildSalvageSection(): void {
  if (!container) return;

  const sectionLabel = new Text({
    text: 'SALVAGE (click to salvage)',
    style: new TextStyle({ fill: 0xff6666, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' }),
  });
  sectionLabel.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + SALVAGE_Y - 4);
  container.addChild(sectionLabel);

  // Render backpack items as clickable salvage targets
  const backpack = inventory.backpack;
  for (let i = 0; i < backpack.length; i++) {
    const col = i % SLOTS_PER_ROW;
    const row = Math.floor(i / SLOTS_PER_ROW);
    const sx = PANEL_X + SECTION_LEFT_X + col * (SLOT_SIZE + SLOT_GAP);
    const sy = PANEL_Y + SALVAGE_Y + 20 + row * (SLOT_SIZE + SLOT_GAP);

    const slotBg = new Graphics();
    const item = backpack[i];

    if (item) {
      const color = RARITY_COLORS[item.rarity];
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x1a0a0a, alpha: 0.8 });
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 2, color });

      const nameText = new Text({
        text: abbreviate(item.name, 5),
        style: new TextStyle({ fill: color, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' }),
      });
      nameText.position.set(2, 2);
      slotBg.addChild(nameText);

      const levelText = new Text({
        text: `L${item.level}`,
        style: new TextStyle({ fill: 0x888899, fontSize: 7, fontFamily: 'monospace' }),
      });
      levelText.position.set(2, 24);
      slotBg.addChild(levelText);

      // Socket indicator
      if (item.socket) {
        const socketText = new Text({
          text: item.socket.gem ? 'G' : 'O',
          style: new TextStyle({
            fill: item.socket.gem ? GEM_COLORS[item.socket.gem.type] : 0x444466,
            fontSize: 8,
            fontFamily: 'monospace',
          }),
        });
        socketText.position.set(28, 2);
        slotBg.addChild(socketText);
      }

      // Click to salvage
      slotBg.eventMode = 'static';
      slotBg.cursor = 'pointer';
      const idx = i;
      slotBg.on('pointertap', () => {
        const itm = inventory.backpack[idx];
        if (!itm) return;
        const result = salvageItem(itm);
        inventory.backpack[idx] = null;
        showFeedback(`Salvaged: +${result.amount} ${MATERIAL_NAMES[result.material]}`, MATERIAL_COLORS[result.material]);
        rebuildPanel();
      });
    } else {
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.5 });
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 1, color: 0x222233 });
    }

    slotBg.position.set(sx, sy);
    container.addChild(slotBg);
  }
}

function buildCraftingSection(): void {
  if (!container) return;

  const sectionLabel = new Text({
    text: 'CRAFT',
    style: new TextStyle({ fill: 0x66ccff, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' }),
  });
  sectionLabel.position.set(PANEL_X + SECTION_RIGHT_X, PANEL_Y + CRAFT_Y - 4);
  container.addChild(sectionLabel);

  // Recipe buttons
  for (let r = 0; r < RECIPES.length; r++) {
    const recipe = RECIPES[r];
    const by = PANEL_Y + CRAFT_Y + 20 + r * 44;
    const bx = PANEL_X + SECTION_RIGHT_X;

    const isSelected = selectedRecipe === recipe;
    const canAfford = materials.has(recipe.cost);

    const btn = new Graphics();
    btn.rect(0, 0, 330, 38).fill({ color: isSelected ? 0x222244 : 0x0e0e1a, alpha: 0.9 });
    btn.rect(0, 0, 330, 38).stroke({ width: isSelected ? 2 : 1, color: canAfford ? 0x6666aa : 0x333344 });
    btn.position.set(bx, by);
    btn.eventMode = 'static';
    btn.cursor = canAfford ? 'pointer' : 'default';

    const nameText = new Text({
      text: recipe.name,
      style: new TextStyle({
        fill: canAfford ? 0xeeeeff : 0x555566,
        fontSize: 12,
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }),
    });
    nameText.position.set(8, 4);
    btn.addChild(nameText);

    const descText = new Text({
      text: recipe.description,
      style: new TextStyle({ fill: canAfford ? 0x999999 : 0x444444, fontSize: 9, fontFamily: 'monospace' }),
    });
    descText.position.set(8, 22);
    btn.addChild(descText);

    btn.on('pointertap', () => {
      if (!canAfford) {
        showFeedback('Not enough materials!', 0xff4444);
        return;
      }
      if (selectedRecipe === recipe) {
        selectedRecipe = null;
        selectedCraftTargetIdx = null;
      } else {
        selectedRecipe = recipe;
        selectedCraftTargetIdx = null;
      }
      rebuildPanel();
    });

    container.addChild(btn);
  }

  // If a recipe is selected, show target item selection
  if (selectedRecipe) {
    const targetLabel = new Text({
      text: 'Select target item:',
      style: new TextStyle({ fill: 0xaaaacc, fontSize: 11, fontFamily: 'monospace' }),
    });
    targetLabel.position.set(PANEL_X + SECTION_RIGHT_X, PANEL_Y + CRAFT_Y + 160);
    container.addChild(targetLabel);

    const backpack = inventory.backpack;
    let col = 0;
    let row = 0;
    for (let i = 0; i < backpack.length; i++) {
      const item = backpack[i];
      if (!item) continue;
      if (!selectedRecipe.canApply(item)) continue;

      const sx = PANEL_X + SECTION_RIGHT_X + col * (SLOT_SIZE + SLOT_GAP);
      const sy = PANEL_Y + CRAFT_Y + 178 + row * (SLOT_SIZE + SLOT_GAP);

      const isTarget = selectedCraftTargetIdx === i;
      const color = RARITY_COLORS[item.rarity];

      const slotBg = new Graphics();
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: isTarget ? 0x222244 : 0x0a0a15, alpha: 0.8 });
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: isTarget ? 2 : 1, color });

      const nameText = new Text({
        text: abbreviate(item.name, 5),
        style: new TextStyle({ fill: color, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' }),
      });
      nameText.position.set(2, 2);
      slotBg.addChild(nameText);

      const lvText = new Text({
        text: `L${item.level}`,
        style: new TextStyle({ fill: 0x888899, fontSize: 7, fontFamily: 'monospace' }),
      });
      lvText.position.set(2, 24);
      slotBg.addChild(lvText);

      slotBg.eventMode = 'static';
      slotBg.cursor = 'pointer';
      const idx = i;
      slotBg.on('pointertap', () => {
        selectedCraftTargetIdx = idx;
        rebuildPanel();
      });

      slotBg.position.set(sx, sy);
      container.addChild(slotBg);

      col++;
      if (col >= 8) {
        col = 0;
        row++;
      }
    }

    // Craft button
    if (selectedCraftTargetIdx !== null) {
      const craftBtn = new Graphics();
      const cbx = PANEL_X + SECTION_RIGHT_X + 240;
      const cby = PANEL_Y + CRAFT_Y + 160;
      craftBtn.rect(0, 0, 80, 28).fill({ color: 0x225522, alpha: 0.9 });
      craftBtn.rect(0, 0, 80, 28).stroke({ width: 2, color: 0x44aa44 });
      craftBtn.position.set(cbx, cby);
      craftBtn.eventMode = 'static';
      craftBtn.cursor = 'pointer';

      const craftLabel = new Text({
        text: 'CRAFT',
        style: new TextStyle({ fill: 0x66ff66, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' }),
      });
      craftLabel.position.set(14, 6);
      craftBtn.addChild(craftLabel);

      craftBtn.on('pointertap', () => {
        if (!selectedRecipe || selectedCraftTargetIdx === null) return;
        const item = inventory.backpack[selectedCraftTargetIdx];
        if (!item) return;

        const result = craft(selectedRecipe, item);
        if (result) {
          inventory.backpack[selectedCraftTargetIdx] = result;
          markStatsDirty();
          showFeedback(`Crafted: ${selectedRecipe.name}!`, 0x66ff66);
          selectedRecipe = null;
          selectedCraftTargetIdx = null;
        } else {
          showFeedback('Craft failed - check materials/requirements', 0xff4444);
        }
        rebuildPanel();
      });

      container.addChild(craftBtn);
    }
  }
}

function buildGemSection(): void {
  if (!container) return;

  const sectionLabel = new Text({
    text: 'GEM SOCKETING',
    style: new TextStyle({ fill: 0xcc66ff, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' }),
  });
  sectionLabel.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + GEM_Y);
  container.addChild(sectionLabel);

  if (inventory.gems.length === 0) {
    const noGems = new Text({
      text: 'No gems available',
      style: new TextStyle({ fill: 0x555566, fontSize: 11, fontFamily: 'monospace' }),
    });
    noGems.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + GEM_Y + 20);
    container.addChild(noGems);
  } else {
    // Gem selection
    const gemLabel = new Text({
      text: 'Select gem:',
      style: new TextStyle({ fill: 0xaaaacc, fontSize: 10, fontFamily: 'monospace' }),
    });
    gemLabel.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + GEM_Y + 18);
    container.addChild(gemLabel);

    for (let g = 0; g < inventory.gems.length; g++) {
      const gem = inventory.gems[g];
      const gx = PANEL_X + SECTION_LEFT_X + g * (SLOT_SIZE + SLOT_GAP);
      const gy = PANEL_Y + GEM_Y + 34;

      const isSelected = selectedGem?.id === gem.id;
      const color = GEM_COLORS[gem.type];
      const bonus = GEM_BONUSES[gem.type];

      const slotBg = new Graphics();
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: isSelected ? 0x221133 : 0x0a0a15, alpha: 0.8 });
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: isSelected ? 2 : 1, color });

      const nameText = new Text({
        text: gem.name.slice(0, 4),
        style: new TextStyle({ fill: color, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' }),
      });
      nameText.position.set(2, 4);
      slotBg.addChild(nameText);

      const bonusText = new Text({
        text: bonus.label.slice(0, 6),
        style: new TextStyle({ fill: 0x888899, fontSize: 7, fontFamily: 'monospace' }),
      });
      bonusText.position.set(2, 24);
      slotBg.addChild(bonusText);

      slotBg.eventMode = 'static';
      slotBg.cursor = 'pointer';
      slotBg.on('pointertap', () => {
        if (selectedGem?.id === gem.id) {
          selectedGem = null;
          selectedGemTargetIdx = null;
        } else {
          selectedGem = gem;
          selectedGemTargetIdx = null;
        }
        rebuildPanel();
      });

      slotBg.position.set(gx, gy);
      container.addChild(slotBg);
    }
  }

  // Socketed item selection (only show items with empty sockets)
  if (selectedGem) {
    const targetLabel = new Text({
      text: 'Select socketed item:',
      style: new TextStyle({ fill: 0xaaaacc, fontSize: 10, fontFamily: 'monospace' }),
    });
    targetLabel.position.set(PANEL_X + SECTION_RIGHT_X, PANEL_Y + GEM_Y + 18);
    container.addChild(targetLabel);

    let col = 0;
    for (let i = 0; i < inventory.backpack.length; i++) {
      const item = inventory.backpack[i];
      if (!item || !item.socket || item.socket.gem) continue;

      const sx = PANEL_X + SECTION_RIGHT_X + col * (SLOT_SIZE + SLOT_GAP);
      const sy = PANEL_Y + GEM_Y + 34;
      const isTarget = selectedGemTargetIdx === i;
      const color = RARITY_COLORS[item.rarity];

      const slotBg = new Graphics();
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: isTarget ? 0x221133 : 0x0a0a15, alpha: 0.8 });
      slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: isTarget ? 2 : 1, color });

      const nameText = new Text({
        text: abbreviate(item.name, 5),
        style: new TextStyle({ fill: color, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' }),
      });
      nameText.position.set(2, 2);
      slotBg.addChild(nameText);

      const socketText = new Text({
        text: 'O',
        style: new TextStyle({ fill: 0x666688, fontSize: 10, fontFamily: 'monospace' }),
      });
      socketText.position.set(28, 22);
      slotBg.addChild(socketText);

      slotBg.eventMode = 'static';
      slotBg.cursor = 'pointer';
      const idx = i;
      slotBg.on('pointertap', () => {
        selectedGemTargetIdx = idx;
        rebuildPanel();
      });

      slotBg.position.set(sx, sy);
      container.addChild(slotBg);
      col++;
    }

    // Socket button
    if (selectedGemTargetIdx !== null && selectedGem) {
      const socketBtn = new Graphics();
      const sbx = PANEL_X + SECTION_RIGHT_X + 240;
      const sby = PANEL_Y + GEM_Y + 34;
      socketBtn.rect(0, 0, 80, 28).fill({ color: 0x332255, alpha: 0.9 });
      socketBtn.rect(0, 0, 80, 28).stroke({ width: 2, color: 0x9966cc });
      socketBtn.position.set(sbx, sby);
      socketBtn.eventMode = 'static';
      socketBtn.cursor = 'pointer';

      const socketLabel = new Text({
        text: 'SOCKET',
        style: new TextStyle({ fill: 0xcc88ff, fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' }),
      });
      socketLabel.position.set(8, 6);
      socketBtn.addChild(socketLabel);

      socketBtn.on('pointertap', () => {
        if (!selectedGem || selectedGemTargetIdx === null) return;
        const item = inventory.backpack[selectedGemTargetIdx];
        if (!item || !item.socket || item.socket.gem) return;

        // Socket the gem
        item.socket.gem = selectedGem;
        inventory.removeGem(selectedGem.id);
        markStatsDirty();

        const bonus = GEM_BONUSES[selectedGem.type];
        showFeedback(`Socketed ${selectedGem.name}: ${bonus.label}`, GEM_COLORS[selectedGem.type]);
        selectedGem = null;
        selectedGemTargetIdx = null;
        rebuildPanel();
      });

      container.addChild(socketBtn);
    }
  }
}

function abbreviate(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '.';
}

// --- Public API ---

export function updateCraftingPanel(): void {
  const input = InputManager.instance;
  const kDown = input.isPressed('KeyK');
  const escDown = input.isPressed('Escape');

  // Close on Escape rising edge
  if (escDown && !prevEscPressed && visible) {
    visible = false;
    if (container) container.visible = false;
    prevEscPressed = escDown;
    prevKPressed = kDown;
    return;
  }
  prevEscPressed = escDown;

  // Toggle on rising edge
  if (kDown && !prevKPressed) {
    visible = !visible;

    if (!container) {
      container = createPanel();
      game.hudLayer.addChild(container);
    }

    container.visible = visible;
    if (visible) {
      // Reset selection state
      selectedRecipe = null;
      selectedCraftTargetIdx = null;
      selectedGem = null;
      selectedGemTargetIdx = null;
      rebuildPanel();
    }
  }

  prevKPressed = kDown;

  // Refresh while visible
  if (visible && container) {
    // Decrement feedback timer
    if (feedbackTimer > 0) {
      feedbackTimer -= 1 / 60;
      if (feedbackTimer <= 0 && feedbackText) {
        feedbackText.text = '';
      }
    }
  }
}

export function isCraftingPanelOpen(): boolean {
  return visible;
}

/** Programmatically open the crafting panel (used by NPC click). */
export function openCraftingPanel(): void {
  if (!container) {
    container = createPanel();
    game.hudLayer.addChild(container);
  }
  visible = true;
  container.visible = true;
  selectedRecipe = null;
  selectedCraftTargetIdx = null;
  selectedGem = null;
  selectedGemTargetIdx = null;
  rebuildPanel();
}
