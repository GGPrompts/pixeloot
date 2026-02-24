import { BaseItem, Rarity, Slot } from '../loot/ItemTypes';

export interface LootFilterConfig {
  showNormal: boolean;
  showMagic: boolean;
  showRare: boolean;
  showUnique: boolean;
  showWeapons: boolean;
  showArmor: boolean;     // helmet, chest, boots
  showJewelry: boolean;   // ring, amulet
}

export type FilterPreset = 'all' | 'rare+' | 'magic+';

const ARMOR_SLOTS = new Set([Slot.Helmet, Slot.Chest, Slot.Boots]);
const JEWELRY_SLOTS = new Set([Slot.Ring, Slot.Amulet]);

const PRESET_ORDER: FilterPreset[] = ['all', 'rare+', 'magic+'];
const PRESET_LABELS: Record<FilterPreset, string> = {
  'all': 'All Items',
  'rare+': 'Rare+ Only',
  'magic+': 'Magic+ Only',
};

class LootFilter {
  public config: LootFilterConfig = {
    showNormal: true,
    showMagic: true,
    showRare: true,
    showUnique: true,
    showWeapons: true,
    showArmor: true,
    showJewelry: true,
  };

  private currentPresetIndex = 0;

  /** Listeners notified when any filter value changes. */
  private listeners: Array<() => void> = [];

  shouldShowItem(item: BaseItem): boolean {
    // Rarity check
    switch (item.rarity) {
      case Rarity.Normal:
        if (!this.config.showNormal) return false;
        break;
      case Rarity.Magic:
        if (!this.config.showMagic) return false;
        break;
      case Rarity.Rare:
        if (!this.config.showRare) return false;
        break;
      case Rarity.Unique:
        if (!this.config.showUnique) return false;
        break;
    }

    // Slot/type check
    if (item.slot === Slot.Weapon && !this.config.showWeapons) return false;
    if (ARMOR_SLOTS.has(item.slot) && !this.config.showArmor) return false;
    if (JEWELRY_SLOTS.has(item.slot) && !this.config.showJewelry) return false;

    return true;
  }

  toggleFilter(key: keyof LootFilterConfig): void {
    this.config[key] = !this.config[key];
    this.notify();
  }

  /** Cycle through filter presets. Returns the label of the new preset. */
  cyclePreset(): string {
    this.currentPresetIndex = (this.currentPresetIndex + 1) % PRESET_ORDER.length;
    const preset = PRESET_ORDER[this.currentPresetIndex];
    this.applyPreset(preset);
    return PRESET_LABELS[preset];
  }

  private applyPreset(preset: FilterPreset): void {
    switch (preset) {
      case 'all':
        this.config.showNormal = true;
        this.config.showMagic = true;
        this.config.showRare = true;
        this.config.showUnique = true;
        this.config.showWeapons = true;
        this.config.showArmor = true;
        this.config.showJewelry = true;
        break;
      case 'rare+':
        this.config.showNormal = false;
        this.config.showMagic = false;
        this.config.showRare = true;
        this.config.showUnique = true;
        this.config.showWeapons = true;
        this.config.showArmor = true;
        this.config.showJewelry = true;
        break;
      case 'magic+':
        this.config.showNormal = false;
        this.config.showMagic = true;
        this.config.showRare = true;
        this.config.showUnique = true;
        this.config.showWeapons = true;
        this.config.showArmor = true;
        this.config.showJewelry = true;
        break;
    }
    this.notify();
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export const lootFilter = new LootFilter();
