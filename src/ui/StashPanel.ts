/**
 * Stash Panel UI.
 *
 * Opens when the player clicks the Stash NPC in town.
 * Displays tabbed storage (4x6 grid per tab) with item transfer to/from backpack,
 * search filtering, and rarity+slot sorting.
 */

import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js';
import { game } from '../Game';
import { InputManager } from '../core/InputManager';
import { inventory } from '../core/Inventory';
import { stash } from '../core/Stash';
import { world } from '../ecs/world';
import { BaseItem, Rarity, Slot } from '../loot/ItemTypes';

// Layout constants
const SCREEN_W = 1280;
const SCREEN_H = 720;
const PANEL_W = 600;
const PANEL_H = 620;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

const SLOT_SIZE = 42;
const SLOT_GAP = 4;

// Stash grid: 4 columns x 6 rows
const STASH_COLS = 4;
const STASH_ROWS = 6;
const STASH_GRID_X = 20;
const STASH_GRID_Y = 90;

// Backpack grid: 4 columns x 5 rows (shown on right side)
const BACKPACK_COLS = 4;
const BACKPACK_ROWS = 5;
const BACKPACK_GRID_X = 320;
const BACKPACK_GRID_Y = 90;

// Tab buttons
const TAB_BTN_W = 60;
const TAB_BTN_H = 24;
const TAB_BTN_GAP = 4;
const TAB_BTN_Y = 46;
const TAB_BTN_X = 20;

// Search bar
const SEARCH_BAR_X = 320;
const SEARCH_BAR_Y = 50;
const SEARCH_BAR_W = 160;
const SEARCH_BAR_H = 24;

// Sort button
const SORT_BTN_X = 490;
const SORT_BTN_Y = 50;
const SORT_BTN_W = 70;
const SORT_BTN_H = 24;

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

const SLOT_NAME_MAP: Record<Slot, string> = {
  [Slot.Weapon]: 'Weapon',
  [Slot.Helmet]: 'Helmet',
  [Slot.Chest]: 'Chest',
  [Slot.Boots]: 'Boots',
  [Slot.Ring]: 'Ring',
  [Slot.Amulet]: 'Amulet',
  [Slot.Offhand]: 'Offhand',
};

let container: Container | null = null;
let tooltip: Container | null = null;
let feedbackText: Text | null = null;
let feedbackTimer = 0;
let visible = false;
let prevEscPressed = false;
let searchQuery = '';
let goldText: Text | null = null;

// Static child count for refresh cleanup
let staticChildCount = 0;

function getRarityColor(rarity: Rarity): number {
  return RARITY_COLORS[rarity] ?? 0xcccccc;
}

function abbreviate(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '.';
}

function getPlayerGold(): number {
  const players = world.with('player', 'gold').entities;
  return players.length > 0 ? (players[0].gold ?? 0) : 0;
}

function setPlayerGold(amount: number): void {
  const players = world.with('player', 'gold').entities;
  if (players.length > 0) {
    players[0].gold = amount;
  }
}

function showFeedback(msg: string, color: number): void {
  if (feedbackText && container) {
    feedbackText.text = msg;
    feedbackText.style.fill = color;
    feedbackText.visible = true;
    feedbackTimer = 2.0;
  }
}

// --- Tooltip ---

function buildTooltipText(item: BaseItem, extra?: string): string {
  const rarityName = RARITY_NAMES[item.rarity];
  const slotName = SLOT_NAME_MAP[item.slot];
  const lines: string[] = [];

  lines.push(`[${rarityName}] ${item.name}`);
  lines.push(`Level ${item.level} ${slotName}`);
  lines.push('\u2500'.repeat(22));

  if (item.baseStats.damage) lines.push(`Damage: ${item.baseStats.damage}`);
  if (item.baseStats.armor) lines.push(`Armor: ${item.baseStats.armor}`);
  if (item.baseStats.attackSpeed) lines.push(`Attack Speed: ${item.baseStats.attackSpeed}`);

  if (item.affixes.length > 0) {
    lines.push('\u2500'.repeat(22));
    for (const affix of item.affixes) {
      const sign = affix.value >= 0 ? '+' : '';
      const isPercent =
        affix.stat.includes('%') ||
        affix.stat.includes('percent') ||
        affix.stat.includes('critical') ||
        affix.stat.includes('speed') ||
        affix.stat.includes('movement');
      lines.push(`${sign}${affix.value}${isPercent ? '%' : ''} ${affix.stat}`);
    }
  }

  if (item.uniqueEffect) {
    lines.push('\u2500'.repeat(22));
    lines.push(item.uniqueEffect);
  }

  if (extra) {
    lines.push('\u2500'.repeat(22));
    lines.push(extra);
  }

  return lines.join('\n');
}

function showTooltip(content: string, color: number, globalX: number, globalY: number): void {
  hideTooltip();

  tooltip = new Container();

  const text = new Text({
    text: content,
    style: new TextStyle({
      fill: 0xeeeeee,
      fontSize: 11,
      fontFamily: 'monospace',
      lineHeight: 16,
      wordWrap: true,
      wordWrapWidth: 240,
    }),
  });

  const padding = 10;
  const tooltipW = text.width + padding * 2;
  const tooltipH = text.height + padding * 2;

  let tx = globalX - tooltipW - 12;
  let ty = globalY - 10;
  if (tx < 4) tx = globalX + 12;
  if (ty + tooltipH > SCREEN_H - 4) ty = SCREEN_H - tooltipH - 4;
  if (ty < 4) ty = 4;

  const bg = new Graphics();
  bg.rect(0, 0, tooltipW, tooltipH).fill({ color: 0x0a0a18, alpha: 0.95 });
  bg.rect(0, 0, tooltipW, tooltipH).stroke({ width: 1, color });
  tooltip.addChild(bg);

  text.position.set(padding, padding);
  tooltip.addChild(text);

  tooltip.position.set(tx, ty);
  game.hudLayer.addChild(tooltip);
}

function hideTooltip(): void {
  if (tooltip) {
    tooltip.removeFromParent();
    tooltip.destroy({ children: true });
    tooltip = null;
  }
}

// --- Search / Sort ---

function matchesSearch(item: BaseItem): boolean {
  if (!searchQuery) return true;
  return item.name.toLowerCase().includes(searchQuery.toLowerCase());
}

function sortStashTab(): void {
  const tab = stash.getTab(stash.activeTab);
  if (!tab) return;

  // Collect non-null items
  const items: BaseItem[] = [];
  for (const item of tab.items) {
    if (item) items.push(item);
  }

  // Sort by rarity (descending: Unique > Rare > Magic > Normal), then by slot type
  items.sort((a, b) => {
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    return a.slot - b.slot;
  });

  // Re-fill the tab
  for (let i = 0; i < tab.items.length; i++) {
    tab.items[i] = items[i] ?? null;
  }
}

// --- Panel Creation ---

function createPanel(): Container {
  const root = new Container();

  // Background
  const bg = new Graphics();
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).fill({ color: 0x111122, alpha: 0.92 });
  bg.rect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H).stroke({ width: 2, color: 0x8888cc });
  root.addChild(bg);

  // Title
  const title = new Text({
    text: 'STASH',
    style: new TextStyle({
      fill: 0x88aaff,
      fontSize: 18,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  title.position.set(PANEL_X + 16, PANEL_Y + 14);
  root.addChild(title);

  // Close button
  const hint = new Text({
    text: '[X] close',
    style: new TextStyle({
      fill: 0x666688,
      fontSize: 11,
      fontFamily: 'monospace',
    }),
  });
  hint.position.set(PANEL_X + PANEL_W - 80, PANEL_Y + 18);
  hint.eventMode = 'static';
  hint.cursor = 'pointer';
  hint.on('pointerover', () => { hint.style.fill = 0xff4444; });
  hint.on('pointerout', () => { hint.style.fill = 0x666688; });
  hint.on('pointertap', () => {
    visible = false;
    if (container) container.visible = false;
  });
  root.addChild(hint);

  // Gold display
  goldText = new Text({
    text: 'Gold: 0',
    style: new TextStyle({
      fill: 0xffd700,
      fontSize: 14,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  goldText.position.set(PANEL_X + PANEL_W / 2 - 30, PANEL_Y + 14);
  root.addChild(goldText);

  // Stash section label
  const stashLabel = new Text({
    text: 'Stash (click to move to backpack)',
    style: new TextStyle({
      fill: 0xaaaacc,
      fontSize: 12,
      fontFamily: 'monospace',
    }),
  });
  stashLabel.position.set(PANEL_X + STASH_GRID_X, PANEL_Y + STASH_GRID_Y - 16);
  root.addChild(stashLabel);

  // Backpack section label
  const bpLabel = new Text({
    text: 'Backpack (click to stash)',
    style: new TextStyle({
      fill: 0xaaaacc,
      fontSize: 12,
      fontFamily: 'monospace',
    }),
  });
  bpLabel.position.set(PANEL_X + BACKPACK_GRID_X, PANEL_Y + BACKPACK_GRID_Y - 16);
  root.addChild(bpLabel);

  // Feedback text
  feedbackText = new Text({
    text: '',
    style: new TextStyle({
      fill: 0xff4444,
      fontSize: 13,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  feedbackText.position.set(PANEL_X + PANEL_W / 2 - 80, PANEL_Y + PANEL_H - 30);
  feedbackText.visible = false;
  root.addChild(feedbackText);

  root.visible = false;
  staticChildCount = root.children.length;
  return root;
}

/** Rebuild all dynamic elements (tabs, grids, search, sort). */
function refreshPanel(): void {
  if (!container) return;

  // Remove all dynamic children (keep static ones)
  while (container.children.length > staticChildCount) {
    const child = container.children[container.children.length - 1];
    container.removeChild(child);
    child.destroy({ children: true });
  }

  // Update gold
  if (goldText) {
    goldText.text = `Gold: ${getPlayerGold()}`;
  }

  // --- Tab buttons ---
  for (let i = 0; i < stash.tabs.length; i++) {
    const tab = stash.tabs[i];
    const isActive = i === stash.activeTab;
    const bx = PANEL_X + TAB_BTN_X + i * (TAB_BTN_W + TAB_BTN_GAP);
    const by = PANEL_Y + TAB_BTN_Y;

    const btnC = new Container();
    btnC.position.set(bx, by);

    const btnBg = new Graphics();
    btnBg
      .rect(0, 0, TAB_BTN_W, TAB_BTN_H)
      .fill({ color: isActive ? 0x334488 : 0x1a1a2e, alpha: 0.9 });
    btnBg.rect(0, 0, TAB_BTN_W, TAB_BTN_H).stroke({ width: 1, color: isActive ? 0x6688cc : 0x444466 });
    btnC.addChild(btnBg);

    const btnLabel = new Text({
      text: tab.name,
      style: new TextStyle({
        fill: isActive ? 0xffffff : 0x888899,
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: isActive ? 'bold' : 'normal',
      }),
    });
    btnLabel.position.set(6, 5);
    btnC.addChild(btnLabel);

    btnBg.eventMode = 'static';
    btnBg.cursor = 'pointer';
    const tabIdx = i;
    btnBg.on('pointertap', () => {
      stash.activeTab = tabIdx;
      hideTooltip();
      refreshPanel();
    });

    container.addChild(btnC);
  }

  // --- Buy Tab button ---
  if (stash.canPurchaseTab()) {
    const cost = stash.getNextTabCost();
    const bx = PANEL_X + TAB_BTN_X + stash.tabs.length * (TAB_BTN_W + TAB_BTN_GAP);
    const by = PANEL_Y + TAB_BTN_Y;

    const buyC = new Container();
    buyC.position.set(bx, by);

    const buyBg = new Graphics();
    buyBg.rect(0, 0, TAB_BTN_W + 10, TAB_BTN_H).fill({ color: 0x1a2a1a, alpha: 0.9 });
    buyBg.rect(0, 0, TAB_BTN_W + 10, TAB_BTN_H).stroke({ width: 1, color: 0x448844 });
    buyC.addChild(buyBg);

    const buyLabel = new Text({
      text: `+ ${cost}g`,
      style: new TextStyle({
        fill: 0x66cc66,
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 'bold',
      }),
    });
    buyLabel.position.set(6, 5);
    buyC.addChild(buyLabel);

    buyBg.eventMode = 'static';
    buyBg.cursor = 'pointer';
    buyBg.on('pointertap', () => {
      const gold = getPlayerGold();
      const tabCost = stash.getNextTabCost();
      if (tabCost === -1) {
        showFeedback('Max tabs reached!', 0xff4444);
        return;
      }
      if (gold < tabCost) {
        showFeedback('Not enough gold!', 0xff4444);
        return;
      }
      setPlayerGold(gold - tabCost);
      stash.purchaseTab();
      stash.activeTab = stash.tabs.length - 1;
      showFeedback(`Purchased Tab ${stash.tabs.length}!`, 0x44ff44);
      hideTooltip();
      refreshPanel();
    });

    container.addChild(buyC);
  }

  // --- Search bar ---
  const searchC = new Container();
  searchC.position.set(PANEL_X + SEARCH_BAR_X, PANEL_Y + SEARCH_BAR_Y);

  const searchBg = new Graphics();
  searchBg
    .rect(0, 0, SEARCH_BAR_W, SEARCH_BAR_H)
    .fill({ color: 0x0a0a15, alpha: 0.9 });
  searchBg.rect(0, 0, SEARCH_BAR_W, SEARCH_BAR_H).stroke({ width: 1, color: 0x444466 });
  searchC.addChild(searchBg);

  const searchLabel = new Text({
    text: searchQuery ? `Search: ${searchQuery}` : 'Search: (type to filter)',
    style: new TextStyle({
      fill: searchQuery ? 0xeeeeee : 0x666688,
      fontSize: 10,
      fontFamily: 'monospace',
    }),
  });
  searchLabel.position.set(4, 5);
  searchC.addChild(searchLabel);

  // Click to toggle search focus (we handle key input in update)
  searchBg.eventMode = 'static';
  searchBg.cursor = 'pointer';
  searchBg.on('pointertap', () => {
    // Clear search on click if already has text, otherwise keep focus
    if (searchQuery) {
      searchQuery = '';
      refreshPanel();
    }
  });

  container.addChild(searchC);

  // --- Sort button ---
  const sortC = new Container();
  sortC.position.set(PANEL_X + SORT_BTN_X, PANEL_Y + SORT_BTN_Y);

  const sortBg = new Graphics();
  sortBg.rect(0, 0, SORT_BTN_W, SORT_BTN_H).fill({ color: 0x1a1a2e, alpha: 0.9 });
  sortBg.rect(0, 0, SORT_BTN_W, SORT_BTN_H).stroke({ width: 1, color: 0x888844 });
  sortC.addChild(sortBg);

  const sortLabel = new Text({
    text: 'Sort',
    style: new TextStyle({
      fill: 0xcccc66,
      fontSize: 11,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    }),
  });
  sortLabel.position.set(20, 5);
  sortC.addChild(sortLabel);

  sortBg.eventMode = 'static';
  sortBg.cursor = 'pointer';
  sortBg.on('pointertap', () => {
    sortStashTab();
    showFeedback('Sorted!', 0xcccc66);
    hideTooltip();
    refreshPanel();
  });

  container.addChild(sortC);

  // --- Stash grid (active tab) ---
  const activeTab = stash.getTab(stash.activeTab);
  if (activeTab) {
    for (let row = 0; row < STASH_ROWS; row++) {
      for (let col = 0; col < STASH_COLS; col++) {
        const idx = row * STASH_COLS + col;
        const sx = PANEL_X + STASH_GRID_X + col * (SLOT_SIZE + SLOT_GAP);
        const sy = PANEL_Y + STASH_GRID_Y + row * (SLOT_SIZE + SLOT_GAP);
        const item = activeTab.items[idx];

        const slotC = new Container();
        slotC.position.set(sx, sy);

        const slotBg = new Graphics();

        // Hide items that don't match search
        const matchSearch = item ? matchesSearch(item) : true;

        if (item && matchSearch) {
          const color = getRarityColor(item.rarity);
          slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
          slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 2, color });
          slotC.addChild(slotBg);

          const nameText = new Text({
            text: abbreviate(item.name, 6),
            style: new TextStyle({
              fill: color,
              fontSize: 9,
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }),
          });
          nameText.position.set(3, 3);
          slotC.addChild(nameText);

          const slotIcon = new Text({
            text: SLOT_NAME_MAP[item.slot].slice(0, 3),
            style: new TextStyle({
              fill: 0x666688,
              fontSize: 8,
              fontFamily: 'monospace',
            }),
          });
          slotIcon.position.set(3, 28);
          slotC.addChild(slotIcon);

          // Interactivity: click to move to backpack
          slotBg.eventMode = 'static';
          slotBg.cursor = 'pointer';
          const stashIdx = idx;
          const tabIdx = stash.activeTab;
          slotBg.on('pointertap', () => {
            moveStashToBackpack(tabIdx, stashIdx);
          });
          slotBg.on('pointerover', (e: FederatedPointerEvent) => {
            const stashItem = stash.getTab(tabIdx)?.items[stashIdx];
            if (stashItem) {
              const content = buildTooltipText(stashItem, 'Click to move to backpack');
              showTooltip(content, getRarityColor(stashItem.rarity), e.globalX, e.globalY);
            }
          });
          slotBg.on('pointermove', (e: FederatedPointerEvent) => {
            const stashItem = stash.getTab(tabIdx)?.items[stashIdx];
            if (stashItem) {
              const content = buildTooltipText(stashItem, 'Click to move to backpack');
              showTooltip(content, getRarityColor(stashItem.rarity), e.globalX, e.globalY);
            }
          });
          slotBg.on('pointerout', () => hideTooltip());
        } else if (item && !matchSearch) {
          // Item exists but doesn't match search: dim/empty slot
          slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.4 });
          slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 1, color: 0x222233 });
          slotC.addChild(slotBg);
        } else {
          slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
          slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 1, color: 0x333355 });
          slotC.addChild(slotBg);
        }

        container.addChild(slotC);
      }
    }
  }

  // --- Player backpack (for transfer) ---
  for (let row = 0; row < BACKPACK_ROWS; row++) {
    for (let col = 0; col < BACKPACK_COLS; col++) {
      const idx = row * BACKPACK_COLS + col;
      const sx = PANEL_X + BACKPACK_GRID_X + col * (SLOT_SIZE + SLOT_GAP);
      const sy = PANEL_Y + BACKPACK_GRID_Y + row * (SLOT_SIZE + SLOT_GAP);
      const item = inventory.backpack[idx];

      const slotC = new Container();
      slotC.position.set(sx, sy);

      const slotBg = new Graphics();

      if (item) {
        const color = getRarityColor(item.rarity);
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 2, color });
        slotC.addChild(slotBg);

        const nameText = new Text({
          text: abbreviate(item.name, 6),
          style: new TextStyle({
            fill: color,
            fontSize: 9,
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }),
        });
        nameText.position.set(3, 3);
        slotC.addChild(nameText);

        const slotIcon = new Text({
          text: SLOT_NAME_MAP[item.slot].slice(0, 3),
          style: new TextStyle({
            fill: 0x666688,
            fontSize: 8,
            fontFamily: 'monospace',
          }),
        });
        slotIcon.position.set(3, 28);
        slotC.addChild(slotIcon);

        // Interactivity: click to move to stash
        slotBg.eventMode = 'static';
        slotBg.cursor = 'pointer';
        const bpIdx = idx;
        slotBg.on('pointertap', () => {
          moveBackpackToStash(bpIdx);
        });
        slotBg.on('pointerover', (e: FederatedPointerEvent) => {
          const bpItem = inventory.backpack[bpIdx];
          if (bpItem) {
            const content = buildTooltipText(bpItem, 'Click to move to stash');
            showTooltip(content, getRarityColor(bpItem.rarity), e.globalX, e.globalY);
          }
        });
        slotBg.on('pointermove', (e: FederatedPointerEvent) => {
          const bpItem = inventory.backpack[bpIdx];
          if (bpItem) {
            const content = buildTooltipText(bpItem, 'Click to move to stash');
            showTooltip(content, getRarityColor(bpItem.rarity), e.globalX, e.globalY);
          }
        });
        slotBg.on('pointerout', () => hideTooltip());
      } else {
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0x0a0a15, alpha: 0.8 });
        slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 1, color: 0x333355 });
        slotC.addChild(slotBg);
      }

      container.addChild(slotC);
    }
  }
}

// --- Transfer actions ---

function moveStashToBackpack(tabIndex: number, slotIndex: number): void {
  const tab = stash.getTab(tabIndex);
  if (!tab) return;

  const item = tab.items[slotIndex];
  if (!item) return;

  const added = inventory.addItem(item);
  if (!added) {
    showFeedback('Backpack full!', 0xff4444);
    return;
  }

  tab.items[slotIndex] = null;
  showFeedback(`Moved ${item.name} to backpack`, 0x44ff44);
  hideTooltip();
  refreshPanel();
}

function moveBackpackToStash(backpackIndex: number): void {
  const item = inventory.backpack[backpackIndex];
  if (!item) return;

  const added = stash.addItem(item);
  if (!added) {
    showFeedback('Stash tab full!', 0xff4444);
    return;
  }

  inventory.backpack[backpackIndex] = null;
  showFeedback(`Stashed ${item.name}`, 0x44ff44);
  hideTooltip();
  refreshPanel();
}

// --- Key input handling for search ---

let keyListener: ((e: KeyboardEvent) => void) | null = null;

function attachKeyListener(): void {
  if (keyListener) return;
  keyListener = (e: KeyboardEvent) => {
    if (!visible) return;

    if (e.key === 'Backspace') {
      if (searchQuery.length > 0) {
        searchQuery = searchQuery.slice(0, -1);
        refreshPanel();
      }
      e.preventDefault();
      return;
    }

    // Only allow printable characters for search
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Don't capture Escape
      if (e.key === 'Escape') return;
      searchQuery += e.key;
      refreshPanel();
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', keyListener);
}

function detachKeyListener(): void {
  if (keyListener) {
    window.removeEventListener('keydown', keyListener);
    keyListener = null;
  }
}

// --- Public API ---

export function updateStashPanel(): void {
  const input = InputManager.instance;
  const escDown = input.isPressed('Escape');

  // Close on Escape rising edge
  if (escDown && !prevEscPressed && visible) {
    closeStashPanel();
  }
  prevEscPressed = escDown;

  // Tick feedback timer
  if (feedbackTimer > 0) {
    feedbackTimer -= 1 / 60;
    if (feedbackTimer <= 0 && feedbackText) {
      feedbackText.visible = false;
    }
  }

  // Refresh gold display while visible
  if (visible && goldText) {
    goldText.text = `Gold: ${getPlayerGold()}`;
  }
}

export function isStashOpen(): boolean {
  return visible;
}

/** Programmatically open the stash panel (used by NPC click). */
export function openStashPanel(): void {
  if (!container) {
    container = createPanel();
    game.hudLayer.addChild(container);
  }
  visible = true;
  container.visible = true;
  searchQuery = '';
  attachKeyListener();
  refreshPanel();
}

/** Close the stash panel. */
export function closeStashPanel(): void {
  visible = false;
  if (container) {
    container.visible = false;
  }
  searchQuery = '';
  detachKeyListener();
  hideTooltip();
}
