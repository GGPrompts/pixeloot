import { db, type SaveSlot, type PlayerStateData, type ClassStateData, type InventoryData, type WorldStateData, type StashData } from './Database';
import { world } from '../ecs/world';
import { inventory } from '../core/Inventory';
import { stash } from '../core/Stash';
import { skillSystem } from '../core/SkillSystem';
import { game } from '../Game';
import { getClassSkillsByName } from '../ui/ClassSelect';
import type { EquipSlots } from '../core/Inventory';
import type { BaseItem } from '../loot/ItemTypes';
import { markStatsDirty, applyComputedToEntity, setPlayerStats } from '../core/ComputedStats';
import { applyStatEffects } from '../ecs/systems/StatEffects';

const AUTOSAVE_NAME = '__autosave__';

// ---- Gather state from live game ----

function getPlayerEntity() {
  const players = world.with('player', 'level', 'xp', 'statPoints', 'stats', 'gold', 'health');
  return players.entities[0] ?? null;
}

// ---- Helpers: build class state from current game ----

function buildCurrentClassState(saveId: number): ClassStateData {
  const player = getPlayerEntity();
  if (!player) throw new Error('No player entity found');

  const classType = skillSystem.activeClass || 'Unknown';
  const rmbSlot = skillSystem.getSlot('rmb');
  const eSlot = skillSystem.getSlot('e');
  const gearState = inventory.getGearState();

  return {
    saveId,
    classType,
    level: player.level ?? 1,
    xp: player.xp ?? 0,
    statPoints: player.statPoints ?? 0,
    stats: { ...player.stats! },
    health: { current: player.health!.current, max: player.health!.max },
    equipped: gearState.equipped as Record<keyof EquipSlots, BaseItem | null>,
    backpack: gearState.backpack,
    rmbSkillName: rmbSlot?.def.name,
    eSkillName: eSlot?.def.name,
  };
}

function createFreshClassState(saveId: number, classType: string): ClassStateData {
  const emptyEquipped: Record<keyof EquipSlots, BaseItem | null> = {
    weapon: null, helmet: null, chest: null, boots: null,
    ring1: null, ring2: null, amulet: null, offhand: null,
  };
  return {
    saveId,
    classType,
    level: 1,
    xp: 0,
    statPoints: 0,
    stats: { dexterity: 0, intelligence: 0, vitality: 0, focus: 0 },
    health: { current: 100, max: 100 },
    equipped: emptyEquipped,
    backpack: new Array(20).fill(null),
  };
}

/** Apply a ClassStateData to the live player entity and inventory. */
function applyClassState(classData: ClassStateData): void {
  const player = getPlayerEntity();
  if (!player) throw new Error('No player entity to restore');

  // Restore player entity properties
  player.level = classData.level;
  player.xp = classData.xp;
  player.statPoints = classData.statPoints;
  player.stats!.dexterity = classData.stats.dexterity;
  player.stats!.intelligence = classData.stats.intelligence;
  player.stats!.vitality = classData.stats.vitality;
  player.stats!.focus = classData.stats.focus;
  player.health!.current = classData.health.current;
  player.health!.max = classData.health.max;

  // Restore class skills
  const classSkills = getClassSkillsByName(classData.classType);
  if (classSkills) {
    skillSystem.setClass(classSkills, classData.classType);
  }

  // Restore skill assignments
  if (classData.rmbSkillName) {
    skillSystem.assignSkillByName('rmb', classData.rmbSkillName);
  }
  if (classData.eSkillName) {
    skillSystem.assignSkillByName('e', classData.eSkillName);
  }

  // Restore gear
  inventory.setGearState({
    equipped: classData.equipped as EquipSlots,
    backpack: classData.backpack,
  });

  // Sync computed stats
  setPlayerStats(player.stats!);
  markStatsDirty();
  applyStatEffects(player as Parameters<typeof applyStatEffects>[0]);
}

// ---- Public API ----

/**
 * Save current game state to a named slot.
 * If a save with the same name exists, it is overwritten.
 */
export async function saveGame(slotName?: string): Promise<void> {
  const name = slotName ?? `Save ${new Date().toLocaleString()}`;
  const player = getPlayerEntity();
  if (!player) throw new Error('No player entity found');

  const classType = skillSystem.activeClass || 'Unknown';

  // Delete existing save with same name (for overwrite / autosave)
  const existing = await db.saves.where('name').equals(name).first();
  if (existing?.id != null) {
    await deleteSave(existing.id);
  }

  const saveSlot: SaveSlot = {
    name,
    timestamp: Date.now(),
    classType,
    level: player.level ?? 1,
  };

  const saveId = await db.saves.add(saveSlot) as number;

  // Shared state
  const playerState: PlayerStateData = {
    saveId,
    gold: player.gold ?? 0,
    classType,
    maps: [...inventory.maps],
    gems: [...inventory.gems],
  };

  // Current class state
  const classState = buildCurrentClassState(saveId);

  // Also grab any other class states from staging (saveId=0) for classes not currently active
  const STAGING_SAVE_ID = 0;
  const otherClassStates = await db.classState
    .where('saveId').equals(STAGING_SAVE_ID)
    .toArray();

  // Legacy inventory data (for backward compat with v2 saves, not used on load for v3+)
  const inventoryData: InventoryData = {
    saveId,
    equipped: { ...inventory.equipped } as Record<keyof EquipSlots, BaseItem | null>,
    backpack: [...inventory.backpack],
    maps: [...inventory.maps],
    gems: [...inventory.gems],
  };

  const worldState: WorldStateData = {
    saveId,
    waveNumber: game.waveSystem.currentWave,
  };

  const stashData: StashData = {
    saveId,
    stash: stash.serialize(),
  };

  const promises: Promise<unknown>[] = [
    db.playerState.add(playerState),
    db.classState.add(classState),
    db.inventoryState.add(inventoryData),
    db.worldState.add(worldState),
    db.stashState.add(stashData),
  ];

  // Save other class states (non-active classes) into this save slot
  for (const other of otherClassStates) {
    if (other.classType !== classType) {
      const copy = { ...other, saveId };
      delete copy.id; // let auto-increment assign a new id
      promises.push(db.classState.add(copy));
    }
  }

  await Promise.all(promises);
}

/**
 * Load game state from a save slot by ID.
 * Restores player entity, inventory, class, and wave number.
 */
export async function loadGame(saveId: number): Promise<void> {
  const [playerState, inventoryData, worldState, stashData] = await Promise.all([
    db.playerState.get(saveId),
    db.inventoryState.get(saveId),
    db.worldState.get(saveId),
    db.stashState.get(saveId),
  ]);

  if (!playerState) throw new Error(`No player state for save ${saveId}`);

  // Restore player entity
  const player = getPlayerEntity();
  if (!player) throw new Error('No player entity to restore');

  // Restore shared state
  player.gold = playerState.gold;
  inventory.maps = playerState.maps ?? (inventoryData?.maps ?? []);
  inventory.gems = playerState.gems ?? (inventoryData?.gems ?? []);

  // Try loading per-class state (v3+)
  const classData = await db.classState
    .where('[saveId+classType]')
    .equals([saveId, playerState.classType])
    .first();

  if (classData) {
    // v3 save: use per-class data
    applyClassState(classData);
  } else {
    // Legacy v1/v2 save: use old flat structure
    // playerState may still have the old fields via the raw DB record
    const rawPlayer = playerState as unknown as Record<string, unknown>;

    player.level = (rawPlayer['level'] as number) ?? 1;
    player.xp = (rawPlayer['xp'] as number) ?? 0;
    player.statPoints = (rawPlayer['statPoints'] as number) ?? 0;

    const savedStats = rawPlayer['stats'] as { dexterity: number; intelligence: number; vitality: number; focus: number } | undefined;
    if (savedStats) {
      player.stats!.dexterity = savedStats.dexterity;
      player.stats!.intelligence = savedStats.intelligence;
      player.stats!.vitality = savedStats.vitality;
      player.stats!.focus = savedStats.focus;
    }

    const savedHealth = rawPlayer['health'] as { current: number; max: number } | undefined;
    if (savedHealth) {
      player.health!.current = savedHealth.current;
      player.health!.max = savedHealth.max;
    }

    // Restore class
    const classSkills = getClassSkillsByName(playerState.classType);
    if (classSkills) {
      skillSystem.setClass(classSkills, playerState.classType);
    }

    // Restore skill assignments from legacy data
    const rmbSkillName = rawPlayer['rmbSkillName'] as string | undefined;
    const eSkillName = rawPlayer['eSkillName'] as string | undefined;
    if (rmbSkillName) {
      skillSystem.assignSkillByName('rmb', rmbSkillName);
    }
    if (eSkillName) {
      skillSystem.assignSkillByName('e', eSkillName);
    }

    // Restore inventory from legacy data
    if (inventoryData) {
      const equipKeys = Object.keys(inventory.equipped) as (keyof EquipSlots)[];
      for (const key of equipKeys) {
        inventory.equipped[key] = inventoryData.equipped[key] ?? null;
      }
      for (let i = 0; i < inventory.backpack.length; i++) {
        inventory.backpack[i] = inventoryData.backpack[i] ?? null;
      }
    }

    // Sync stats
    setPlayerStats(player.stats!);
    markStatsDirty();
    applyStatEffects(player as Parameters<typeof applyStatEffects>[0]);
  }

  // Restore wave number
  if (worldState) {
    game.waveSystem.currentWave = worldState.waveNumber;
  }

  // Restore stash
  if (stashData) {
    stash.deserialize(stashData.stash);
  }

  // Copy all class states from this save into staging (saveId=0) so switchClass works
  const STAGING_SAVE_ID = 0;
  // Clear old staging data
  await db.classState.where('saveId').equals(STAGING_SAVE_ID).delete();
  // Copy all class states from the loaded save to staging
  const allClassStates = await db.classState.where('saveId').equals(saveId).toArray();
  for (const cs of allClassStates) {
    const copy = { ...cs, saveId: STAGING_SAVE_ID };
    delete copy.id;
    await db.classState.add(copy);
  }
}

/**
 * Switch the active class. Saves current class state, loads (or creates) target class state.
 * Gold, maps, gems, stash, wave number are shared and unaffected.
 */
export async function switchClass(targetClass: string): Promise<void> {
  const player = getPlayerEntity();
  if (!player) throw new Error('No player entity found');

  const currentClass = skillSystem.activeClass;

  // If switching to the same class, nothing to do
  if (currentClass === targetClass) return;

  // We use saveId=0 as an in-memory staging area for class state between save/loads.
  // This works because real saves always have saveId >= 1 (auto-increment).
  const STAGING_SAVE_ID = 0;

  // Save current class state (if we have a current class)
  if (currentClass) {
    const currentState = buildCurrentClassState(STAGING_SAVE_ID);

    // Upsert: delete old staging entry for this class, then add new one
    const existing = await db.classState
      .where('[saveId+classType]')
      .equals([STAGING_SAVE_ID, currentClass])
      .first();
    if (existing?.id != null) {
      await db.classState.delete(existing.id);
    }
    await db.classState.add(currentState);
  }

  // Clear current gear before loading new class
  inventory.clearGear();

  // Load target class state (or create fresh)
  const targetData = await db.classState
    .where('[saveId+classType]')
    .equals([STAGING_SAVE_ID, targetClass])
    .first();

  if (targetData) {
    applyClassState(targetData);
  } else {
    // First time playing this class: create fresh level 1
    const freshState = createFreshClassState(STAGING_SAVE_ID, targetClass);
    applyClassState(freshState);
  }
}

/** List all save slots, most recent first. */
export async function listSaves(): Promise<SaveSlot[]> {
  return db.saves.orderBy('timestamp').reverse().toArray();
}

/** Delete a save and all associated data. */
export async function deleteSave(saveId: number): Promise<void> {
  await Promise.all([
    db.saves.delete(saveId),
    db.playerState.delete(saveId),
    db.inventoryState.delete(saveId),
    db.worldState.delete(saveId),
    db.stashState.delete(saveId),
    db.classState.where('saveId').equals(saveId).delete(),
  ]);
}

/** Export a save as a JSON string. */
export async function exportSave(saveId: number): Promise<string> {
  const [slot, playerState, inventoryData, worldState, stashData, classStates] = await Promise.all([
    db.saves.get(saveId),
    db.playerState.get(saveId),
    db.inventoryState.get(saveId),
    db.worldState.get(saveId),
    db.stashState.get(saveId),
    db.classState.where('saveId').equals(saveId).toArray(),
  ]);

  if (!slot) throw new Error(`Save ${saveId} not found`);

  return JSON.stringify({ slot, playerState, inventoryData, worldState, stashData, classStates }, null, 2);
}

/** Import a save from a JSON string. */
export async function importSave(json: string): Promise<void> {
  const data = JSON.parse(json) as {
    slot: SaveSlot;
    playerState: PlayerStateData;
    inventoryData: InventoryData;
    worldState: WorldStateData;
    stashData?: StashData;
    classStates?: ClassStateData[];
  };

  // Strip old id so a new one is assigned
  delete data.slot.id;
  data.slot.timestamp = Date.now();

  const saveId = (await db.saves.add(data.slot)) as number;

  data.playerState.saveId = saveId;
  data.inventoryData.saveId = saveId;
  data.worldState.saveId = saveId;

  const promises: Promise<unknown>[] = [
    db.playerState.add(data.playerState),
    db.inventoryState.add(data.inventoryData),
    db.worldState.add(data.worldState),
  ];

  if (data.stashData) {
    data.stashData.saveId = saveId;
    promises.push(db.stashState.add(data.stashData));
  }

  if (data.classStates) {
    for (const cs of data.classStates) {
      delete cs.id;
      cs.saveId = saveId;
      promises.push(db.classState.add(cs));
    }
  }

  await Promise.all(promises);
}

/** Auto-save to the special autosave slot. */
export async function autoSave(): Promise<void> {
  await saveGame(AUTOSAVE_NAME);
}

/** Check if an autosave exists. Returns the SaveSlot or null. */
export async function getAutoSave(): Promise<SaveSlot | null> {
  const slot = await db.saves.where('name').equals(AUTOSAVE_NAME).first();
  return slot ?? null;
}

export { AUTOSAVE_NAME };
