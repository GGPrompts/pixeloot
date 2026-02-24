import { db, type SaveSlot, type PlayerStateData, type InventoryData, type WorldStateData, type StashData } from './Database';
import { world } from '../ecs/world';
import { inventory } from '../core/Inventory';
import { stash } from '../core/Stash';
import { skillSystem } from '../core/SkillSystem';
import { game } from '../Game';
import { getClassSkillsByName } from '../ui/ClassSelect';
import type { EquipSlots } from '../core/Inventory';
import type { BaseItem } from '../loot/ItemTypes';

const AUTOSAVE_NAME = '__autosave__';

// ---- Gather state from live game ----

function getPlayerEntity() {
  const players = world.with('player', 'level', 'xp', 'statPoints', 'stats', 'gold', 'health');
  return players.entities[0] ?? null;
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

  const saveId = await db.saves.add(saveSlot);

  const rmbSlot = skillSystem.getSlot('rmb');
  const eSlot = skillSystem.getSlot('e');

  const playerState: PlayerStateData = {
    saveId: saveId as number,
    level: player.level ?? 1,
    xp: player.xp ?? 0,
    statPoints: player.statPoints ?? 0,
    stats: { ...player.stats! },
    gold: player.gold ?? 0,
    health: { current: player.health!.current, max: player.health!.max },
    classType,
    rmbSkillName: rmbSlot?.def.name,
    eSkillName: eSlot?.def.name,
  };

  const inventoryData: InventoryData = {
    saveId: saveId as number,
    equipped: { ...inventory.equipped } as Record<keyof EquipSlots, BaseItem | null>,
    backpack: [...inventory.backpack],
  };

  const worldState: WorldStateData = {
    saveId: saveId as number,
    waveNumber: game.waveSystem.currentWave,
  };

  const stashData: StashData = {
    saveId: saveId as number,
    stash: stash.serialize(),
  };

  await Promise.all([
    db.playerState.add(playerState),
    db.inventoryState.add(inventoryData),
    db.worldState.add(worldState),
    db.stashState.add(stashData),
  ]);
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

  player.level = playerState.level;
  player.xp = playerState.xp;
  player.statPoints = playerState.statPoints;
  player.stats!.dexterity = playerState.stats.dexterity;
  player.stats!.intelligence = playerState.stats.intelligence;
  player.stats!.vitality = playerState.stats.vitality;
  player.stats!.focus = playerState.stats.focus;
  player.gold = playerState.gold;
  player.health!.current = playerState.health.current;
  player.health!.max = playerState.health.max;

  // Restore class
  const classSkills = getClassSkillsByName(playerState.classType);
  if (classSkills) {
    skillSystem.setClass(classSkills, playerState.classType);
  }

  // Restore skill assignments (backward compatible — missing fields use defaults)
  if (playerState.rmbSkillName) {
    skillSystem.assignSkillByName('rmb', playerState.rmbSkillName);
  }
  if (playerState.eSkillName) {
    skillSystem.assignSkillByName('e', playerState.eSkillName);
  }

  // Restore inventory
  if (inventoryData) {
    const equipKeys = Object.keys(inventory.equipped) as (keyof EquipSlots)[];
    for (const key of equipKeys) {
      inventory.equipped[key] = inventoryData.equipped[key] ?? null;
    }
    for (let i = 0; i < inventory.backpack.length; i++) {
      inventory.backpack[i] = inventoryData.backpack[i] ?? null;
    }
  }

  // Restore wave number
  if (worldState) {
    game.waveSystem.currentWave = worldState.waveNumber;
  }

  // Restore stash
  if (stashData) {
    stash.deserialize(stashData.stash);
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
  ]);
}

/** Export a save as a JSON string. */
export async function exportSave(saveId: number): Promise<string> {
  const [slot, playerState, inventoryData, worldState, stashData] = await Promise.all([
    db.saves.get(saveId),
    db.playerState.get(saveId),
    db.inventoryState.get(saveId),
    db.worldState.get(saveId),
    db.stashState.get(saveId),
  ]);

  if (!slot) throw new Error(`Save ${saveId} not found`);

  return JSON.stringify({ slot, playerState, inventoryData, worldState, stashData }, null, 2);
}

/** Import a save from a JSON string. */
export async function importSave(json: string): Promise<void> {
  const data = JSON.parse(json) as {
    slot: SaveSlot;
    playerState: PlayerStateData;
    inventoryData: InventoryData;
    worldState: WorldStateData;
    stashData?: StashData;
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
