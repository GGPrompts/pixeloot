import { Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { Fonts, FontSize } from '../ui/UITheme';
import { spawnRusher, spawnSwarm, spawnTank, spawnSniper, spawnFlanker, spawnSplitter, spawnShielder, spawnBomber, spawnCharger, spawnPulsar, spawnMirror, spawnPhaser, spawnBurrower, spawnWarper } from './Enemy';
import { spawnBoss } from './Boss';
import { getMonsterLevel } from '../core/MonsterScaling';
import { autoSave } from '../save/SaveManager';
import { hasModifier, getQuantityBonus, isMapActive, getActiveTierBonus } from '../core/MapDevice';
import { getActiveThemeKey } from '../core/ZoneThemes';
import { enterTown, isInTown } from '../core/TownManager';
import { musicPlayer, getZoneTrack } from '../audio/MusicPlayer';

const MIN_PLAYER_DIST = 200;
const SURROUND_DIST = 400;
const STAGGER_DELAY = 0.3; // seconds between staggered spawns
const WAVE_DELAY = 5; // seconds after all enemies dead before next wave
const WAVE_TEXT_DURATION = 2; // seconds the "Wave X" text is visible

type EnemySpawnFn = (x: number, y: number, monsterLevel?: number) => void;

type SpawnEntry = {
  type: 'rusher' | 'swarm' | 'tank' | 'sniper' | 'flanker' | 'splitter' | 'shielder' | 'bomber' | 'charger' | 'pulsar' | 'mirror' | 'phaser' | 'burrower' | 'warper';
  x: number;
  y: number;
};

type FormationType = 'column' | 'pincer' | 'surround' | 'shieldWall' | 'chaoticSwarm';

interface WaveDefinition {
  enemies: { type: SpawnEntry['type']; count: number }[];
  formation: FormationType;
}

const SPAWN_FNS: Record<SpawnEntry['type'], EnemySpawnFn> = {
  rusher: spawnRusher,
  swarm: spawnSwarm,
  tank: spawnTank,
  sniper: spawnSniper,
  flanker: spawnFlanker,
  splitter: spawnSplitter,
  shielder: spawnShielder,
  bomber: spawnBomber,
  charger: spawnCharger,
  pulsar: spawnPulsar,
  mirror: spawnMirror,
  phaser: spawnPhaser,
  burrower: spawnBurrower,
  warper: spawnWarper,
};

// -- Predefined waves 1-5 ------------------------------------------------

const PREDEFINED_WAVES: WaveDefinition[] = [
  // Wave 1: tutorial
  { enemies: [{ type: 'rusher', count: 5 }], formation: 'column' },
  // Wave 2
  { enemies: [{ type: 'swarm', count: 8 }], formation: 'chaoticSwarm' },
  // Wave 3: introduce Splitters
  { enemies: [{ type: 'rusher', count: 3 }, { type: 'tank', count: 1 }, { type: 'splitter', count: 2 }], formation: 'shieldWall' },
  // Wave 4: introduce Shielders + Bombers
  { enemies: [{ type: 'rusher', count: 3 }, { type: 'flanker', count: 2 }, { type: 'shielder', count: 1 }, { type: 'bomber', count: 2 }], formation: 'pincer' },
  // Wave 5: introduce Chargers
  { enemies: [{ type: 'swarm', count: 4 }, { type: 'sniper', count: 2 }, { type: 'tank', count: 1 }, { type: 'splitter', count: 1 }, { type: 'charger', count: 1 }], formation: 'surround' },
];

const ALL_FORMATIONS: FormationType[] = ['column', 'pincer', 'surround', 'shieldWall', 'chaoticSwarm'];

// -------------------------------------------------------------------------

function getPlayerPos(): { x: number; y: number } | null {
  const players = world.with('player', 'position');
  const p = players.entities[0];
  return p ? { x: p.position.x, y: p.position.y } : null;
}

function findSpawnPosition(px: number, py: number, maxAttempts = 20): { x: number; y: number } | null {
  for (let i = 0; i < maxAttempts; i++) {
    const tile = game.tileMap.getRandomFloorTile();
    const pos = game.tileMap.tileToWorld(tile.x, tile.y);
    const dx = pos.x - px;
    const dy = pos.y - py;
    if (Math.sqrt(dx * dx + dy * dy) >= MIN_PLAYER_DIST) {
      return pos;
    }
  }
  return null;
}

/** Find a floor tile near (targetX, targetY), snapping to nearest floor.
 *  Optionally enforces a minimum distance from (avoidX, avoidY). */
function findNearestFloor(targetX: number, targetY: number, avoidX?: number, avoidY?: number): { x: number; y: number } {
  const tilePosTarget = game.tileMap.worldToTile(targetX, targetY);
  // Search in expanding rings
  for (let radius = 0; radius < 20; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const tx = tilePosTarget.x + dx;
        const ty = tilePosTarget.y + dy;
        if (!game.tileMap.blocksMovement(tx, ty)) {
          const pos = game.tileMap.tileToWorld(tx, ty);
          // Enforce minimum distance from player if specified
          if (avoidX !== undefined && avoidY !== undefined) {
            const adx = pos.x - avoidX;
            const ady = pos.y - avoidY;
            if (Math.sqrt(adx * adx + ady * ady) < MIN_PLAYER_DIST) continue;
          }
          return pos;
        }
      }
    }
  }
  // Fallback: random floor away from player
  return findSpawnPosition(avoidX ?? targetX, avoidY ?? targetY)
    ?? game.tileMap.tileToWorld(...Object.values(game.tileMap.getRandomFloorTile()) as [number, number]);
}

// -- Formation placement generators --------------------------------------

function buildColumnSpawns(entries: SpawnEntry['type'][], px: number, py: number): SpawnEntry[] {
  // Pick a random edge direction
  const angle = Math.random() * Math.PI * 2;
  const startX = px + Math.cos(angle) * SURROUND_DIST;
  const startY = py + Math.sin(angle) * SURROUND_DIST;
  const perpX = -Math.sin(angle) * 32;
  const perpY = Math.cos(angle) * 32;

  return entries.map((type, i) => {
    const pos = findNearestFloor(startX + perpX * (i - entries.length / 2), startY + perpY * (i - entries.length / 2), px, py);
    return { type, x: pos.x, y: pos.y };
  });
}

function buildPincerSpawns(entries: SpawnEntry['type'][], px: number, py: number): SpawnEntry[] {
  const half = Math.ceil(entries.length / 2);
  const group1 = entries.slice(0, half);
  const group2 = entries.slice(half);
  const angle = Math.random() * Math.PI * 2;

  const result: SpawnEntry[] = [];
  // Group 1: from angle direction
  group1.forEach((type, i) => {
    const spread = (i - group1.length / 2) * 32;
    const pos = findNearestFloor(
      px + Math.cos(angle) * SURROUND_DIST + Math.cos(angle + Math.PI / 2) * spread,
      py + Math.sin(angle) * SURROUND_DIST + Math.sin(angle + Math.PI / 2) * spread,
      px, py,
    );
    result.push({ type, x: pos.x, y: pos.y });
  });
  // Group 2: from opposite direction
  group2.forEach((type, i) => {
    const spread = (i - group2.length / 2) * 32;
    const pos = findNearestFloor(
      px + Math.cos(angle + Math.PI) * SURROUND_DIST + Math.cos(angle + Math.PI / 2) * spread,
      py + Math.sin(angle + Math.PI) * SURROUND_DIST + Math.sin(angle + Math.PI / 2) * spread,
      px, py,
    );
    result.push({ type, x: pos.x, y: pos.y });
  });
  return result;
}

function buildSurroundSpawns(entries: SpawnEntry['type'][], px: number, py: number): SpawnEntry[] {
  const step = (Math.PI * 2) / entries.length;
  const offset = Math.random() * Math.PI * 2;
  return entries.map((type, i) => {
    const a = offset + step * i;
    const pos = findNearestFloor(px + Math.cos(a) * SURROUND_DIST, py + Math.sin(a) * SURROUND_DIST, px, py);
    return { type, x: pos.x, y: pos.y };
  });
}

function buildShieldWallSpawns(entries: SpawnEntry['type'][], px: number, py: number): SpawnEntry[] {
  // Tanks go in front row, everything else behind
  const tanks = entries.filter(t => t === 'tank');
  const others = entries.filter(t => t !== 'tank');

  const angle = Math.random() * Math.PI * 2;
  const result: SpawnEntry[] = [];

  // Front row: tanks
  tanks.forEach((type, i) => {
    const spread = (i - tanks.length / 2) * 48;
    const pos = findNearestFloor(
      px + Math.cos(angle) * (SURROUND_DIST - 40) + Math.cos(angle + Math.PI / 2) * spread,
      py + Math.sin(angle) * (SURROUND_DIST - 40) + Math.sin(angle + Math.PI / 2) * spread,
      px, py,
    );
    result.push({ type, x: pos.x, y: pos.y });
  });
  // Back row: others
  others.forEach((type, i) => {
    const spread = (i - others.length / 2) * 40;
    const pos = findNearestFloor(
      px + Math.cos(angle) * (SURROUND_DIST + 40) + Math.cos(angle + Math.PI / 2) * spread,
      py + Math.sin(angle) * (SURROUND_DIST + 40) + Math.sin(angle + Math.PI / 2) * spread,
      px, py,
    );
    result.push({ type, x: pos.x, y: pos.y });
  });
  return result;
}

function buildChaoticSwarmSpawns(entries: SpawnEntry['type'][], px: number, py: number): SpawnEntry[] {
  return entries.map(type => {
    const pos = findSpawnPosition(px, py) ?? findNearestFloor(px + (Math.random() - 0.5) * 600, py + (Math.random() - 0.5) * 600);
    return { type, x: pos.x, y: pos.y };
  });
}

function buildSpawns(formation: FormationType, entries: SpawnEntry['type'][], px: number, py: number): SpawnEntry[] {
  switch (formation) {
    case 'column': return buildColumnSpawns(entries, px, py);
    case 'pincer': return buildPincerSpawns(entries, px, py);
    case 'surround': return buildSurroundSpawns(entries, px, py);
    case 'shieldWall': return buildShieldWallSpawns(entries, px, py);
    case 'chaoticSwarm': return buildChaoticSwarmSpawns(entries, px, py);
  }
}

// -- Generate wave 6+ dynamically ----------------------------------------

function generateWave(waveNum: number): WaveDefinition {
  const scaleFactor = Math.pow(1.2, waveNum - 5); // 20% increase per wave past 5
  const baseCount = 7;
  const totalEnemies = Math.round(baseCount * scaleFactor);

  const types: SpawnEntry['type'][] = ['rusher', 'swarm', 'tank', 'sniper', 'flanker', 'splitter', 'shielder', 'bomber', 'charger', 'pulsar', 'mirror', 'phaser', 'burrower', 'warper'];
  const enemies: { type: SpawnEntry['type']; count: number }[] = [];

  let remaining = totalEnemies;
  // Guaranteed at least 1 tank past wave 6
  if (waveNum >= 7) {
    const tankCount = Math.min(Math.floor((waveNum - 5) / 2), 3);
    enemies.push({ type: 'tank', count: tankCount });
    remaining -= tankCount;
  }

  // Fill remaining with random types
  while (remaining > 0) {
    const type = types[Math.floor(Math.random() * types.length)];
    const count = Math.min(remaining, 1 + Math.floor(Math.random() * 3));
    const existing = enemies.find(e => e.type === type);
    if (existing) {
      existing.count += count;
    } else {
      enemies.push({ type, count });
    }
    remaining -= count;
  }

  const formation = ALL_FORMATIONS[Math.floor(Math.random() * ALL_FORMATIONS.length)];
  return { enemies, formation };
}

// =========================================================================
// WaveSystem class
// =========================================================================

export class WaveSystem {
  public currentWave = 0;

  private state: 'idle' | 'spawning' | 'active' | 'cooldown' = 'idle';
  private pendingSpawns: SpawnEntry[] = [];
  private spawnTimer = 0;
  private cooldownTimer = 0;
  private currentMonsterLevel = 1;

  // HUD text
  private waveText: Text | null = null;
  private waveTextTimer = 0;

  /** Begin the wave sequence (call once after class select). */
  start(): void {
    this.state = 'cooldown';
    this.cooldownTimer = 1; // short initial delay before wave 1
  }

  /** Stop the wave system (used when entering town). */
  stop(): void {
    this.state = 'idle';
    this.pendingSpawns = [];
    this.spawnTimer = 0;
    this.cooldownTimer = 0;
  }

  /** Main update — call from fixedUpdate. */
  update(dt: number): void {
    this.updateWaveText(dt);

    // Don't run waves while in town
    if (isInTown()) return;

    switch (this.state) {
      case 'idle':
        break;

      case 'cooldown':
        this.cooldownTimer -= dt;
        if (this.cooldownTimer <= 0) {
          this.beginNextWave();
        }
        break;

      case 'spawning':
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.pendingSpawns.length > 0) {
          const entry = this.pendingSpawns.shift()!;
          SPAWN_FNS[entry.type](entry.x, entry.y, this.currentMonsterLevel);
          this.spawnTimer = STAGGER_DELAY;
        }
        if (this.pendingSpawns.length === 0) {
          this.state = 'active';
        }
        break;

      case 'active':
        // Check if all enemies are dead
        if (this.livingEnemyCount() === 0) {
          // After a boss wave (every 5th), return to town
          if (this.currentWave > 0 && this.currentWave % 5 === 0 && isMapActive()) {
            musicPlayer.crossfade('town', 1000);
            enterTown();
            return;
          }
          // Play victory fanfare (MusicPlayer auto-returns to combat after it ends)
          if (this.currentWave % 5 === 0) {
            // Boss defeated - play victory fanfare
            musicPlayer.play('victory');
          } else {
            // Normal wave clear - ensure zone combat music is playing
            musicPlayer.play(getZoneTrack(getActiveThemeKey()));
          }
          this.state = 'cooldown';
          this.cooldownTimer = WAVE_DELAY;
          // Auto-save after wave clear
          autoSave().catch((err) => console.warn('Auto-save failed:', err));
        }
        break;
    }
  }

  private livingEnemyCount(): number {
    const enemies = world.with('enemy');
    let count = 0;
    for (const e of enemies) {
      if (!e.dead) count++;
    }
    return count;
  }

  private beginNextWave(): void {
    this.currentWave++;

    const pPos = getPlayerPos();
    if (!pPos) return;

    // Compute monster level from current player level
    const playerQuery = world.with('player', 'level');
    const playerLevel = playerQuery.entities[0]?.level ?? 1;
    this.currentMonsterLevel = getMonsterLevel(playerLevel, {
      mapBaseLevel: 1,
      mapTierBonus: getActiveTierBonus(),
    });

    // Boss wave every 5 waves (5, 10, 15, ...)
    if (this.currentWave % 5 === 0) {
      this.spawnBossWave(pPos);
      return;
    }

    const waveDef = this.currentWave <= PREDEFINED_WAVES.length
      ? PREDEFINED_WAVES[this.currentWave - 1]
      : generateWave(this.currentWave);

    // Apply map modifiers to wave definition
    const modifiedEnemies = waveDef.enemies.map((e) => ({ ...e }));

    // Extra swarm modifier: +50% swarm enemies
    if (hasModifier('extra_swarm')) {
      for (const entry of modifiedEnemies) {
        if (entry.type === 'swarm') {
          entry.count = Math.round(entry.count * 1.5);
        }
      }
    }

    // Quantity bonus: spawn more enemies overall
    const qtyBonus = getQuantityBonus();
    if (qtyBonus > 0) {
      for (const entry of modifiedEnemies) {
        entry.count = Math.round(entry.count * (1 + qtyBonus / 100));
      }
    }

    // Zone theme spawn adjustments
    const themeKey = getActiveThemeKey();
    if (themeKey === 'neon_wastes') {
      // Neon Wastes: +20% more flanker/swarm spawns
      for (const entry of modifiedEnemies) {
        if (entry.type === 'flanker' || entry.type === 'swarm') {
          entry.count = Math.round(entry.count * 1.2);
        }
      }
    } else if (themeKey === 'reactor_core') {
      // Reactor Core: slightly more rushers (aggressive theme)
      for (const entry of modifiedEnemies) {
        if (entry.type === 'rusher') {
          entry.count = Math.round(entry.count * 1.15);
        }
      }
    } else if (themeKey === 'frozen_array') {
      // Frozen Array: slightly more snipers/tanks (defensive theme)
      for (const entry of modifiedEnemies) {
        if (entry.type === 'sniper' || entry.type === 'tank') {
          entry.count = Math.round(entry.count * 1.15);
        }
      }
    }

    // Flatten enemy list
    const typeList: SpawnEntry['type'][] = [];
    for (const entry of modifiedEnemies) {
      for (let i = 0; i < entry.count; i++) {
        typeList.push(entry.type);
      }
    }

    // Build spawn positions using formation
    this.pendingSpawns = buildSpawns(waveDef.formation, typeList, pPos.x, pPos.y);
    this.spawnTimer = 0; // spawn first immediately
    this.state = 'spawning';

    this.showWaveText();
  }

  /** Spawn a boss-only wave. */
  private spawnBossWave(pPos: { x: number; y: number }): void {
    // Find a spawn position away from player
    const spawnPos = findSpawnPosition(pPos.x, pPos.y)
      ?? findNearestFloor(pPos.x + SURROUND_DIST, pPos.y);

    spawnBoss(spawnPos.x, spawnPos.y, this.currentMonsterLevel);

    // Crossfade to boss music
    musicPlayer.crossfade('boss', 800);

    // No staggered spawns needed — go straight to active
    this.pendingSpawns = [];
    this.state = 'active';

    this.showWaveText();
  }

  // -- HUD ----------------------------------------------------------------

  private showWaveText(): void {
    if (this.waveText) {
      game.hudLayer.removeChild(this.waveText);
      this.waveText.destroy();
    }

    this.waveText = new Text({
      text: `Wave ${this.currentWave}`,
      style: new TextStyle({
        fill: 0xffffff,
        fontSize: FontSize['3xl'],
        fontFamily: Fonts.display,
        stroke: { color: 0x000000, width: 4 },
      }),
    });
    this.waveText.anchor.set(0.5, 0.5);
    this.waveText.position.set(640, 200); // top-center of 1280x720
    game.hudLayer.addChild(this.waveText);
    this.waveTextTimer = WAVE_TEXT_DURATION;
  }

  private updateWaveText(dt: number): void {
    if (!this.waveText) return;
    this.waveTextTimer -= dt;

    if (this.waveTextTimer <= 0) {
      game.hudLayer.removeChild(this.waveText);
      this.waveText.destroy();
      this.waveText = null;
    } else if (this.waveTextTimer < 0.5) {
      // Fade out in last 0.5s
      this.waveText.alpha = this.waveTextTimer / 0.5;
    }
  }
}
