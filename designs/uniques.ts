/**
 * Unique Item Designs for Pixeloot
 *
 * 24 new build-defining unique items for Ranger and Mage classes.
 * Each item changes HOW you play, not just how hard you hit.
 *
 * Design constraints respected:
 * - No crit, no leech (by GDD design)
 * - 4-stat system: Dexterity, Intelligence, Vitality, Focus
 * - Tight linear scaling, no multiplicative stacking
 * - Conditional/conversion effects over raw number inflation
 * - Existing slots: Weapon, Helmet, Chest, Boots, Ring, Amulet, Offhand
 * - Existing weapon types: Bow, Staff, Wand, Crossbow, Orb
 * - Existing status effects: Slow, Chill, Burn, Shock, Stun, Knockback, Mark
 *
 * Existing 12 uniques (for reference, do not duplicate):
 *   Splinterbow, Inferno Staff, Stormcaller Wand, Voidcaster Orb,
 *   Deathweaver Vest, Phasewalker Cloak, Band of Echoes, Vampiric Loop,
 *   Prism of Elements, Heart of the Grid, Chrono Shield, Essence Conduit
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which class can equip/benefit from this item */
export type ClassAffinity = 'Ranger' | 'Mage' | 'Both';

/** Progression tier determining level requirement range */
export type LevelTier = 'early' | 'mid' | 'endgame';

/** Equipment slot (mirrors src/loot/ItemTypes.ts Slot enum) */
export type SlotName =
  | 'Weapon'
  | 'Helmet'
  | 'Chest'
  | 'Boots'
  | 'Ring'
  | 'Amulet'
  | 'Offhand';

/** Weapon sub-type (mirrors src/loot/ItemTypes.ts WeaponType enum) */
export type WeaponTypeName = 'Bow' | 'Staff' | 'Wand' | 'Crossbow' | 'Orb';

export interface BaseStats {
  damage?: number;
  armor?: number;
  attackSpeed?: number;
}

export interface UniqueDesign {
  /** Display name */
  name: string;

  /** Equipment slot */
  slot: SlotName;

  /** Weapon sub-type (only for Weapon slot items) */
  weaponType?: WeaponTypeName;

  /** Base stats before level scaling */
  baseStats: BaseStats;

  /** Human-readable description of the signature effect */
  uniqueEffect: string;

  /** Runtime hook identifier (used by hasEffect() checks in skill/system code) */
  effectId: string;

  /** Which class benefits most from this item */
  classAffinity: ClassAffinity;

  /** When this item becomes available in progression */
  levelTier: LevelTier;

  /** Design notes: which skills/playstyles this synergizes with */
  synergies: string;

  /** Implementation notes for the runtime effect */
  implementation: string;
}

// ---------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------

export const UNIQUE_DESIGNS: UniqueDesign[] = [
  // ========================================================================
  // RANGER WEAPONS
  // ========================================================================

  {
    name: 'Ricochet Longbow',
    slot: 'Weapon',
    weaponType: 'Bow',
    baseStats: { damage: 12, attackSpeed: 0.85 },
    uniqueEffect:
      'Power Shot arrows bounce to a nearby enemy on kill, dealing 60% damage',
    effectId: 'ricochet_on_kill',
    classAffinity: 'Ranger',
    levelTier: 'mid',
    synergies:
      'Power Shot piercing + bounce creates chain-clearing through lines of enemies. ' +
      'Pairs with Mark Target to delete priority targets and let the bounce clean up.',
    implementation:
      'In CollisionSystem, when a piercing projectile kills an enemy and hasEffect("ricochet_on_kill"), ' +
      'find nearest enemy within 150px of the corpse and fire a new projectile at 60% of original damage. ' +
      'The bounce projectile is non-piercing to prevent infinite chains.',
  },

  {
    name: 'Whisperstring',
    slot: 'Weapon',
    weaponType: 'Crossbow',
    baseStats: { damage: 20, attackSpeed: 0.6 },
    uniqueEffect:
      'Standing still for 1s grants Steady Aim: next shot deals +40% damage and passes through walls',
    effectId: 'whisperstring_steady',
    classAffinity: 'Ranger',
    levelTier: 'endgame',
    synergies:
      'Rewards stop-and-shoot playstyle over constant kiting. Synergizes with Trap ' +
      '(place traps to create safe zones to stand in) and Rain of Arrows (area denial buys time). ' +
      'Wall-piercing opens up shooting through dungeon geometry for creative positioning.',
    implementation:
      'Track player stillness timer in a system. When velocity is zero for 1s and hasEffect("whisperstring_steady"), ' +
      'set a "steadyAim" flag on the player entity. On next projectile fire, consume the flag: ' +
      'multiply damage by 1.4 and set projectile.wallPiercing = true. Visual: subtle crosshair glow ' +
      'around player when Steady Aim is charged.',
  },

  {
    name: 'Threadcutter',
    slot: 'Weapon',
    weaponType: 'Bow',
    baseStats: { damage: 10, attackSpeed: 1.3 },
    uniqueEffect:
      'Multi Shot fires in a full 360-degree ring instead of a forward arc',
    effectId: 'threadcutter_ring',
    classAffinity: 'Ranger',
    levelTier: 'mid',
    synergies:
      'Completely changes Multi Shot from a directional cone into a defensive nova. ' +
      'Synergizes with being surrounded (Surround wave type). Pairs with Evasive Roll to dash ' +
      'into packs and Multi Shot outward. Less effective for focused damage, more for crowd control.',
    implementation:
      'In Ranger Multi Shot execute, when hasEffect("threadcutter_ring"), change spread from ' +
      '30 degrees to 360 degrees (2*PI). Arrow count stays the same (5+), distributed evenly ' +
      'around the full circle. This means each arrow covers a wider angle, trading single-target ' +
      'focus for omnidirectional coverage.',
  },

  // ========================================================================
  // MAGE WEAPONS
  // ========================================================================

  {
    name: 'Frostfire Scepter',
    slot: 'Weapon',
    weaponType: 'Wand',
    baseStats: { damage: 8, attackSpeed: 1.35 },
    uniqueEffect:
      'Fireball applies Chill instead of Burn. Frost Nova applies Burn instead of Slow',
    effectId: 'frostfire_conversion',
    classAffinity: 'Mage',
    levelTier: 'mid',
    synergies:
      'Swaps the elemental identity of two core skills. Fireball now slows (enabling kiting), ' +
      'while Frost Nova now burns (turning a defensive skill into offensive AoE damage). ' +
      'Pairs with Prism of Elements amulet (+25% status damage) since you are applying statuses ' +
      'from unexpected skills. Encourages aggressive Frost Nova usage.',
    implementation:
      'In Fireball impact code, when hasEffect("frostfire_conversion"), apply Chill instead of ' +
      'the default behavior. In Frost Nova, when the same effect is active, apply Burn with ' +
      'the nova origin as sourcePos instead of Slow. Visual: Fireball projectile tinted blue-white, ' +
      'Frost Nova ring tinted orange-red.',
  },

  {
    name: 'Gravity Well Staff',
    slot: 'Weapon',
    weaponType: 'Staff',
    baseStats: { damage: 13, attackSpeed: 0.9 },
    uniqueEffect:
      'Meteor pulls all enemies within 150px toward the impact point during the telegraph phase',
    effectId: 'gravity_well_meteor',
    classAffinity: 'Mage',
    levelTier: 'endgame',
    synergies:
      'Fixes Meteor\'s biggest weakness: enemies walk out of the telegraph. The pull clusters ' +
      'enemies at the center, guaranteeing the hit and setting up Lightning Chain bounces after. ' +
      'Synergizes with Arcane Wall to funnel enemies into the pull zone. The 1.5s telegraph ' +
      'becomes a strength rather than a weakness.',
    implementation:
      'During Meteor telegraph phase (0 to 1.5s), when hasEffect("gravity_well_meteor"), ' +
      'each frame iterate enemies within 150px of the target. Apply a pull velocity: ' +
      'direction toward impact center, magnitude ~80px/s. Enemies can still move but are ' +
      'dragged inward. Visual: add spiraling particle lines toward the impact point.',
  },

  {
    name: 'Cascade Orb',
    slot: 'Weapon',
    weaponType: 'Orb',
    baseStats: { damage: 10, attackSpeed: 1.1 },
    uniqueEffect:
      'Lightning Chain gains +3 max bounces but each bounce deals 30% less damage (instead of 20%)',
    effectId: 'cascade_extra_bounces',
    classAffinity: 'Mage',
    levelTier: 'mid',
    synergies:
      'Transforms Lightning Chain from a focused 4-target skill into a 7-target crowd sweeper. ' +
      'The steeper damage falloff means the first hit is still strong but later bounces are weak -- ' +
      'ideal for finishing off wounded packs. Pairs with Shock status (each bounce applies Shock). ' +
      'Combines with Stormcaller Wand if you somehow get both equipped... but you cannot (same slot).',
    implementation:
      'In Lightning Chain execute, when hasEffect("cascade_extra_bounces"), set CHAIN_MAX_BOUNCES ' +
      'to 7 (from 4) and CHAIN_DECAY to 0.7 (from 0.8). Everything else stays the same. ' +
      'The bounce range remains 150px per hop.',
  },

  // ========================================================================
  // HELMETS
  // ========================================================================

  {
    name: 'Allseeing Visor',
    slot: 'Helmet',
    baseStats: { armor: 8 },
    uniqueEffect:
      'Enemies below 20% HP are highlighted and you deal +25% damage to them',
    effectId: 'visor_execute',
    classAffinity: 'Both',
    levelTier: 'mid',
    synergies:
      'Creates an "execute" mechanic that rewards finishing blows. Ranger Power Shot piercing ' +
      'through a line can one-shot low-HP stragglers. Mage Lightning Chain bounces can clean up ' +
      'wounded enemies efficiently. The highlight visual also serves as tactical information.',
    implementation:
      'In the sprite rendering system, when hasEffect("visor_execute"), check enemy health ratio. ' +
      'If below 0.2, tint the sprite with a red-white pulse. In CollisionSystem/damage application, ' +
      'if the target is below 20% HP and hasEffect, multiply incoming player damage by 1.25.',
  },

  {
    name: 'Mindstorm Crown',
    slot: 'Helmet',
    baseStats: { armor: 6 },
    uniqueEffect:
      'Killing 5 enemies within 4 seconds triggers a free Frost Nova centered on the player',
    effectId: 'mindstorm_killstreak_nova',
    classAffinity: 'Mage',
    levelTier: 'endgame',
    synergies:
      'Rewards aggressive play and fast kills. The auto-nova slows nearby enemies, creating ' +
      'breathing room after a burst. Synergizes with Fireball AoE splash for fast multi-kills. ' +
      'Pairs with Gravity Well Staff (cluster enemies, Meteor kills many, triggers nova on survivors). ' +
      'The nova is free (no cooldown consumed) so your real Frost Nova stays available.',
    implementation:
      'Track a rolling kill counter with timestamps. On each player kill, push Date.now() to array, ' +
      'prune entries older than 4s. When count reaches 5 and hasEffect("mindstorm_killstreak_nova"), ' +
      'call frostNova.execute(playerPos, playerPos) directly, reset the counter. Add a brief visual ' +
      'flash (cyan ring) to telegraph the auto-cast.',
  },

  {
    name: 'Tracker\'s Hood',
    slot: 'Helmet',
    baseStats: { armor: 7 },
    uniqueEffect:
      'Mark Target also applies to all enemies within 64px of the marked target',
    effectId: 'tracker_aoe_mark',
    classAffinity: 'Ranger',
    levelTier: 'mid',
    synergies:
      'Transforms Mark Target from single-target to area debuff. When enemies cluster ' +
      '(Shield Wall formation, swarms), marking one marks the pack. The +15% damage taken ' +
      'from Mark on multiple enemies makes Trap detonations and Rain of Arrows devastating. ' +
      'Pairs with any AoE damage source the Ranger has.',
    implementation:
      'In Mark Target execute, after applying Mark to the nearest enemy, if hasEffect("tracker_aoe_mark"), ' +
      'iterate all other enemies within 64px of the marked target and apply Mark status to them too. ' +
      'Visual: secondary marks get a smaller, dimmer diamond marker.',
  },

  // ========================================================================
  // CHEST ARMOR
  // ========================================================================

  {
    name: 'Thornweave Mantle',
    slot: 'Chest',
    baseStats: { armor: 16 },
    uniqueEffect:
      'When hit, return 15% of the damage taken as a nova that hits all enemies within 96px',
    effectId: 'thornweave_reflect_nova',
    classAffinity: 'Both',
    levelTier: 'endgame',
    synergies:
      'Turns taking damage into a damage source. Rewards standing in the fray rather than ' +
      'pure kiting. Pairs with high Vitality/armor builds that can absorb hits. ' +
      'Synergizes with Chrono Shield (cheat death) for risky aggressive play. ' +
      'Mage Frost Nova + Thornweave creates a melee-range zone-control playstyle.',
    implementation:
      'In HealthSystem when the player takes damage and hasEffect("thornweave_reflect_nova"), ' +
      'calculate 15% of pre-mitigation damage. Spawn a visual nova ring (red-orange, 96px radius) ' +
      'and deal that flat damage to all enemies within range. Cannot trigger more than once per 0.5s ' +
      'to prevent frame-stacking with many simultaneous hits.',
  },

  {
    name: 'Flickerstep Shroud',
    slot: 'Chest',
    baseStats: { armor: 10 },
    uniqueEffect:
      'After using any movement skill, gain +30% attack speed for 2 seconds',
    effectId: 'flickerstep_post_dash',
    classAffinity: 'Both',
    levelTier: 'mid',
    synergies:
      'Creates a "dash then burst" rhythm. Ranger: Evasive Roll into position, then rapid-fire ' +
      'Power Shots. Mage: Teleport into range, then machine-gun Fireballs. Encourages using ' +
      'movement skills offensively rather than purely defensively. Pairs with Focus stat ' +
      '(CDR to get movement skill back faster for more burst windows).',
    implementation:
      'In Evasive Roll and Teleport execute functions, after the movement completes, ' +
      'if hasEffect("flickerstep_post_dash"), set a "flickerstepBuff" timer on the player entity (2s). ' +
      'In ComputedStats, when the timer is active, add 30 to percentAttackSpeed. ' +
      'Visual: brief cyan speed lines around the player.',
  },

  // ========================================================================
  // BOOTS
  // ========================================================================

  {
    name: 'Trailblazer Greaves',
    slot: 'Boots',
    baseStats: { armor: 6 },
    uniqueEffect:
      'While moving, leave a burning trail that deals damage to enemies who walk through it (3s duration)',
    effectId: 'trailblazer_fire_trail',
    classAffinity: 'Both',
    levelTier: 'endgame',
    synergies:
      'Turns kiting into a damage source. Run through enemy packs to apply burning ground. ' +
      'Ranger: kite in circles around Tanks, the trail does the work. Mage: sprint through ' +
      'a corridor to create a fire barrier behind you, then Arcane Wall to trap enemies in it. ' +
      'Synergizes with movement speed bonuses to cover more ground with fire.',
    implementation:
      'When player velocity magnitude > 0 and hasEffect("trailblazer_fire_trail"), every 0.3s ' +
      'spawn a burning ground patch at the player position. Each patch is a 24px radius circle ' +
      'that lasts 3s, dealing 5 damage per 0.5s tick to enemies standing in it and applying Burn. ' +
      'Max 10 active patches (oldest fades when exceeded). Visual: orange-red flickering circles ' +
      'on the worldLayer.',
  },

  {
    name: 'Rootwalkers',
    slot: 'Boots',
    baseStats: { armor: 8 },
    uniqueEffect:
      'Standing still for 0.5s roots you in place but grants +20% damage and 25 flat armor',
    effectId: 'rootwalkers_plant',
    classAffinity: 'Both',
    levelTier: 'mid',
    synergies:
      'The opposite of kiting: rewards planting and fighting. Pairs with Whisperstring (Crossbow) ' +
      'for a full turret build. Mage: plant, cast Arcane Wall for protection, then unload Fireballs ' +
      'with bonus damage. The flat armor helps survive while stationary. Moving instantly breaks ' +
      'the root and removes the bonuses.',
    implementation:
      'Track player stillness. After 0.5s without movement and hasEffect("rootwalkers_plant"), ' +
      'set "rooted" flag on player entity. While rooted: +20% to percentDamage in ComputedStats, ' +
      '+25 to flatArmor. Any WASD input clears the flag immediately. Visual: green vine tendrils ' +
      'growing around player feet while rooted, subtle green tint.',
  },

  {
    name: 'Phasewalk Boots',
    slot: 'Boots',
    baseStats: { armor: 4 },
    uniqueEffect:
      'Evasive Roll distance +50%. Teleport cooldown reduced by 2s. Movement skills grant 1s of invisibility (enemies lose aggro)',
    effectId: 'phasewalk_enhanced_mobility',
    classAffinity: 'Both',
    levelTier: 'endgame',
    synergies:
      'All-in on mobility. The invisibility window lets you reposition without being chased, ' +
      'enabling hit-and-run tactics. Ranger: long Evasive Roll + invis means you can escape any ' +
      'surround. Mage: Teleport + invis lets you set up Meteor telegraphs safely. ' +
      'Low armor forces reliance on the mobility to survive.',
    implementation:
      'In Evasive Roll, when hasEffect, multiply ROLL_DISTANCE by 1.5. In Teleport, when hasEffect, ' +
      'reduce the skill cooldown by 2 (applied in SkillSystem cooldown calculation). After either ' +
      'movement skill executes, set "invisible" flag on player for 1s. While invisible: enemies ' +
      'clear their target and wander. Player sprite alpha = 0.3. Any attack breaks invisibility.',
  },

  // ========================================================================
  // RINGS
  // ========================================================================

  {
    name: 'Resonance Loop',
    slot: 'Ring',
    baseStats: {},
    uniqueEffect:
      'When you apply a status effect that the enemy already has, deal 20 bonus flat damage',
    effectId: 'resonance_double_status',
    classAffinity: 'Both',
    levelTier: 'mid',
    synergies:
      'Rewards repeatedly applying the same status. Mage Frost Nova refreshing Slow on a pack ' +
      'deals 20 bonus damage to each already-slowed enemy. Ranger Mark Target refresh deals ' +
      'bonus damage. Pairs with any rapid-application skill (Fireball spamming Burn). ' +
      'Does NOT work with Shock (consumed on hit, never "already has" it at refresh time).',
    implementation:
      'In applyStatus(), before refreshing an existing effect, if hasEffect("resonance_double_status") ' +
      'and the entity already has this status type, deal 20 damage to the entity and spawn a ' +
      'purple damage number. This triggers on Slow/Chill/Burn/Mark refresh but not Shock/Knockback.',
  },

  {
    name: 'Kinetic Band',
    slot: 'Ring',
    baseStats: {},
    uniqueEffect:
      'Every 4th projectile fired deals double damage and applies Knockback',
    effectId: 'kinetic_fourth_shot',
    classAffinity: 'Both',
    levelTier: 'mid',
    synergies:
      'Creates a rhythm to primary attacks. Ranger Power Shot: every 4th arrow is a cannon blast. ' +
      'Mage Fireball: every 4th fireball is a massive knockback explosion. The Knockback disrupts ' +
      'enemy positioning, which can push them into traps, burning ground, or Arcane Walls. ' +
      'Pairs with attack speed investment to reach the 4th shot faster.',
    implementation:
      'Track a global projectile counter. On each fireProjectile call by the player, increment. ' +
      'When counter % 4 === 0 and hasEffect("kinetic_fourth_shot"), set projectile damage to 2x ' +
      'and add an onHit callback that applies Knockback from the projectile position. ' +
      'Visual: 4th projectile is larger and brighter with a white core.',
  },

  {
    name: 'Manaforge Ring',
    slot: 'Ring',
    baseStats: {},
    uniqueEffect:
      'Skills that hit 3+ enemies at once have their cooldown refunded by 30%',
    effectId: 'manaforge_aoe_refund',
    classAffinity: 'Mage',
    levelTier: 'endgame',
    synergies:
      'Rewards landing AoE on clustered enemies. Frost Nova into a swarm refunds 30% of its ' +
      '6s cooldown. Meteor on a big pack refunds 30% of 14s. Lightning Chain hitting 4 targets ' +
      'refunds 30% of 7s. Encourages the Mage to herd enemies together before using AoE skills. ' +
      'Pairs with Gravity Well Staff for guaranteed multi-hits.',
    implementation:
      'In each AoE skill execute function, count how many enemies were hit. After dealing damage, ' +
      'if hitCount >= 3 and hasEffect("manaforge_aoe_refund"), reduce the skill\'s current cooldown ' +
      'timer by 30% of its max cooldown via skillSystem.refundCooldown(skillKey, 0.3). ' +
      'Visual: brief blue sparkle on the player when refund triggers.',
  },

  // ========================================================================
  // AMULETS
  // ========================================================================

  {
    name: 'Warden\'s Sigil',
    slot: 'Amulet',
    baseStats: {},
    uniqueEffect:
      'Trap maximum increased from 3 to 6. Traps arm instantly instead of after 0.5s delay',
    effectId: 'warden_enhanced_traps',
    classAffinity: 'Ranger',
    levelTier: 'endgame',
    synergies:
      'Transforms the Ranger into a trap-focused tactician. 6 instantly-armed traps turn ' +
      'corridors into kill zones. Pairs with Phasewalker Cloak (Evasive Roll drops a trap) ' +
      'for mobile trap placement. Pairs with Mark Target (+15% damage for trap detonations). ' +
      'Encourages pre-planning before engaging waves.',
    implementation:
      'In Trap skill, when hasEffect("warden_enhanced_traps"), override TRAP_MAX_ACTIVE to 6 ' +
      'and TRAP_ARM_DELAY to 0. The trap is immediately armed and can trigger on the same frame ' +
      'an enemy walks over it. No other changes to trap damage or radius.',
  },

  {
    name: 'Conduit Pendant',
    slot: 'Amulet',
    baseStats: {},
    uniqueEffect:
      'Lightning Chain arcs from you to the target before bouncing. Each arc also applies Chill',
    effectId: 'conduit_self_arc',
    classAffinity: 'Mage',
    levelTier: 'mid',
    synergies:
      'The initial arc from the player means Lightning Chain always has a starting point ' +
      '(no need to aim precisely at the first target). Adding Chill on top of Shock means ' +
      'every bounced enemy is both slowed and takes bonus damage on next hit. Pairs with ' +
      'Frostfire Scepter for full element mixing. Makes Lightning Chain feel like a self-targeted ' +
      'area skill rather than a precision cursor skill.',
    implementation:
      'In Lightning Chain execute, when hasEffect("conduit_self_arc"), draw the first lightning ' +
      'segment from the player position (not cursor). The first target search uses player position ' +
      'as origin with CHAIN_INITIAL_RANGE. Each bounce applies both Shock (existing) and Chill ' +
      '(new). Visual: arc segments alternate yellow and blue tint.',
  },

  {
    name: 'Gambler\'s Charm',
    slot: 'Amulet',
    baseStats: {},
    uniqueEffect:
      'Every 10 seconds, gain a random buff for 5s: +30% damage, +30% move speed, +50 armor, or instant skill refresh',
    effectId: 'gambler_random_buff',
    classAffinity: 'Both',
    levelTier: 'mid',
    synergies:
      'Introduces controlled randomness to combat. You never know which buff is next, so you ' +
      'need to adapt your play on the fly. Got damage? Push aggressively. Got speed? Kite and ' +
      'reposition. Got armor? Stand your ground. Got skill refresh? Dump all cooldowns immediately. ' +
      'Pairs with any build because the buffs are universally useful.',
    implementation:
      'Track a 10s cycle timer. When it fires and hasEffect("gambler_random_buff"), pick one of ' +
      '4 buffs at random and apply it for 5s. Damage: +30 percentDamage. Speed: +30 percentMoveSpeed. ' +
      'Armor: +50 flatArmor. Refresh: call skillSystem.refreshAll(). Visual: colored aura matching ' +
      'the buff type (red/green/gray/blue) with a floating icon above the player.',
  },

  // ========================================================================
  // OFFHANDS
  // ========================================================================

  {
    name: 'Ember Quiver',
    slot: 'Offhand',
    baseStats: { armor: 6 },
    uniqueEffect:
      'All Ranger projectiles apply Burn on hit. Burning enemies take +10% damage from your projectiles',
    effectId: 'ember_quiver_burn',
    classAffinity: 'Ranger',
    levelTier: 'endgame',
    synergies:
      'Gives Ranger access to Burn, which is normally a Mage mechanic. The first hit applies Burn, ' +
      'then all subsequent hits deal +10% while the Burn is active. Synergizes with fast attack speed ' +
      '(more hits to leverage the +10%). Pairs with Prism of Elements (+25% status damage on the Burns). ' +
      'Power Shot piercing through a burning line deals escalating damage.',
    implementation:
      'In CollisionSystem, when a player projectile hits an enemy and hasEffect("ember_quiver_burn"), ' +
      'apply Burn status. Then check: if enemy already had Burn before this hit (was already burning), ' +
      'multiply projectile damage by 1.1. Visual: arrow sprites gain a small orange trail.',
  },

  {
    name: 'Tome of Recursion',
    slot: 'Offhand',
    baseStats: { armor: 4 },
    uniqueEffect:
      'Frost Nova triggers a second, smaller Frost Nova (64px radius) 1s after the first',
    effectId: 'recursion_double_nova',
    classAffinity: 'Mage',
    levelTier: 'mid',
    synergies:
      'The delayed second nova catches enemies who survived the first blast or who moved into range. ' +
      'Enemies who were Slowed by the first nova are still in range for the second. ' +
      'Pairs with Voidcaster Orb (Teleport leaves a Frost Nova, which ALSO echoes). ' +
      'Pairs with Mindstorm Crown (kill-streak nova also echoes for chain reactions).',
    implementation:
      'In Frost Nova execute, after the initial nova completes, if hasEffect("recursion_double_nova"), ' +
      'schedule a second frostNova.execute() at the same position after 1s delay. The echo nova ' +
      'uses half the radius (64px) and half the damage. To prevent infinite recursion, set a flag ' +
      'that blocks the echo from triggering another echo.',
  },

  {
    name: 'Sentinel Ward',
    slot: 'Offhand',
    baseStats: { armor: 20 },
    uniqueEffect:
      'While below 50% HP, a rotating shield orbits the player that blocks one enemy projectile every 3s',
    effectId: 'sentinel_ward_shield',
    classAffinity: 'Both',
    levelTier: 'endgame',
    synergies:
      'Defensive safety net that activates when you need it most. Specifically counters Sniper (diamond) ' +
      'enemies whose ranged projectiles are dangerous when you are wounded. Pairs with high Vitality ' +
      'builds that hover at medium HP. The 3s internal cooldown prevents it from being a permanent shield. ' +
      'Synergizes with Thornweave Mantle (take hits on purpose to trigger reflect, Sentinel blocks the next).',
    implementation:
      'When player health ratio < 0.5 and hasEffect("sentinel_ward_shield"), render a small glowing ' +
      'hexagon orbiting the player (rotation speed ~2 rad/s). Track a 3s internal cooldown. When an ' +
      'enemy projectile would hit the player, if the shield is available, negate the damage, destroy ' +
      'the enemy projectile, trigger a brief flash on the shield, and start the 3s cooldown. ' +
      'Shield disappears when health goes above 50%.',
  },

  // ========================================================================
  // GLOVES (currently no Gloves slot in the Slot enum - these use existing slots)
  // Note: Gloves are mentioned in GDD but not in the current Slot enum.
  // These designs use Helmet/Ring/Boots slots instead since Gloves don't exist yet.
  // If Gloves are added later, these can be moved to that slot.
  // ========================================================================

  // ========================================================================
  // ADDITIONAL CROSS-CLASS ITEMS
  // ========================================================================

  {
    name: 'Shatterglass Lens',
    slot: 'Helmet',
    baseStats: { armor: 5 },
    uniqueEffect:
      'Projectiles that travel more than 300px deal +20% damage. Projectiles within 100px deal -15% damage',
    effectId: 'shatterglass_range_scaling',
    classAffinity: 'Both',
    levelTier: 'early',
    synergies:
      'Rewards long-range engagements and punishes close-range fights. Ranger Power Shot ' +
      'at distance is deadly; panic shots up close are weaker. Mage Fireball from across ' +
      'the room hits harder. Encourages maintaining distance and using movement skills to ' +
      'create space. An early-game teaching tool for positioning.',
    implementation:
      'In CollisionSystem, when a player projectile hits an enemy and hasEffect("shatterglass_range_scaling"), ' +
      'calculate distance traveled (store spawn position on projectile entity). If distance > 300, ' +
      'multiply damage by 1.2. If distance < 100, multiply by 0.85. Visual: long-range projectiles ' +
      'brighten/grow slightly as they travel.',
  },

  {
    name: 'Anchor Chain',
    slot: 'Amulet',
    baseStats: {},
    uniqueEffect:
      'Your first hit on each new enemy applies Slow for 1s. Slowed enemies drop 15% more gold',
    effectId: 'anchor_chain_first_hit',
    classAffinity: 'Both',
    levelTier: 'early',
    synergies:
      'Quality-of-life item that makes early progression smoother. The auto-Slow on first hit ' +
      'gives breathing room against Rushers and Flankers. The gold bonus helps fund respec and ' +
      'crafting. Works with any build and any skill. The "first hit only" constraint prevents ' +
      'it from being a permanent slow-lock. Good stepping stone before finding build-defining endgame items.',
    implementation:
      'Track a Set of enemy entity references that have been "first-hit". On player projectile impact, ' +
      'if hasEffect("anchor_chain_first_hit") and the enemy is NOT in the set, add to set, apply Slow (1s). ' +
      'Clear the set when a new dungeon run starts. For gold bonus, in DropTable when enemy has Slow status ' +
      'and hasEffect is active, multiply gold drop by 1.15.',
  },
];
