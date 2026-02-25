import { World } from 'miniplex';
import type { Container, Graphics } from 'pixi.js';
import type { StatusEffect } from '../core/StatusEffects';
import type { BaseItem } from '../loot/ItemTypes';
import type { MapItem } from '../loot/MapItem';
import type { Gem } from '../loot/Gems';

export type Entity = {
  position?: { x: number; y: number };
  velocity?: { x: number; y: number };
  speed?: number;
  baseSpeed?: number;           // original speed before status modifiers
  sprite?: Container;
  player?: true;
  enemy?: true;
  enemyType?: string;
  enemyProjectile?: true;
  projectile?: true;
  damage?: number;
  health?: { current: number; max: number };
  lifetime?: number;
  invulnTimer?: number;
  gold?: number;
  potionCooldown?: number;
  hotTimer?: number; // heal-over-time remaining seconds
  dead?: true;
  inputDisabled?: true;
  enemyHealthBar?: Graphics;
  piercing?: true;
  piercingHitIds?: Set<object>;
  aoe?: { x: number; y: number; radius: number; delay: number; damage: number };
  xp?: number;
  level?: number;
  statPoints?: number;
  stats?: { dexterity: number; intelligence: number; vitality: number; focus: number };
  statusEffects?: StatusEffect[]; // active status effects on this entity
  stunImmunity?: number;         // seconds of stun immunity remaining
  aiTimer?: number;               // general-purpose AI cooldown timer
  aiState?: string;               // AI behavior state (e.g. 'circling', 'dashing')
  explodeOnDeath?: { radius: number; damage: number }; // AoE explosion when projectile dies
  homing?: true;                      // projectile gently homes toward nearest enemy
  knockbackOnHit?: true;              // projectile applies knockback on hit
  boss?: true;                     // marks entity as a boss
  bossPhase?: number;              // current boss fight phase (1, 2, 3...)
  bossType?: string;               // boss design ID from BossRegistry (undefined = generic)
  lootDrop?: { item: BaseItem };    // item drop on the ground
  goldDrop?: number;                // gold amount for gold drops
  mapDrop?: { mapItem: MapItem };   // map item drop on the ground
  gemDrop?: { gem: Gem };           // gem drop on the ground
  pickup?: true;                    // entity can be picked up by walking over it
  fireEnchanted?: true;              // fire_enchanted modifier: applies Burn on contact/projectile
  firstHitTaken?: true;             // tracks if enemy has been hit once (resist_first_hit mod)
  shielded?: true;                  // enemy has a directional shield (blocks frontal projectiles)
  isMiniSplitter?: true;            // mini-splitter that does NOT split again on death
  burningGround?: true;             // projectile spawns burning ground AoE on despawn (Inferno Staff)
  bomberFuse?: number;              // bomber: fuse countdown (0.6s), undefined = not yet triggered
  chargerDir?: { x: number; y: number }; // charger: locked dash direction during charge
  selfStunTimer?: number;           // charger: self-stun after hitting a wall
  mirrorReflectCooldown?: number;   // mirror: 0 = can reflect, >0 = cracked (2s cooldown)
  phaserPhaseTimer?: number;        // phaser: cycles between solid/phased states
  phaserSolid?: boolean;            // phaser: true = solid (hittable), false = phased (invulnerable)
  burrowed?: boolean;               // burrower: true = underground (invulnerable + hidden)
  burrowSurfaceTimer?: number;      // burrower: time until next surface/burrow transition
  warperTeleportTimer?: number;     // warper: time until next teleport
  warperPostFireTimer?: number;     // warper: stationary window after firing (0.8s)
  invulnerable?: boolean;           // generic invulnerability flag (phaser phased, burrower underground)
  leechAttached?: boolean;          // leech: currently attached to the player
  leechAttachTimer?: number;        // leech: seconds remaining attached (detaches at 0)
  leechOffset?: { x: number; y: number }; // leech: positional offset from player while attached
  vortexPullTimer?: number;         // vortex: cycles between idle (3s) and pull (2s)
  vortexPulling?: boolean;          // vortex: true during active gravitational pull phase
  healerHealTimer?: number;         // healer: cooldown for heal pulse (every 2s)
  spawnerSpawnTimer?: number;       // spawner: cooldown for spawning Swarm (every 4s)
  spawnerChildCount?: number;       // spawner: number of active children (max 6)
  spawnedBySpawner?: object;        // reference to parent spawner entity (for child tracking)
  lobberFireTimer?: number;         // lobber: cooldown between lob attacks (every 3s)
  swooperState?: string;            // swooper: 'hovering' | 'swooping' | 'returning'
  swooperSwoopTimer?: number;       // swooper: timer for swoop cycle
  swooperDir?: { x: number; y: number }; // swooper: locked swoop direction
  swooperSide?: number;             // swooper: alternating swoop side (+1 or -1)
  trapperPlaceTimer?: number;       // trapper: cooldown for trap placement (every 3s)
  trapperTrapCount?: number;        // trapper: number of active traps (max 3)
  linkedPartner?: object;           // linker: reference to the paired linker entity
  linkerEnraged?: boolean;          // linker: partner died, now in enraged chase mode
  linkerBeamSprite?: Container;     // linker: beam visual between linked pair
  mimicAnchor?: { x: number; y: number }; // mimic: center point for mirror movement
  mimicPlayerLast?: { x: number; y: number }; // mimic: last known player position for delta tracking
  mimicFireTimer?: number;          // mimic: cooldown for projectile fire (every 2s)
  necromancerRaiseTimer?: number;   // necromancer: cooldown for raise dead (every 6s)
  necromancerChildCount?: number;   // necromancer: number of active raised enemies (max 3)
  necromancerChanneling?: boolean;  // necromancer: currently channeling a raise
  necromancerChannelTimer?: number; // necromancer: time left on raise channel (2s)
  raisedByNecromancer?: object;     // reference to parent necromancer entity
  overchargerDeathBuff?: boolean;   // flag: enemy has been buffed by overcharger death
  overchargerBuffTimer?: number;    // seconds remaining on overcharger death buff
  overchargerOrigSpeed?: number;    // original speed before overcharger buff
  overchargerOrigDamage?: number;   // original damage before overcharger buff
  spawnPosition?: { x: number; y: number }; // projectile spawn position (for distance-based damage scaling)
  wallPiercing?: true;             // projectile passes through walls (Whisperstring Steady Aim)
  isFireball?: true;               // projectile is a Mage Fireball (for Frostfire Scepter conversion)
  isRangerProjectile?: true;       // projectile fired by Ranger class (for Ember Quiver)
};

export const world = new World<Entity>();
