/**
 * Shared stash storage system.
 *
 * Provides multiple tabs of item storage (4x6 = 24 slots per tab).
 * Players start with 1 tab and can purchase up to 4 more with escalating gold costs.
 */

import type { BaseItem } from '../loot/ItemTypes';

const SLOTS_PER_TAB = 24; // 4 columns x 6 rows
const MAX_TABS = 5;
const TAB_COSTS = [100, 250, 500, 1000]; // cost for tabs 2, 3, 4, 5

export interface StashTab {
  name: string;
  items: (BaseItem | null)[];
}

export class Stash {
  tabs: StashTab[];
  activeTab: number;

  constructor() {
    this.tabs = [this.createTab('Tab 1')];
    this.activeTab = 0;
  }

  private createTab(name: string): StashTab {
    return {
      name,
      items: new Array(SLOTS_PER_TAB).fill(null),
    };
  }

  /** Add an item to the first empty slot in the active tab. Returns false if full. */
  addItem(item: BaseItem): boolean {
    const tab = this.tabs[this.activeTab];
    if (!tab) return false;
    const emptyIdx = tab.items.indexOf(null);
    if (emptyIdx === -1) return false;
    tab.items[emptyIdx] = item;
    return true;
  }

  /** Remove and return an item from a specific tab and slot. */
  removeItem(tabIndex: number, slotIndex: number): BaseItem | null {
    const tab = this.tabs[tabIndex];
    if (!tab || slotIndex < 0 || slotIndex >= SLOTS_PER_TAB) return null;
    const item = tab.items[slotIndex];
    tab.items[slotIndex] = null;
    return item;
  }

  /** Get a tab by index. */
  getTab(index: number): StashTab | null {
    return this.tabs[index] ?? null;
  }

  /** Get the cost of the next tab, or -1 if max tabs reached. */
  getNextTabCost(): number {
    const nextIdx = this.tabs.length; // 1-indexed: tab 2 costs TAB_COSTS[0]
    if (nextIdx >= MAX_TABS) return -1;
    return TAB_COSTS[nextIdx - 1];
  }

  /** Purchase a new tab. Returns the gold cost, or -1 if cannot purchase.
   *  Caller is responsible for checking/deducting gold. */
  purchaseTab(): number {
    const cost = this.getNextTabCost();
    if (cost === -1) return -1;
    const tabNum = this.tabs.length + 1;
    this.tabs.push(this.createTab(`Tab ${tabNum}`));
    return cost;
  }

  /** Check if more tabs can be purchased. */
  canPurchaseTab(): boolean {
    return this.tabs.length < MAX_TABS;
  }

  /** Serialize stash data for saving. */
  serialize(): StashSaveData {
    return {
      activeTab: this.activeTab,
      tabs: this.tabs.map((t) => ({
        name: t.name,
        items: [...t.items],
      })),
    };
  }

  /** Restore stash from save data. */
  deserialize(data: StashSaveData): void {
    this.activeTab = data.activeTab;
    this.tabs = data.tabs.map((t) => ({
      name: t.name,
      items: [...t.items],
    }));
    // Ensure each tab has exactly SLOTS_PER_TAB slots
    for (const tab of this.tabs) {
      while (tab.items.length < SLOTS_PER_TAB) {
        tab.items.push(null);
      }
    }
  }
}

export interface StashSaveData {
  activeTab: number;
  tabs: { name: string; items: (BaseItem | null)[] }[];
}

/** Singleton stash instance. */
export const stash = new Stash();
