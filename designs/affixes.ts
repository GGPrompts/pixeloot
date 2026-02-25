/**
 * Chase Affix Designs for Pixeloot
 *
 * These are conditional affixes that change playstyle -- the loot excitement layer.
 * They appear on Rare+ items only, replacing one regular affix slot (15% chance).
 *
 * Design constraints (from GDD):
 * - Additive bonuses only, no multiplicative stacking
 * - No crit, no leech -- by design
 * - 4-stat system: Dexterity, Intelligence, Vitality, Focus
 * - Must work within existing AffixDefinition shape (id, name, category, stat, minValue, maxValue, weight)
 * - Values are rolled via rollValue() which scales with item level
 *
 * Existing conditionals for reference:
 * - condMovingDamage: +15% damage while moving (flat, no range)
 * - condOnKillHeal: 2% max HP healed on kill (flat, no range)
 * - condLowHPDamage: +25% damage below 30% HP (flat, no range)
 * - condPostSkillAtkSpd: +10% attack speed for 3s after using a skill (flat, no range)
 */

// ── Types ────────────────────────────────────────────────────────────────────

import type { Slot } from '../src/loot/ItemTypes';

/** Condition that must be met for the affix bonus to activate. */
export type ConditionType =
  | 'while-moving'
  | 'while-stationary'
  | 'on-kill'
  | 'on-hit'
  | 'low-hp'
  | 'full-hp'
  | 'after-skill'
  | 'after-movement-skill'
  | 'distance-close'
  | 'distance-far'
  | 'stat-breakpoint'
  | 'kill-streak'
  | 'status-on-target'
  | 'multi-hit'
  | 'recently-hit'
  | 'no-damage-taken';

/** What the affix grants when the condition is met. */
export type EffectType =
  | 'flat-damage'
  | 'percent-damage'
  | 'percent-attack-speed'
  | 'percent-move-speed'
  | 'flat-armor'
  | 'percent-damage-reduction'
  | 'flat-hp-regen'
  | 'percent-cdr'
  | 'flat-heal'
  | 'percent-projectile-speed'
  | 'apply-status'
  | 'flat-hp';

export interface ChaseAffixDesign {
  /** Unique affix ID, prefixed with 'cond_' to match existing convention. */
  id: string;

  /** Display name shown on item tooltip (e.g., "While standing still: +damage"). */
  displayName: string;

  /** Full description for tooltip, with {value} placeholder for the rolled number. */
  description: string;

  /** The stat key stored on the Affix object -- must be unique across all affixes. */
  stat: string;

  /** What triggers the bonus. */
  conditionType: ConditionType;

  /** Additional condition parameters (thresholds, durations, etc.). */
  conditionParams: Record<string, number | string>;

  /** What bonus is granted. */
  effectType: EffectType;

  /** Minimum rolled value (at low item levels). */
  minValue: number;

  /** Maximum rolled value (at high item levels). */
  maxValue: number;

  /** Duration of the buff in seconds, if temporary. 0 = passive/instant. */
  buffDuration: number;

  /** Drop weight. Lower = rarer. Existing conditionals use 25. Regular affixes use 50-100. */
  weight: number;

  /** Which equipment slots this affix can appear on. null = any slot. */
  allowedSlots: Slot[] | null;

  /** Design notes explaining the playstyle impact and balance reasoning. */
  designNotes: string;
}


// ── Affix Designs ────────────────────────────────────────────────────────────

export const AFFIX_DESIGNS: ChaseAffixDesign[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // POSITIONING REWARDS
  // These reward players for controlling their position on the battlefield.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'cond_stationary_damage',
    displayName: 'While standing still: +damage',
    description: 'While standing still: +{value}% damage',
    stat: 'condStationaryDamage',
    conditionType: 'while-stationary',
    conditionParams: { minStationaryMs: 500 },
    effectType: 'percent-damage',
    minValue: 12,
    maxValue: 20,
    buffDuration: 0,
    weight: 20,
    allowedSlots: null,
    designNotes:
      'Anti-kiting playstyle. Rewards standing your ground and committing to a position. ' +
      'Pairs naturally with Mage AoE skills (Frost Nova, Arcane Wall) that punish enemies ' +
      'for approaching. The 500ms ramp prevents flickering on/off during micro-adjustments. ' +
      'Tension: you deal more damage but must trust your defenses or zone control.',
  },

  {
    id: 'cond_close_range_armor',
    displayName: 'Enemies within 3 tiles: +armor',
    description: 'While enemies are within 3 tiles: +{value} armor',
    stat: 'condCloseRangeArmor',
    conditionType: 'distance-close',
    conditionParams: { tileRadius: 3 },
    effectType: 'flat-armor',
    minValue: 15,
    maxValue: 35,
    buffDuration: 0,
    weight: 20,
    allowedSlots: null,
    designNotes:
      'Rewards aggressive positioning -- wade into packs instead of running away. ' +
      'Scales well with the armor formula (diminishing returns prevent it from being ' +
      'broken even at max roll + high base armor). Encourages Mage to stand inside ' +
      'their Frost Nova radius, or Ranger to kite at point-blank for the armor bonus.',
  },

  {
    id: 'cond_far_range_proj_speed',
    displayName: 'No enemies nearby: +projectile speed',
    description: 'No enemies within 5 tiles: +{value}% projectile speed',
    stat: 'condFarRangeProjSpeed',
    conditionType: 'distance-far',
    conditionParams: { tileRadius: 5 },
    effectType: 'percent-projectile-speed',
    minValue: 15,
    maxValue: 30,
    buffDuration: 0,
    weight: 18,
    allowedSlots: null,
    designNotes:
      'Sniper fantasy. Rewards maintaining distance from all enemies -- harder than it sounds ' +
      'when swarms spawn from multiple directions. Faster projectiles reduce enemy dodge window ' +
      'at range, making long-distance shots reliable. Naturally pairs with Ranger Power Shot ' +
      'for a "turret at range" build. Loses value the moment anything gets close.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // KILL CHAIN / MOMENTUM
  // These reward sustained aggression and clearing speed.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'cond_kill_streak_speed',
    displayName: 'Kill streak: +movement speed',
    description: 'After 3 kills within 4s: +{value}% movement speed for 5s',
    stat: 'condKillStreakSpeed',
    conditionType: 'kill-streak',
    conditionParams: { killsRequired: 3, windowSeconds: 4 },
    effectType: 'percent-move-speed',
    minValue: 15,
    maxValue: 25,
    buffDuration: 5,
    weight: 15,
    allowedSlots: null,
    designNotes:
      'The "snowball" affix. Kill fast, move fast, find the next pack. Rewards chaining ' +
      'kills through swarm waves -- the 3-kill threshold is easy in dense packs but impossible ' +
      'against single tanks/bosses, giving it a natural counter. Movement speed helps reposition ' +
      'for the next engagement. Creates a satisfying rhythm: burst pack, sprint, burst pack.',
  },

  {
    id: 'cond_kill_streak_damage',
    displayName: 'Kill streak: +damage',
    description: 'After 5 kills within 6s: +{value}% damage for 4s',
    stat: 'condKillStreakDamage',
    conditionType: 'kill-streak',
    conditionParams: { killsRequired: 5, windowSeconds: 6 },
    effectType: 'percent-damage',
    minValue: 15,
    maxValue: 25,
    buffDuration: 4,
    weight: 12,
    allowedSlots: null,
    designNotes:
      'Higher threshold than kill-streak speed (5 kills, not 3). This is the "rampage" affix -- ' +
      'pure damage escalation during big wave clears. The 4s duration is tight enough that you ' +
      'need to keep killing to maintain the buff. Additive percent damage keeps it in check: ' +
      'even at 25%, with existing gear giving ~20-40% from other sources, total stays reasonable. ' +
      'Naturally weaker against bosses (no add kills to fuel it).',
  },

  {
    id: 'cond_on_kill_cdr',
    displayName: 'On kill: reduce cooldowns',
    description: 'On kill: reduce all skill cooldowns by {value}%',
    stat: 'condOnKillCDR',
    conditionType: 'on-kill',
    conditionParams: {},
    effectType: 'percent-cdr',
    minValue: 3,
    maxValue: 8,
    buffDuration: 0,
    weight: 15,
    allowedSlots: null,
    designNotes:
      'Instant cooldown refund on each kill (percentage of remaining cooldown removed). ' +
      'At 8% max, killing 10 swarm enemies refunds roughly 56% of a cooldown -- meaningful ' +
      'but not enough to spam big abilities infinitely. Creates a "mow down trash to reset ' +
      'your big skill for the boss" loop. Respects the 40% CDR cap by being a separate ' +
      'mechanic (refund, not reduction). Mage benefits more (longer base cooldowns to refund).',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH THRESHOLD RISK/REWARD
  // These create tension around HP management.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'cond_full_hp_attack_speed',
    displayName: 'At full HP: +attack speed',
    description: 'At full HP: +{value}% attack speed',
    stat: 'condFullHPAtkSpd',
    conditionType: 'full-hp',
    conditionParams: {},
    effectType: 'percent-attack-speed',
    minValue: 8,
    maxValue: 18,
    buffDuration: 0,
    weight: 20,
    allowedSlots: null,
    designNotes:
      'Glass cannon reward: you get a big fire rate boost as long as you never get hit. ' +
      'Pairs with evasive playstyles (Ranger Evasive Roll, kiting). One scratch and it is gone. ' +
      'Creates an "untouchable" aspiration -- the best players maintain this buff through skill. ' +
      'Also synergizes with hp_regen gear: regen back to full between packs to re-enable the bonus.',
  },

  {
    id: 'cond_low_hp_regen',
    displayName: 'Below 30% HP: +health regen',
    description: 'Below 30% HP: +{value} health regen per second',
    stat: 'condLowHPRegen',
    conditionType: 'low-hp',
    conditionParams: { threshold: 0.3 },
    effectType: 'flat-hp-regen',
    minValue: 8,
    maxValue: 20,
    buffDuration: 0,
    weight: 20,
    allowedSlots: null,
    designNotes:
      'Emergency recovery. When you drop below 30% HP, high regen kicks in to pull you back. ' +
      'Not leech (GDD forbids it) -- this is regen, so it takes time and you can still die to ' +
      'burst damage. Creates a "cockroach" survival fantasy. Pairs with condLowHPDamage for a ' +
      'full "berserker" build: stay low, regen through chip damage, deal bonus damage. ' +
      'At 20 HP/s max, it takes 5 seconds to regen 100 HP -- meaningful but not instant.',
  },

  {
    id: 'cond_full_hp_flat_damage',
    displayName: 'At full HP: +flat damage',
    description: 'At full HP: +{value} damage',
    stat: 'condFullHPFlatDamage',
    conditionType: 'full-hp',
    conditionParams: {},
    effectType: 'flat-damage',
    minValue: 8,
    maxValue: 20,
    buffDuration: 0,
    weight: 18,
    allowedSlots: null,
    designNotes:
      'Flat damage version of the full-HP bonus, stacking additively with weapon base damage. ' +
      'More impactful on fast weapons (many hits per second) than slow weapons, creating an ' +
      'interesting weapon choice interaction. A Ranger with a fast Short Bow benefits more from ' +
      '+20 flat damage across many attacks than a slow Long Bow. Encourages defensive play ' +
      'to maintain the bonus -- invest in armor/regen to stay at full HP.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SKILL INTERACTION / COMBO
  // These reward weaving skills and attacks together.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'cond_after_movement_skill_damage',
    displayName: 'After dash/teleport: +damage',
    description: 'After using a movement skill: +{value}% damage for 3s',
    stat: 'condAfterMoveDamage',
    conditionType: 'after-movement-skill',
    conditionParams: {},
    effectType: 'percent-damage',
    minValue: 12,
    maxValue: 22,
    buffDuration: 3,
    weight: 18,
    allowedSlots: null,
    designNotes:
      'The "ambush" affix. Teleport in, burst hard for 3 seconds, then disengage. ' +
      'Rewards using movement skills offensively (dive in) rather than defensively (run away). ' +
      'Mage Teleport and Ranger Evasive Roll both qualify. Creates a combo pattern: ' +
      'dash into range, unload damage during the 3s window, use skills to survive until ' +
      'the next movement skill comes off cooldown. CDR gear extends the uptime indirectly.',
  },

  {
    id: 'cond_multi_hit_bonus',
    displayName: 'Hit 3+ enemies at once: +damage',
    description: 'When you hit 3+ enemies in one attack: +{value}% damage for 4s',
    stat: 'condMultiHitDamage',
    conditionType: 'multi-hit',
    conditionParams: { hitThreshold: 3 },
    effectType: 'percent-damage',
    minValue: 10,
    maxValue: 20,
    buffDuration: 4,
    weight: 15,
    allowedSlots: null,
    designNotes:
      'The "cleave" reward. Triggers on Multi Shot hitting a group, Fireball splash, ' +
      'Lightning Chain bouncing through a cluster, or Rain of Arrows catching a pack. ' +
      'Directly rewards the GDD design pillar of "positioning is king" -- line up shots ' +
      'to hit dense groups and you get a sustained damage buff. Single-target attacks ' +
      'like Power Shot can only trigger this if enemies are tightly stacked with pierce.',
  },

  {
    id: 'cond_after_skill_armor',
    displayName: 'After using skill: +armor',
    description: 'After using any skill: +{value} armor for 3s',
    stat: 'condAfterSkillArmor',
    conditionType: 'after-skill',
    conditionParams: {},
    effectType: 'flat-armor',
    minValue: 15,
    maxValue: 30,
    buffDuration: 3,
    weight: 20,
    allowedSlots: null,
    designNotes:
      'Defensive counterpart to condPostSkillAtkSpd. Using skills makes you tankier, ' +
      'rewarding active combat over passive auto-attacking. Since skills have cooldowns, ' +
      'the uptime is naturally limited. With 3-4 skills on rotation, a skilled player can ' +
      'maintain near-permanent uptime by staggering skill usage. Creates "weave skills for ' +
      'defense" playstyle. Armor values are flat, feeding into diminishing returns formula.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS EFFECT INTERACTIONS
  // These reward applying or exploiting status effects on enemies.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'cond_hit_burning_bonus',
    displayName: 'Hitting burning enemies: +damage',
    description: 'Hits against Burning enemies deal +{value}% damage',
    stat: 'condHitBurningDamage',
    conditionType: 'status-on-target',
    conditionParams: { statusEffect: 'burn' },
    effectType: 'percent-damage',
    minValue: 12,
    maxValue: 22,
    buffDuration: 0,
    weight: 15,
    allowedSlots: null,
    designNotes:
      'Elemental synergy affix. Requires a way to apply Burn first (Mage Fireball, ' +
      'fire_enchanted map modifier enemies, Inferno Staff unique). Then all subsequent ' +
      'hits deal bonus damage. Creates a two-step combo: apply burn, then unload. ' +
      'Cross-class potential: in future co-op, a Mage burning targets boosts a Ranger partner. ' +
      'Solo, it rewards the Mage for opening with Fireball before following up with other skills.',
  },

  {
    id: 'cond_hit_slowed_speed',
    displayName: 'Hitting slowed enemies: +attack speed',
    description: 'Attacks against Slowed/Chilled enemies: +{value}% attack speed',
    stat: 'condHitSlowedAtkSpd',
    conditionType: 'status-on-target',
    conditionParams: { statusEffect: 'slow,chill' },
    effectType: 'percent-attack-speed',
    minValue: 8,
    maxValue: 16,
    buffDuration: 0,
    weight: 15,
    allowedSlots: null,
    designNotes:
      'Punishes slow enemies harder -- you shoot faster while they crawl. Requires Frost Nova, ' +
      'Chill effects, or on-hit slow to activate. Creates a control-into-burst combo: slow the ' +
      'pack with Frost Nova, then machine-gun them down with boosted attack speed. The Mage ' +
      'gets natural access via Frost Nova; Ranger would need gear with slow-on-hit to self-enable.',
  },

  {
    id: 'cond_on_hit_apply_slow',
    displayName: 'Hits have chance to slow',
    description: 'Hits have {value}% chance to Slow for 2s',
    stat: 'condOnHitSlow',
    conditionType: 'on-hit',
    conditionParams: { duration: 2 },
    effectType: 'apply-status',
    minValue: 6,
    maxValue: 14,
    buffDuration: 0,
    weight: 18,
    allowedSlots: null,
    designNotes:
      'Utility/enabler affix. Does not deal extra damage itself but applies Slow, which ' +
      'is valuable for kiting and pairs with condHitSlowedAtkSpd for a powerful combo. ' +
      'At 14% chance with fast attack speed, you will slow most enemies in a pack within ' +
      'a few attacks. Ranger benefits more (higher attack rate = more proc chances). ' +
      'Also self-sufficient defensive layer: slowed enemies are easier to kite.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STAT BREAKPOINTS
  // These reward investing heavily in a specific stat.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'cond_high_vit_regen',
    displayName: '20+ Vitality: +health regen',
    description: 'With 20+ Vitality: +{value} health regen per second',
    stat: 'condHighVitRegen',
    conditionType: 'stat-breakpoint',
    conditionParams: { stat: 'vitality', threshold: 20 },
    effectType: 'flat-hp-regen',
    minValue: 5,
    maxValue: 12,
    buffDuration: 0,
    weight: 15,
    allowedSlots: null,
    designNotes:
      'Rewards Vitality investment beyond just the base HP bonus. At 20 Vitality you already ' +
      'have +200 max HP from stat points; this adds sustain on top. Creates a "tank" archetype ' +
      'where heavy Vitality investment gives both the HP pool and the regen to refill it. ' +
      'The breakpoint (20) requires meaningful investment -- roughly 40% of available points ' +
      'at level 50 if spending everything on Vitality.',
  },

  {
    id: 'cond_high_focus_cdr',
    displayName: '15+ Focus: +cooldown reduction',
    description: 'With 15+ Focus: +{value}% cooldown reduction',
    stat: 'condHighFocusCDR',
    conditionType: 'stat-breakpoint',
    conditionParams: { stat: 'focus', threshold: 15 },
    effectType: 'percent-cdr',
    minValue: 5,
    maxValue: 10,
    buffDuration: 0,
    weight: 12,
    allowedSlots: null,
    designNotes:
      'Enables a "spellslinger" build with high skill uptime. 15 Focus already gives ~43% ' +
      'CDR from stat scaling; this affix adds 5-10% more (still subject to the 40% CDR cap ' +
      'from gear, but Focus CDR is separate). Lets skill-heavy builds spam abilities more often. ' +
      'Lower weight (12) because CDR is capped and this pushes toward that cap faster. ' +
      'The breakpoint is achievable but requires committing to Focus over other stats.',
  },

  {
    id: 'cond_high_dex_proj_count',
    displayName: '25+ Dexterity: +1 projectile',
    description: 'With 25+ Dexterity: primary attack fires +1 projectile',
    stat: 'condHighDexProjCount',
    conditionType: 'stat-breakpoint',
    conditionParams: { stat: 'dexterity', threshold: 25 },
    effectType: 'flat-damage',
    minValue: 1,
    maxValue: 1,
    buffDuration: 0,
    weight: 8,
    allowedSlots: null,
    designNotes:
      'The ultimate Ranger chase affix. An extra projectile is a massive DPS increase because ' +
      'it effectively doubles potential hits per attack against packs. The threshold of 25 Dexterity ' +
      'is very high -- nearly all stat points into Dex, sacrificing Vitality/Focus. Weight of 8 makes ' +
      'this the rarest affix in the pool. The value field is 1 (fixed, not rolled) representing +1 ' +
      'projectile. Implementation note: the stat key and effectType are overloaded here; runtime ' +
      'system should check this specific ID rather than treating it as flat damage.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFENSIVE / SURVIVAL
  // These reward careful play and surviving dangerous situations.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'cond_recently_hit_armor',
    displayName: 'After taking damage: +armor',
    description: 'After taking damage: +{value} armor for 4s',
    stat: 'condRecentlyHitArmor',
    conditionType: 'recently-hit',
    conditionParams: {},
    effectType: 'flat-armor',
    minValue: 20,
    maxValue: 40,
    buffDuration: 4,
    weight: 20,
    allowedSlots: null,
    designNotes:
      'Reactive defense -- getting hit makes you tougher. The first hit hurts, but subsequent ' +
      'hits during the 4s window are mitigated. Prevents one-shot scenarios in dense packs where ' +
      'you eat unavoidable chip damage. Refreshes on each hit, so sustained combat keeps the buff ' +
      'active. Naturally falls off between packs. Pairs with Vitality builds that can afford to ' +
      'take hits. Anti-synergy with full-HP affixes, creating interesting gear choice tension.',
  },

  {
    id: 'cond_no_damage_taken_speed',
    displayName: 'Not hit for 5s: +movement speed',
    description: 'Not hit for 5s: +{value}% movement speed',
    stat: 'condNoDamageTakenSpeed',
    conditionType: 'no-damage-taken',
    conditionParams: { seconds: 5 },
    effectType: 'percent-move-speed',
    minValue: 15,
    maxValue: 25,
    buffDuration: 0,
    weight: 18,
    allowedSlots: null,
    designNotes:
      'Evasion reward: stay untouched and you become even harder to catch. The 5-second ' +
      'window is generous enough to activate between engagements but drops immediately when ' +
      'you take any hit. Creates a "flow state" where skilled kiters zip between packs at ' +
      'high speed, only slowing when combat gets tight. Pairs with condFullHPAtkSpd for a ' +
      '"perfect play" build: never get hit, move fast, shoot fast. High skill ceiling.',
  },
];
