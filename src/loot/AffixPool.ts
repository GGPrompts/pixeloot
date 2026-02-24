import { AffixDefinition } from './ItemTypes';

export const OFFENSIVE_AFFIXES: AffixDefinition[] = [
  {
    id: 'flat_damage',
    name: 'Added Damage',
    category: 'offensive',
    stat: 'flatDamage',
    minValue: 5,
    maxValue: 25,
    weight: 100,
  },
  {
    id: 'pct_damage',
    name: 'Increased Damage',
    category: 'offensive',
    stat: 'percentDamage',
    minValue: 5,
    maxValue: 20,
    weight: 80,
  },
  {
    id: 'pct_attack_speed',
    name: 'Increased Attack Speed',
    category: 'offensive',
    stat: 'percentAttackSpeed',
    minValue: 3,
    maxValue: 15,
    weight: 70,
  },
  {
    id: 'pct_projectile_speed',
    name: 'Increased Projectile Speed',
    category: 'offensive',
    stat: 'percentProjectileSpeed',
    minValue: 5,
    maxValue: 20,
    weight: 60,
  },
  {
    id: 'pct_crit_chance',
    name: 'Increased Critical Chance',
    category: 'offensive',
    stat: 'percentCritChance',
    minValue: 2,
    maxValue: 8,
    weight: 50,
  },
];

export const DEFENSIVE_AFFIXES: AffixDefinition[] = [
  {
    id: 'flat_hp',
    name: 'Added Health',
    category: 'defensive',
    stat: 'flatHP',
    minValue: 10,
    maxValue: 50,
    weight: 100,
  },
  {
    id: 'pct_hp',
    name: 'Increased Health',
    category: 'defensive',
    stat: 'percentHP',
    minValue: 5,
    maxValue: 15,
    weight: 80,
  },
  {
    id: 'flat_armor',
    name: 'Added Armor',
    category: 'defensive',
    stat: 'flatArmor',
    minValue: 5,
    maxValue: 20,
    weight: 90,
  },
  {
    id: 'hp_regen',
    name: 'Health Regeneration',
    category: 'defensive',
    stat: 'hpRegen',
    minValue: 1,
    maxValue: 5,
    weight: 60,
  },
];

export const UTILITY_AFFIXES: AffixDefinition[] = [
  {
    id: 'pct_move_speed',
    name: 'Increased Movement Speed',
    category: 'utility',
    stat: 'percentMoveSpeed',
    minValue: 3,
    maxValue: 10,
    weight: 70,
  },
  {
    id: 'pct_xp_gain',
    name: 'Increased XP Gain',
    category: 'utility',
    stat: 'percentXPGain',
    minValue: 5,
    maxValue: 15,
    weight: 60,
  },
  {
    id: 'pct_gold_find',
    name: 'Increased Gold Find',
    category: 'utility',
    stat: 'percentGoldFind',
    minValue: 10,
    maxValue: 30,
    weight: 80,
  },
  {
    id: 'pct_cdr',
    name: 'Cooldown Reduction',
    category: 'utility',
    stat: 'percentCDR',
    minValue: 3,
    maxValue: 10,
    weight: 50,
  },
];

export const CONDITIONAL_AFFIXES: AffixDefinition[] = [
  {
    id: 'cond_moving_damage',
    name: 'While moving: +damage',
    category: 'conditional',
    stat: 'condMovingDamage',
    minValue: 15,
    maxValue: 15,
    weight: 25,
  },
  {
    id: 'cond_on_kill_heal',
    name: 'On kill: heal % max HP',
    category: 'conditional',
    stat: 'condOnKillHeal',
    minValue: 2,
    maxValue: 2,
    weight: 25,
  },
  {
    id: 'cond_low_hp_damage',
    name: 'Below 30% HP: +damage',
    category: 'conditional',
    stat: 'condLowHPDamage',
    minValue: 25,
    maxValue: 25,
    weight: 25,
  },
  {
    id: 'cond_post_skill_atkspd',
    name: 'After using skill: +attack speed for 3s',
    category: 'conditional',
    stat: 'condPostSkillAtkSpd',
    minValue: 10,
    maxValue: 10,
    weight: 25,
  },
];

/** All regular (non-conditional) affixes */
export const REGULAR_AFFIXES: AffixDefinition[] = [
  ...OFFENSIVE_AFFIXES,
  ...DEFENSIVE_AFFIXES,
  ...UTILITY_AFFIXES,
];

/** All affixes including conditionals */
export const ALL_AFFIXES: AffixDefinition[] = [
  ...REGULAR_AFFIXES,
  ...CONDITIONAL_AFFIXES,
];
