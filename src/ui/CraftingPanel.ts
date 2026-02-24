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
import {
  Colors, Fonts, FontSize, RARITY_COLORS,
  abbreviate, drawPanelBg, drawSlotBg, drawPixelBorder, makeCloseButton,
} from './UITheme';

import { SCREEN_W, SCREEN_H } from '../core/constants';

// Layout constants
const PANEL_W = 780;
const PANEL_H = 580;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

// Section positions (relative to PANEL_X, PANEL_Y)
const SECTION_LEFT_X = 16;
const SECTION_RIGHT_X = 400;
const MATERIALS_Y = 48;
const SALVAGE_Y = 96;
const CRAFT_Y = 96;
const GEM_Y = 370;

const SLOT_SIZE = 44;
const SLOT_GAP = 4;
const SLOTS_PER_ROW = 4;

let container: Container | null = null;
let visible = false;
let prevKPressed = false;
let prevEscPressed = false;

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

  container.removeChildren();

  // Background
  const bg = new Graphics();
  drawPanelBg(bg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  container.addChild(bg);

  // Title
  const title = new Text({
    text: 'CRAFTING',
    style: new TextStyle({
      fill: Colors.accentGold,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  title.position.set(PANEL_X + 16, PANEL_Y + 16);
  container.addChild(title);

  // Close button
  const closeBtn = makeCloseButton(PANEL_X + PANEL_W - 50, PANEL_Y + 16, () => {
    visible = false;
    if (container) container.visible = false;
  });
  container.addChild(closeBtn);

  // Feedback text
  feedbackText = new Text({
    text: '',
    style: new TextStyle({
      fill: Colors.accentLime,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
    }),
  });
  feedbackText.position.set(PANEL_X + PANEL_W / 2 - 100, PANEL_Y + PANEL_H - 26);
  container.addChild(feedbackText);

  buildMaterialsDisplay();
  buildSalvageSection();
  buildCraftingSection();
  buildGemSection();
}

function buildMaterialsDisplay(): void {
  if (!container) return;
  const matLabel = new Text({
    text: 'Materials:',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  matLabel.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + MATERIALS_Y);
  container.addChild(matLabel);

  const matTypes: MaterialType[] = ['scrap', 'essence', 'crystal', 'prism'];
  const inv = materials.inventory;
  let offsetX = 80;
  for (const mat of matTypes) {
    const text = new Text({
      text: `${MATERIAL_NAMES[mat]}: ${inv[mat]}`,
      style: new TextStyle({
        fill: MATERIAL_COLORS[mat],
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    text.position.set(PANEL_X + SECTION_LEFT_X + offsetX, PANEL_Y + MATERIALS_Y);
    container.addChild(text);
    offsetX += 120;
  }

  const gemCountText = new Text({
    text: `Gems: ${inventory.gems.length}`,
    style: new TextStyle({
      fill: Colors.textPrimary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  gemCountText.position.set(PANEL_X + SECTION_LEFT_X + offsetX, PANEL_Y + MATERIALS_Y);
  container.addChild(gemCountText);
}

function buildSalvageSection(): void {
  if (!container) return;

  const sectionLabel = new Text({
    text: 'SALVAGE',
    style: new TextStyle({
      fill: Colors.accentRed,
      fontSize: 10,
      fontFamily: Fonts.display,
    }),
  });
  sectionLabel.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + SALVAGE_Y - 4);
  container.addChild(sectionLabel);

  const hint = new Text({
    text: '(click to salvage)',
    style: new TextStyle({
      fill: Colors.textMuted,
      fontSize: FontSize.xs,
      fontFamily: Fonts.body,
    }),
  });
  hint.position.set(PANEL_X + SECTION_LEFT_X + 100, PANEL_Y + SALVAGE_Y);
  container.addChild(hint);

  const backpack = inventory.backpack;
  for (let i = 0; i < backpack.length; i++) {
    const col = i % SLOTS_PER_ROW;
    const row = Math.floor(i / SLOTS_PER_ROW);
    const sx = PANEL_X + SECTION_LEFT_X + col * (SLOT_SIZE + SLOT_GAP);
    const sy = PANEL_Y + SALVAGE_Y + 24 + row * (SLOT_SIZE + SLOT_GAP);

    const slotBg = new Graphics();
    const item = backpack[i];

    if (item) {
      const color = RARITY_COLORS[item.rarity];
      drawSlotBg(slotBg, 0, 0, SLOT_SIZE, color);

      const nameText = new Text({
        text: abbreviate(item.name, 8),
        style: new TextStyle({
          fill: color,
          fontSize: FontSize.sm,
          fontFamily: Fonts.body,
          fontWeight: 'bold',
        }),
      });
      nameText.position.set(2, 2);
      slotBg.addChild(nameText);

      const levelText = new Text({
        text: `L${item.level}`,
        style: new TextStyle({
          fill: Colors.textMuted,
          fontSize: FontSize.xs,
          fontFamily: Fonts.body,
        }),
      });
      levelText.position.set(2, 28);
      slotBg.addChild(levelText);

      if (item.socket) {
        const socketText = new Text({
          text: item.socket.gem ? 'G' : 'O',
          style: new TextStyle({
            fill: item.socket.gem ? GEM_COLORS[item.socket.gem.type] : Colors.textMuted,
            fontSize: FontSize.xs,
            fontFamily: Fonts.body,
          }),
        });
        socketText.position.set(34, 2);
        slotBg.addChild(socketText);
      }

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
      drawSlotBg(slotBg, 0, 0, SLOT_SIZE);
    }

    slotBg.position.set(sx, sy);
    container.addChild(slotBg);
  }
}

function buildCraftingSection(): void {
  if (!container) return;

  const sectionLabel = new Text({
    text: 'CRAFT',
    style: new TextStyle({
      fill: Colors.accentCyan,
      fontSize: 10,
      fontFamily: Fonts.display,
    }),
  });
  sectionLabel.position.set(PANEL_X + SECTION_RIGHT_X, PANEL_Y + CRAFT_Y - 4);
  container.addChild(sectionLabel);

  // Recipe buttons
  for (let r = 0; r < RECIPES.length; r++) {
    const recipe = RECIPES[r];
    const by = PANEL_Y + CRAFT_Y + 24 + r * 48;
    const bx = PANEL_X + SECTION_RIGHT_X;

    const isSelected = selectedRecipe === recipe;
    const canAfford = materials.has(recipe.cost);

    const btn = new Graphics();
    btn.rect(0, 0, 360, 42).fill({ color: isSelected ? 0x1a2a4e : Colors.slotBg, alpha: 0.9 });
    if (isSelected) {
      drawPixelBorder(btn, 0, 0, 360, 42, { borderWidth: 2, highlight: Colors.accentCyan, shadow: Colors.borderShadow });
    } else {
      btn.rect(0, 0, 360, 42).stroke({ width: 1, color: canAfford ? Colors.borderMid : 0x222233 });
    }
    btn.position.set(bx, by);
    btn.eventMode = 'static';
    btn.cursor = canAfford ? 'pointer' : 'default';

    const nameText = new Text({
      text: recipe.name,
      style: new TextStyle({
        fill: canAfford ? Colors.textPrimary : Colors.textMuted,
        fontSize: FontSize.base,
        fontFamily: Fonts.body,
        fontWeight: 'bold',
      }),
    });
    nameText.position.set(8, 4);
    btn.addChild(nameText);

    const descText = new Text({
      text: recipe.description,
      style: new TextStyle({
        fill: canAfford ? Colors.textSecondary : Colors.textMuted,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    descText.position.set(8, 24);
    btn.addChild(descText);

    btn.on('pointertap', () => {
      if (!canAfford) {
        showFeedback('Not enough materials!', Colors.accentRed);
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

  // Target item selection
  if (selectedRecipe) {
    const targetLabel = new Text({
      text: 'Select target item:',
      style: new TextStyle({
        fill: Colors.textSecondary,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    targetLabel.position.set(PANEL_X + SECTION_RIGHT_X, PANEL_Y + CRAFT_Y + 180);
    container.addChild(targetLabel);

    const backpack = inventory.backpack;
    let col = 0;
    let row = 0;
    for (let i = 0; i < backpack.length; i++) {
      const item = backpack[i];
      if (!item) continue;
      if (!selectedRecipe.canApply(item)) continue;

      const sx = PANEL_X + SECTION_RIGHT_X + col * (SLOT_SIZE + SLOT_GAP);
      const sy = PANEL_Y + CRAFT_Y + 200 + row * (SLOT_SIZE + SLOT_GAP);

      const isTarget = selectedCraftTargetIdx === i;
      const color = RARITY_COLORS[item.rarity];

      const slotBg = new Graphics();
      drawSlotBg(slotBg, 0, 0, SLOT_SIZE, isTarget ? Colors.accentCyan : color);

      const nameText = new Text({
        text: abbreviate(item.name, 8),
        style: new TextStyle({
          fill: color,
          fontSize: FontSize.sm,
          fontFamily: Fonts.body,
          fontWeight: 'bold',
        }),
      });
      nameText.position.set(2, 2);
      slotBg.addChild(nameText);

      const lvText = new Text({
        text: `L${item.level}`,
        style: new TextStyle({
          fill: Colors.textMuted,
          fontSize: FontSize.xs,
          fontFamily: Fonts.body,
        }),
      });
      lvText.position.set(2, 28);
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
      const cbx = PANEL_X + SECTION_RIGHT_X + 260;
      const cby = PANEL_Y + CRAFT_Y + 180;
      craftBtn.rect(0, 0, 90, 32).fill({ color: 0x1a2e1a, alpha: 0.9 });
      drawPixelBorder(craftBtn, 0, 0, 90, 32, { borderWidth: 2, highlight: Colors.accentLime, shadow: Colors.borderShadow });
      craftBtn.position.set(cbx, cby);
      craftBtn.eventMode = 'static';
      craftBtn.cursor = 'pointer';

      const craftLabel = new Text({
        text: 'CRAFT',
        style: new TextStyle({
          fill: Colors.accentLime,
          fontSize: FontSize.base,
          fontFamily: Fonts.body,
          fontWeight: 'bold',
        }),
      });
      craftLabel.position.set(18, 6);
      craftBtn.addChild(craftLabel);

      craftBtn.on('pointertap', () => {
        if (!selectedRecipe || selectedCraftTargetIdx === null) return;
        const item = inventory.backpack[selectedCraftTargetIdx];
        if (!item) return;

        const result = craft(selectedRecipe, item);
        if (result) {
          inventory.backpack[selectedCraftTargetIdx] = result;
          markStatsDirty();
          showFeedback(`Crafted: ${selectedRecipe.name}!`, Colors.accentLime);
          selectedRecipe = null;
          selectedCraftTargetIdx = null;
        } else {
          showFeedback('Craft failed - check materials/requirements', Colors.accentRed);
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
    style: new TextStyle({
      fill: 0xCC66FF,
      fontSize: 10,
      fontFamily: Fonts.display,
    }),
  });
  sectionLabel.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + GEM_Y);
  container.addChild(sectionLabel);

  if (inventory.gems.length === 0) {
    const noGems = new Text({
      text: 'No gems available',
      style: new TextStyle({
        fill: Colors.textMuted,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    noGems.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + GEM_Y + 22);
    container.addChild(noGems);
  } else {
    const gemLabel = new Text({
      text: 'Select gem:',
      style: new TextStyle({
        fill: Colors.textSecondary,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    gemLabel.position.set(PANEL_X + SECTION_LEFT_X, PANEL_Y + GEM_Y + 20);
    container.addChild(gemLabel);

    for (let g = 0; g < inventory.gems.length; g++) {
      const gem = inventory.gems[g];
      const gx = PANEL_X + SECTION_LEFT_X + g * (SLOT_SIZE + SLOT_GAP);
      const gy = PANEL_Y + GEM_Y + 38;

      const isSelected = selectedGem?.id === gem.id;
      const color = GEM_COLORS[gem.type];
      const bonus = GEM_BONUSES[gem.type];

      const slotBg = new Graphics();
      drawSlotBg(slotBg, 0, 0, SLOT_SIZE, isSelected ? color : undefined);
      if (!isSelected) {
        slotBg.clear();
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: Colors.slotBg, alpha: 0.85 });
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 1, color });
      }

      const nameText = new Text({
        text: gem.name.slice(0, 6),
        style: new TextStyle({
          fill: color,
          fontSize: FontSize.sm,
          fontFamily: Fonts.body,
          fontWeight: 'bold',
        }),
      });
      nameText.position.set(2, 4);
      slotBg.addChild(nameText);

      const bonusText = new Text({
        text: bonus.label.slice(0, 8),
        style: new TextStyle({
          fill: Colors.textMuted,
          fontSize: FontSize.xs,
          fontFamily: Fonts.body,
        }),
      });
      bonusText.position.set(2, 28);
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

  // Socket target selection
  if (selectedGem) {
    const targetLabel = new Text({
      text: 'Select socketed item:',
      style: new TextStyle({
        fill: Colors.textSecondary,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
      }),
    });
    targetLabel.position.set(PANEL_X + SECTION_RIGHT_X, PANEL_Y + GEM_Y + 20);
    container.addChild(targetLabel);

    let col = 0;
    for (let i = 0; i < inventory.backpack.length; i++) {
      const item = inventory.backpack[i];
      if (!item || !item.socket || item.socket.gem) continue;

      const sx = PANEL_X + SECTION_RIGHT_X + col * (SLOT_SIZE + SLOT_GAP);
      const sy = PANEL_Y + GEM_Y + 38;
      const isTarget = selectedGemTargetIdx === i;
      const color = RARITY_COLORS[item.rarity];

      const slotBg = new Graphics();
      drawSlotBg(slotBg, 0, 0, SLOT_SIZE, isTarget ? Colors.accentCyan : color);

      const nameText = new Text({
        text: abbreviate(item.name, 8),
        style: new TextStyle({
          fill: color,
          fontSize: FontSize.sm,
          fontFamily: Fonts.body,
          fontWeight: 'bold',
        }),
      });
      nameText.position.set(2, 2);
      slotBg.addChild(nameText);

      const socketText = new Text({
        text: 'O',
        style: new TextStyle({
          fill: Colors.textMuted,
          fontSize: FontSize.sm,
          fontFamily: Fonts.body,
        }),
      });
      socketText.position.set(34, 26);
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
      const sbx = PANEL_X + SECTION_RIGHT_X + 260;
      const sby = PANEL_Y + GEM_Y + 38;
      socketBtn.rect(0, 0, 90, 32).fill({ color: 0x221133, alpha: 0.9 });
      drawPixelBorder(socketBtn, 0, 0, 90, 32, { borderWidth: 2, highlight: 0x9966CC, shadow: Colors.borderShadow });
      socketBtn.position.set(sbx, sby);
      socketBtn.eventMode = 'static';
      socketBtn.cursor = 'pointer';

      const socketLabel = new Text({
        text: 'SOCKET',
        style: new TextStyle({
          fill: 0xCC88FF,
          fontSize: FontSize.base,
          fontFamily: Fonts.body,
          fontWeight: 'bold',
        }),
      });
      socketLabel.position.set(10, 6);
      socketBtn.addChild(socketLabel);

      socketBtn.on('pointertap', () => {
        if (!selectedGem || selectedGemTargetIdx === null) return;
        const item = inventory.backpack[selectedGemTargetIdx];
        if (!item || !item.socket || item.socket.gem) return;

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

// --- Public API ---

export function updateCraftingPanel(): void {
  const input = InputManager.instance;
  const kDown = input.isPressed('KeyK');
  const escDown = input.isPressed('Escape');

  if (escDown && !prevEscPressed && visible) {
    visible = false;
    if (container) container.visible = false;
    prevEscPressed = escDown;
    prevKPressed = kDown;
    return;
  }
  prevEscPressed = escDown;

  if (kDown && !prevKPressed) {
    visible = !visible;

    if (!container) {
      container = createPanel();
      game.hudLayer.addChild(container);
    }

    container.visible = visible;
    if (visible) {
      selectedRecipe = null;
      selectedCraftTargetIdx = null;
      selectedGem = null;
      selectedGemTargetIdx = null;
      rebuildPanel();
    }
  }

  prevKPressed = kDown;

  if (visible && container) {
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
