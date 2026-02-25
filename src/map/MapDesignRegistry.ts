/**
 * Map Design Registry
 *
 * Runtime-usable layout configurations derived from designs/maps.ts.
 * Each entry contains the post-processing config needed by MapPostProcessor.
 */

import type { MapDesignConfig } from './MapPostProcessor';
import {
  TILE_PILLAR, TILE_CRACKED_FLOOR, TILE_PIT,
  TILE_SLOW_GROUND, TILE_DESTRUCTIBLE, TILE_BRIDGE, TILE_FLOOR,
} from './TileMap';

// ── Registry ──────────────────────────────────────────────────────

export const MAP_DESIGN_REGISTRY: MapDesignConfig[] = [

  // 1. Standard Dungeon
  {
    id: 'standard_dungeon',
    postProcessing: {
      diggerOverrides: {},
      corridorWidth: 3,
      steps: [],
    },
    roomPatterns: [
      { name: 'Small Chamber', widthRange: [6, 9], heightRange: [6, 8], shape: 'rectangle', weight: 0.4 },
      { name: 'Hall', widthRange: [10, 16], heightRange: [6, 8], shape: 'rectangle', weight: 0.35 },
      { name: 'Large Room', widthRange: [10, 16], heightRange: [9, 12], shape: 'rectangle', weight: 0.25 },
    ],
    environmentalFeatures: [
      { name: 'Stone Pillar', tileType: TILE_PILLAR, placement: 'room-center', countPerRoom: [0, 2] },
    ],
    specialRooms: [
      { name: 'Boss Chamber', minWidth: 14, minHeight: 10, selectionRule: 'farthest-from-spawn', modifications: '', purpose: '' },
    ],
  },

  // 2. Arena Gauntlet — large rooms, short corridors, minimal branching
  {
    id: 'arena_gauntlet',
    postProcessing: {
      diggerOverrides: { roomWidth: [12, 20], roomHeight: [9, 14], corridorLength: [2, 4] },
      corridorWidth: 2,
      steps: [],
    },
    roomPatterns: [
      { name: 'Arena', widthRange: [14, 16], heightRange: [10, 12], shape: 'rectangle', weight: 0.7 },
      { name: 'Small Connector', widthRange: [6, 8], heightRange: [6, 7], shape: 'rectangle', weight: 0.3 },
    ],
    environmentalFeatures: [
      { name: 'Floor Pit', tileType: TILE_PIT, placement: 'room-center', countPerRoom: [0, 1] },
      { name: 'Low Wall', tileType: TILE_DESTRUCTIBLE, placement: 'room-edge', countPerRoom: [0, 3] },
    ],
    specialRooms: [
      { name: 'Grand Arena', minWidth: 16, minHeight: 12, selectionRule: 'largest', modifications: '', purpose: '' },
      { name: 'Treasure Alcove', minWidth: 6, minHeight: 6, selectionRule: 'smallest', modifications: '', purpose: '' },
    ],
  },

  // 3. The Labyrinth — narrow corridors, tiny rooms, dense maze
  {
    id: 'labyrinth',
    postProcessing: {
      diggerOverrides: { roomWidth: [4, 6], roomHeight: [4, 6], corridorLength: [5, 12] },
      corridorWidth: 1,
      steps: [],
    },
    roomPatterns: [
      { name: 'Closet', widthRange: [4, 6], heightRange: [4, 6], shape: 'rectangle', weight: 0.6 },
      { name: 'Junction', widthRange: [6, 8], heightRange: [6, 8], shape: 'cross', weight: 0.3 },
      { name: 'Dead End Chamber', widthRange: [4, 5], heightRange: [4, 5], shape: 'rectangle', weight: 0.1 },
    ],
    environmentalFeatures: [
      { name: 'Cracked Floor', tileType: TILE_CRACKED_FLOOR, placement: 'corridor', countPerRoom: [1, 4] },
      { name: 'Corridor Pillar', tileType: TILE_PILLAR, placement: 'corridor', countPerRoom: [0, 1] },
    ],
    specialRooms: [
      { name: 'Map Room Boss', minWidth: 8, minHeight: 8, selectionRule: 'farthest-from-spawn', modifications: '', purpose: '' },
    ],
  },

  // 4. Cathedral — one huge central room + small side rooms
  {
    id: 'cathedral',
    postProcessing: {
      diggerOverrides: { roomWidth: [5, 10], roomHeight: [5, 8], corridorLength: [2, 5] },
      corridorWidth: 3,
      steps: ['cathedral-merge-central'],
    },
    roomPatterns: [
      { name: 'Great Hall', widthRange: [20, 30], heightRange: [16, 24], shape: 'rectangle', weight: 0.1 },
      { name: 'Side Chapel', widthRange: [5, 8], heightRange: [5, 7], shape: 'rectangle', weight: 0.65 },
      { name: 'Vestibule', widthRange: [6, 8], heightRange: [6, 8], shape: 'rectangle', weight: 0.25 },
    ],
    environmentalFeatures: [
      { name: 'Column Row', tileType: TILE_PILLAR, placement: 'room-center', countPerRoom: [4, 8] },
      { name: 'Altar Pit', tileType: TILE_PIT, placement: 'room-center', countPerRoom: [0, 1] },
    ],
    specialRooms: [
      { name: 'The Great Hall Boss', minWidth: 20, minHeight: 16, selectionRule: 'largest', modifications: '', purpose: '' },
      { name: 'Treasure Vault', minWidth: 6, minHeight: 6, selectionRule: 'farthest-from-spawn', modifications: '', purpose: '' },
    ],
  },

  // 5. Catacombs — circular rooms, pit borders, slow ground, winding corridors
  {
    id: 'catacombs',
    postProcessing: {
      diggerOverrides: { roomWidth: [8, 12], roomHeight: [8, 12], corridorLength: [4, 8] },
      corridorWidth: 3,
      steps: ['catacombs-pit-corridors', 'catacombs-slow-ring'],
    },
    roomPatterns: [
      { name: 'Burial Chamber', widthRange: [8, 12], heightRange: [8, 12], shape: 'circular', weight: 0.5 },
      { name: 'Ossuary', widthRange: [6, 8], heightRange: [6, 8], shape: 'circular', weight: 0.35 },
      { name: 'Crypt Alcove', widthRange: [5, 6], heightRange: [5, 6], shape: 'rectangle', weight: 0.15 },
    ],
    environmentalFeatures: [
      { name: 'Floor Pit', tileType: TILE_PIT, placement: 'corridor', countPerRoom: [0, 2] },
      { name: 'Bone Mire', tileType: TILE_SLOW_GROUND, placement: 'room-edge', countPerRoom: [1, 3] },
      { name: 'Bridge', tileType: TILE_BRIDGE, placement: 'corridor', countPerRoom: [0, 1] },
    ],
    specialRooms: [
      { name: 'Central Crypt Boss', minWidth: 12, minHeight: 12, selectionRule: 'largest', modifications: '', purpose: '' },
      { name: 'Sealed Crypt Treasure', minWidth: 6, minHeight: 6, selectionRule: 'random', modifications: '', purpose: '' },
    ],
  },

  // 6. Proving Grounds
  {
    id: 'proving_grounds',
    postProcessing: {
      diggerOverrides: { roomWidth: [10, 16], roomHeight: [10, 16], corridorLength: [3, 6] },
      corridorWidth: 4,
      steps: [],
    },
    roomPatterns: [
      { name: 'Diamond Room', widthRange: [10, 14], heightRange: [10, 14], shape: 'diamond', weight: 0.4 },
      { name: 'Cross Chamber', widthRange: [12, 16], heightRange: [12, 16], shape: 'cross', weight: 0.35 },
      { name: 'Square Hall', widthRange: [8, 12], heightRange: [8, 12], shape: 'rectangle', weight: 0.25 },
    ],
    environmentalFeatures: [
      { name: 'Open Ground', tileType: TILE_FLOOR, placement: 'room-center', countPerRoom: [0, 0] },
      { name: 'Cracked Marker', tileType: TILE_CRACKED_FLOOR, placement: 'room-center', countPerRoom: [1, 1] },
    ],
    specialRooms: [
      { name: 'Grand Diamond Boss', minWidth: 16, minHeight: 16, selectionRule: 'largest', modifications: '', purpose: '' },
    ],
  },

  // 7. The Warrens — irregular shapes, many small connections, organic feel
  {
    id: 'warrens',
    postProcessing: {
      diggerOverrides: { roomWidth: [6, 12], roomHeight: [6, 10], corridorLength: [2, 5] },
      corridorWidth: 3,
      steps: ['warrens-extra-connections'],
    },
    roomPatterns: [
      { name: 'L-Bend', widthRange: [8, 12], heightRange: [8, 10], shape: 'L-shaped', weight: 0.35 },
      { name: 'Irregular Cave', widthRange: [7, 11], heightRange: [7, 9], shape: 'irregular', weight: 0.35 },
      { name: 'Burrow', widthRange: [5, 7], heightRange: [5, 6], shape: 'rectangle', weight: 0.3 },
    ],
    environmentalFeatures: [
      { name: 'Rubble Pile', tileType: TILE_DESTRUCTIBLE, placement: 'room-corner', countPerRoom: [1, 3] },
      { name: 'Mud Patch', tileType: TILE_SLOW_GROUND, placement: 'random', countPerRoom: [0, 2] },
    ],
    specialRooms: [
      { name: 'Den Boss', minWidth: 10, minHeight: 10, selectionRule: 'largest', modifications: '', purpose: '' },
      { name: 'Stash Nook Treasure', minWidth: 5, minHeight: 5, selectionRule: 'random', modifications: '', purpose: '' },
    ],
  },

  // 8. Bridge Network (Abyss Crossing) — islands in pit void, connected by bridges
  {
    id: 'bridge_network',
    postProcessing: {
      diggerOverrides: { roomWidth: [6, 14], roomHeight: [6, 12], corridorLength: [3, 8] },
      corridorWidth: 3,
      steps: ['abyss-corridors-to-pits', 'abyss-room-pit-borders'],
    },
    roomPatterns: [
      { name: 'Island Platform', widthRange: [8, 12], heightRange: [8, 10], shape: 'rectangle', weight: 0.5 },
      { name: 'Small Platform', widthRange: [6, 8], heightRange: [6, 7], shape: 'rectangle', weight: 0.35 },
      { name: 'Large Platform', widthRange: [12, 16], heightRange: [10, 12], shape: 'rectangle', weight: 0.15 },
    ],
    environmentalFeatures: [
      { name: 'Void Pit', tileType: TILE_PIT, placement: 'room-edge', countPerRoom: [0, 0] },
      { name: 'Bridge', tileType: TILE_BRIDGE, placement: 'corridor', countPerRoom: [1, 2] },
      { name: 'Guard Pillar', tileType: TILE_PILLAR, placement: 'room-edge', countPerRoom: [0, 2] },
    ],
    specialRooms: [
      { name: 'Central Platform Boss', minWidth: 14, minHeight: 12, selectionRule: 'largest', modifications: '', purpose: '' },
      { name: 'Treasure Isle', minWidth: 6, minHeight: 6, selectionRule: 'farthest-from-spawn', modifications: '', purpose: '' },
    ],
  },

  // 9. Arena Ring (The Crucible) — ring-shaped corridor around central boss arena
  {
    id: 'arena_ring',
    postProcessing: {
      diggerOverrides: { roomWidth: [7, 12], roomHeight: [6, 10], corridorLength: [3, 6] },
      corridorWidth: 3,
      steps: ['crucible-ring-pillars'],
    },
    roomPatterns: [
      { name: 'Ring Segment', widthRange: [8, 12], heightRange: [6, 8], shape: 'rectangle', weight: 0.5 },
      { name: 'Central Arena', widthRange: [18, 24], heightRange: [14, 18], shape: 'circular', weight: 0.05 },
      { name: 'Corner Room', widthRange: [7, 10], heightRange: [7, 10], shape: 'rectangle', weight: 0.45 },
    ],
    environmentalFeatures: [
      { name: 'Arena Pillar', tileType: TILE_PILLAR, placement: 'room-center', countPerRoom: [2, 6] },
      { name: 'Speed Lane', tileType: TILE_CRACKED_FLOOR, placement: 'corridor', countPerRoom: [0, 0] },
    ],
    specialRooms: [
      { name: 'The Crucible Boss', minWidth: 18, minHeight: 14, selectionRule: 'largest', modifications: '', purpose: '' },
      { name: 'Supply Cache Treasure', minWidth: 6, minHeight: 6, selectionRule: 'random', modifications: '', purpose: '' },
    ],
  },

  // 10. Fractured Halls — long halls bisected by destructible wall lines
  {
    id: 'fractured_halls',
    postProcessing: {
      diggerOverrides: { roomWidth: [10, 20], roomHeight: [6, 10], corridorLength: [2, 4] },
      corridorWidth: 3,
      steps: ['fractured-section-walls'],
    },
    roomPatterns: [
      { name: 'Long Hall', widthRange: [14, 20], heightRange: [6, 8], shape: 'rectangle', weight: 0.5 },
      { name: 'Wide Hall', widthRange: [10, 14], heightRange: [8, 10], shape: 'rectangle', weight: 0.3 },
      { name: 'Antechamber', widthRange: [6, 8], heightRange: [6, 8], shape: 'rectangle', weight: 0.2 },
    ],
    environmentalFeatures: [
      { name: 'Section Wall', tileType: TILE_DESTRUCTIBLE, placement: 'room-center', countPerRoom: [1, 2] },
      { name: 'Cover Pillar', tileType: TILE_PILLAR, placement: 'room-edge', countPerRoom: [1, 2] },
      { name: 'Rubble', tileType: TILE_SLOW_GROUND, placement: 'room-center', countPerRoom: [0, 1] },
    ],
    specialRooms: [
      { name: 'Throne Hall Boss', minWidth: 18, minHeight: 10, selectionRule: 'farthest-from-spawn', modifications: '', purpose: '' },
      { name: 'Armory Treasure', minWidth: 8, minHeight: 6, selectionRule: 'second-room', modifications: '', purpose: '' },
    ],
  },
];

// ── Lookup Helpers ────────────────────────────────────────────────

const designMap = new Map<string, MapDesignConfig>();
for (const d of MAP_DESIGN_REGISTRY) {
  designMap.set(d.id, d);
}

/** Get a specific layout design by ID. */
export function getMapDesign(id: string): MapDesignConfig | undefined {
  return designMap.get(id);
}

/** Pick a random layout design from the registry. */
export function getRandomMapDesign(): MapDesignConfig {
  return MAP_DESIGN_REGISTRY[Math.floor(Math.random() * MAP_DESIGN_REGISTRY.length)];
}
