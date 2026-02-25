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
import {
  Colors, Fonts, FontSize,
  getRarityColor, abbreviate, drawPanelBg, drawSlotBg, drawPixelBorder, makeCloseButton,
} from './UITheme';
import { showItemTooltipWithCompare, hideTooltip } from './Tooltip';

import { SCREEN_W, SCREEN_H } from '../core/constants';

// Layout constants
const PANEL_W = 1100;
const PANEL_H = 900;
const PANEL_X = (SCREEN_W - PANEL_W) / 2;
const PANEL_Y = (SCREEN_H - PANEL_H) / 2;

const SLOT_SIZE = 88;
const SLOT_GAP = 8;

const STASH_COLS = 5;
const STASH_ROWS = 6;
const STASH_GRID_X = 20;
const STASH_GRID_Y = 140;

const BACKPACK_COLS = 5;
const BACKPACK_ROWS = 4;
const BACKPACK_GRID_X = 570;
const BACKPACK_GRID_Y = 140;

const TAB_BTN_W = 100;
const TAB_BTN_H = 40;
const TAB_BTN_GAP = 5;
const TAB_BTN_Y = 54;
const TAB_BTN_X = 20;

const SEARCH_BAR_X = 570;
const SEARCH_BAR_Y = 58;
const SEARCH_BAR_W = 270;
const SEARCH_BAR_H = 34;

const SORT_BTN_X = 850;
const SORT_BTN_Y = 58;
const SORT_BTN_W = 90;
const SORT_BTN_H = 34;

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
let feedbackText: Text | null = null;
let feedbackTimer = 0;
let visible = false;
let prevEscPressed = false;
let searchQuery = '';
let goldText: Text | null = null;

let staticChildCount = 0;

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

function matchesSearch(item: BaseItem): boolean {
  if (!searchQuery) return true;
  return item.name.toLowerCase().includes(searchQuery.toLowerCase());
}

function sortStashTab(): void {
  const tab = stash.getTab(stash.activeTab);
  if (!tab) return;

  const items: BaseItem[] = [];
  for (const item of tab.items) {
    if (item) items.push(item);
  }

  items.sort((a, b) => {
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    return a.slot - b.slot;
  });

  for (let i = 0; i < tab.items.length; i++) {
    tab.items[i] = items[i] ?? null;
  }
}

// --- Panel Creation ---

function createPanel(): Container {
  const root = new Container();

  // Background
  const bg = new Graphics();
  drawPanelBg(bg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, { highlight: Colors.accentCyan, shadow: Colors.borderShadow });
  root.addChild(bg);

  // Title
  const title = new Text({
    text: 'STASH',
    style: new TextStyle({
      fill: Colors.accentCyan,
      fontSize: FontSize.xs,
      fontFamily: Fonts.display,
    }),
  });
  title.position.set(PANEL_X + 16, PANEL_Y + 16);
  root.addChild(title);

  // Close button
  const closeBtn = makeCloseButton(PANEL_X + PANEL_W - 70, PANEL_Y + 16, () => {
    closeStashPanel();
  });
  root.addChild(closeBtn);

  // Gold display
  goldText = new Text({
    text: 'Gold: 0',
    style: new TextStyle({
      fill: Colors.accentGold,
      fontSize: FontSize.lg,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
    }),
  });
  goldText.position.set(PANEL_X + PANEL_W / 2 - 30, PANEL_Y + 16);
  root.addChild(goldText);

  // Stash section label
  const stashLabel = new Text({
    text: 'Stash (click to move to backpack)',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  stashLabel.position.set(PANEL_X + STASH_GRID_X, PANEL_Y + STASH_GRID_Y - 28);
  root.addChild(stashLabel);

  // Backpack section label
  const bpLabel = new Text({
    text: 'Backpack (click to stash)',
    style: new TextStyle({
      fill: Colors.textSecondary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
    }),
  });
  bpLabel.position.set(PANEL_X + BACKPACK_GRID_X, PANEL_Y + BACKPACK_GRID_Y - 28);
  root.addChild(bpLabel);

  // Feedback text
  feedbackText = new Text({
    text: '',
    style: new TextStyle({
      fill: Colors.accentRed,
      fontSize: FontSize.base,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
    }),
  });
  feedbackText.position.set(PANEL_X + PANEL_W / 2 - 80, PANEL_Y + PANEL_H - 32);
  feedbackText.visible = false;
  root.addChild(feedbackText);

  root.visible = false;
  staticChildCount = root.children.length;
  return root;
}

function refreshPanel(): void {
  if (!container) return;

  while (container.children.length > staticChildCount) {
    const child = container.children[container.children.length - 1];
    container.removeChild(child);
    child.destroy({ children: true });
  }

  if (goldText) {
    goldText.text = `Gold: ${getPlayerGold()}`;
  }

  // Tab buttons
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
      .fill({ color: isActive ? 0x1a2a4e : Colors.panelBg, alpha: 0.9 });
    if (isActive) {
      drawPixelBorder(btnBg, 0, 0, TAB_BTN_W, TAB_BTN_H, { borderWidth: 2, highlight: Colors.accentCyan, shadow: Colors.borderShadow });
    } else {
      btnBg.rect(0, 0, TAB_BTN_W, TAB_BTN_H).stroke({ width: 1, color: Colors.borderMid });
    }
    btnC.addChild(btnBg);

    const btnLabel = new Text({
      text: tab.name,
      style: new TextStyle({
        fill: isActive ? Colors.textPrimary : Colors.textMuted,
        fontSize: FontSize.sm,
        fontFamily: Fonts.display,
        fontWeight: isActive ? 'bold' : 'normal',
      }),
    });
    btnLabel.position.set(10, 9);
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

  // Buy Tab button
  if (stash.canPurchaseTab()) {
    const cost = stash.getNextTabCost();
    const bx = PANEL_X + TAB_BTN_X + stash.tabs.length * (TAB_BTN_W + TAB_BTN_GAP);
    const by = PANEL_Y + TAB_BTN_Y;

    const buyC = new Container();
    buyC.position.set(bx, by);

    const buyBg = new Graphics();
    buyBg.rect(0, 0, TAB_BTN_W + 10, TAB_BTN_H).fill({ color: 0x1a2e1a, alpha: 0.9 });
    buyBg.rect(0, 0, TAB_BTN_W + 10, TAB_BTN_H).stroke({ width: 2, color: Colors.accentLime });
    buyC.addChild(buyBg);

    const buyLabel = new Text({
      text: `+ ${cost}g`,
      style: new TextStyle({
        fill: Colors.accentLime,
        fontSize: FontSize.sm,
        fontFamily: Fonts.body,
        fontWeight: 'bold',
      }),
    });
    buyLabel.position.set(8, 5);
    buyC.addChild(buyLabel);

    buyBg.eventMode = 'static';
    buyBg.cursor = 'pointer';
    buyBg.on('pointertap', () => {
      const gold = getPlayerGold();
      const tabCost = stash.getNextTabCost();
      if (tabCost === -1) {
        showFeedback('Max tabs reached!', Colors.accentRed);
        return;
      }
      if (gold < tabCost) {
        showFeedback('Not enough gold!', Colors.accentRed);
        return;
      }
      setPlayerGold(gold - tabCost);
      stash.purchaseTab();
      stash.activeTab = stash.tabs.length - 1;
      showFeedback(`Purchased Tab ${stash.tabs.length}!`, Colors.accentLime);
      hideTooltip();
      refreshPanel();
    });

    container.addChild(buyC);
  }

  // Search bar
  const searchC = new Container();
  searchC.position.set(PANEL_X + SEARCH_BAR_X, PANEL_Y + SEARCH_BAR_Y);

  const searchBg = new Graphics();
  searchBg
    .rect(0, 0, SEARCH_BAR_W, SEARCH_BAR_H)
    .fill({ color: Colors.slotBg, alpha: 0.9 });
  searchBg.rect(0, 0, SEARCH_BAR_W, SEARCH_BAR_H).stroke({ width: 2, color: Colors.borderMid });
  searchC.addChild(searchBg);

  const searchLabel = new Text({
    text: searchQuery ? `Search: ${searchQuery}` : 'Search: (type to filter)',
    style: new TextStyle({
      fill: searchQuery ? Colors.textPrimary : Colors.textMuted,
      fontSize: FontSize.base,
      fontFamily: Fonts.body,
    }),
  });
  searchLabel.position.set(4, 4);
  searchC.addChild(searchLabel);

  searchBg.eventMode = 'static';
  searchBg.cursor = 'pointer';
  searchBg.on('pointertap', () => {
    if (searchQuery) {
      searchQuery = '';
      refreshPanel();
    }
  });

  container.addChild(searchC);

  // Sort button
  const sortC = new Container();
  sortC.position.set(PANEL_X + SORT_BTN_X, PANEL_Y + SORT_BTN_Y);

  const sortBg = new Graphics();
  sortBg.rect(0, 0, SORT_BTN_W, SORT_BTN_H).fill({ color: Colors.panelBg, alpha: 0.9 });
  sortBg.rect(0, 0, SORT_BTN_W, SORT_BTN_H).stroke({ width: 2, color: Colors.accentGold });
  sortC.addChild(sortBg);

  const sortLabel = new Text({
    text: 'Sort',
    style: new TextStyle({
      fill: Colors.accentGold,
      fontSize: FontSize.sm,
      fontFamily: Fonts.body,
      fontWeight: 'bold',
    }),
  });
  sortLabel.position.set(22, 5);
  sortC.addChild(sortLabel);

  sortBg.eventMode = 'static';
  sortBg.cursor = 'pointer';
  sortBg.on('pointertap', () => {
    sortStashTab();
    showFeedback('Sorted!', Colors.accentGold);
    hideTooltip();
    refreshPanel();
  });

  container.addChild(sortC);

  // Stash grid (active tab)
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

        const matchSearch = item ? matchesSearch(item) : true;

        if (item && matchSearch) {
          const color = getRarityColor(item.rarity);
          drawSlotBg(slotBg, 0, 0, SLOT_SIZE, color);
          slotC.addChild(slotBg);

          const nameText = new Text({
            text: abbreviate(item.name, 12),
            style: new TextStyle({
              fill: color,
              fontSize: FontSize.sm,
              fontFamily: Fonts.body,
              fontWeight: 'bold',
            }),
          });
          nameText.position.set(3, 3);
          slotC.addChild(nameText);

          const slotIcon = new Text({
            text: SLOT_NAME_MAP[item.slot].slice(0, 3),
            style: new TextStyle({
              fill: Colors.textMuted,
              fontSize: FontSize.xs,
              fontFamily: Fonts.body,
            }),
          });
          slotIcon.position.set(3, 54);
          slotC.addChild(slotIcon);

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
              showItemTooltipWithCompare(stashItem, e.globalX, e.globalY, 'Click to move to backpack');
            }
          });
          slotBg.on('pointermove', (e: FederatedPointerEvent) => {
            const stashItem = stash.getTab(tabIdx)?.items[stashIdx];
            if (stashItem) {
              showItemTooltipWithCompare(stashItem, e.globalX, e.globalY, 'Click to move to backpack');
            }
          });
          slotBg.on('pointerout', () => hideTooltip());
        } else if (item && !matchSearch) {
          slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: Colors.slotBg, alpha: 0.4 });
          slotBg.rect(0, 0, SLOT_SIZE, SLOT_SIZE).stroke({ width: 1, color: 0x222233 });
          slotC.addChild(slotBg);
        } else {
          drawSlotBg(slotBg, 0, 0, SLOT_SIZE);
          slotC.addChild(slotBg);
        }

        container.addChild(slotC);
      }
    }
  }

  // Player backpack (for transfer)
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
        drawSlotBg(slotBg, 0, 0, SLOT_SIZE, color);
        slotC.addChild(slotBg);

        const nameText = new Text({
          text: abbreviate(item.name, 12),
          style: new TextStyle({
            fill: color,
            fontSize: FontSize.sm,
            fontFamily: Fonts.body,
            fontWeight: 'bold',
          }),
        });
        nameText.position.set(3, 3);
        slotC.addChild(nameText);

        const slotIcon = new Text({
          text: SLOT_NAME_MAP[item.slot].slice(0, 3),
          style: new TextStyle({
            fill: Colors.textMuted,
            fontSize: FontSize.xs,
            fontFamily: Fonts.body,
          }),
        });
        slotIcon.position.set(3, 54);
        slotC.addChild(slotIcon);

        slotBg.eventMode = 'static';
        slotBg.cursor = 'pointer';
        const bpIdx = idx;
        slotBg.on('pointertap', () => {
          moveBackpackToStash(bpIdx);
        });
        slotBg.on('pointerover', (e: FederatedPointerEvent) => {
          const bpItem = inventory.backpack[bpIdx];
          if (bpItem) {
            showItemTooltipWithCompare(bpItem, e.globalX, e.globalY, 'Click to move to stash');
          }
        });
        slotBg.on('pointermove', (e: FederatedPointerEvent) => {
          const bpItem = inventory.backpack[bpIdx];
          if (bpItem) {
            showItemTooltipWithCompare(bpItem, e.globalX, e.globalY, 'Click to move to stash');
          }
        });
        slotBg.on('pointerout', () => hideTooltip());
      } else {
        drawSlotBg(slotBg, 0, 0, SLOT_SIZE);
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
    showFeedback('Backpack full!', Colors.accentRed);
    return;
  }

  tab.items[slotIndex] = null;
  showFeedback(`Moved ${item.name} to backpack`, Colors.accentLime);
  hideTooltip();
  refreshPanel();
}

function moveBackpackToStash(backpackIndex: number): void {
  const item = inventory.backpack[backpackIndex];
  if (!item) return;

  const added = stash.addItem(item);
  if (!added) {
    showFeedback('Stash tab full!', Colors.accentRed);
    return;
  }

  inventory.backpack[backpackIndex] = null;
  showFeedback(`Stashed ${item.name}`, Colors.accentLime);
  hideTooltip();
  refreshPanel();
}

// --- Key input handling for search ---

let keyListener: ((e: KeyboardEvent) => void) | null = null;

function attachKeyListener(): void {
  if (keyListener) return;
  InputManager.instance.textInputActive = true;
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

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
  InputManager.instance.textInputActive = false;
}

// --- Public API ---

export function updateStashPanel(): void {
  const input = InputManager.instance;
  const escDown = input.isPressed('Escape');

  if (escDown && !prevEscPressed && visible) {
    closeStashPanel();
  }
  prevEscPressed = escDown;

  if (feedbackTimer > 0) {
    feedbackTimer -= 1 / 60;
    if (feedbackTimer <= 0 && feedbackText) {
      feedbackText.visible = false;
    }
  }

  if (visible && goldText) {
    goldText.text = `Gold: ${getPlayerGold()}`;
  }
}

export function isStashOpen(): boolean {
  return visible;
}

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

export function closeStashPanel(): void {
  visible = false;
  if (container) {
    container.visible = false;
  }
  searchQuery = '';
  detachKeyListener();
  hideTooltip();
}
