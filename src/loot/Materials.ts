export interface MaterialInventory {
  scrap: number;    // from Normal items
  essence: number;  // from Magic items
  crystal: number;  // from Rare items
  prism: number;    // from Unique items
}

export type MaterialType = keyof MaterialInventory;

/** Display names for materials */
export const MATERIAL_NAMES: Record<MaterialType, string> = {
  scrap: 'Scrap',
  essence: 'Essence',
  crystal: 'Crystal',
  prism: 'Prism',
};

/** Display colors for materials */
export const MATERIAL_COLORS: Record<MaterialType, number> = {
  scrap: 0xcccccc,
  essence: 0x4488ff,
  crystal: 0xffff00,
  prism: 0xff8800,
};

class MaterialStore {
  private _inventory: MaterialInventory = {
    scrap: 0,
    essence: 0,
    crystal: 0,
    prism: 0,
  };

  get inventory(): Readonly<MaterialInventory> {
    return this._inventory;
  }

  add(material: MaterialType, amount: number): void {
    this._inventory[material] += amount;
  }

  /** Spend materials. Returns false if insufficient. */
  spend(cost: Partial<Record<MaterialType, number>>): boolean {
    // Check availability first
    for (const [mat, amount] of Object.entries(cost)) {
      if (this._inventory[mat as MaterialType] < (amount ?? 0)) {
        return false;
      }
    }
    // Deduct
    for (const [mat, amount] of Object.entries(cost)) {
      this._inventory[mat as MaterialType] -= amount ?? 0;
    }
    return true;
  }

  has(cost: Partial<Record<MaterialType, number>>): boolean {
    for (const [mat, amount] of Object.entries(cost)) {
      if (this._inventory[mat as MaterialType] < (amount ?? 0)) {
        return false;
      }
    }
    return true;
  }

  /** Reset all materials (for save/load). */
  reset(): void {
    this._inventory.scrap = 0;
    this._inventory.essence = 0;
    this._inventory.crystal = 0;
    this._inventory.prism = 0;
  }

  /** Set materials directly (for loading saves). */
  set(data: MaterialInventory): void {
    this._inventory.scrap = data.scrap;
    this._inventory.essence = data.essence;
    this._inventory.crystal = data.crystal;
    this._inventory.prism = data.prism;
  }
}

/** Singleton material store */
export const materials = new MaterialStore();
