export enum GemType {
  Ruby = 'ruby',
  Sapphire = 'sapphire',
  Emerald = 'emerald',
  Topaz = 'topaz',
  Diamond = 'diamond',
  Onyx = 'onyx',
}

export interface Gem {
  id: string;
  type: GemType;
  name: string;
}

export interface GemBonus {
  stat: string;
  value: number;
  label: string;
}

/** Fixed bonuses for each gem type when socketed */
export const GEM_BONUSES: Record<GemType, GemBonus> = {
  [GemType.Ruby]: { stat: 'flatDamage', value: 10, label: '+10 Damage' },
  [GemType.Sapphire]: { stat: 'flatHP', value: 20, label: '+20 HP' },
  [GemType.Emerald]: { stat: 'percentMoveSpeed', value: 5, label: '+5% Move Speed' },
  [GemType.Topaz]: { stat: 'percentXPGain', value: 5, label: '+5% XP Gain' },
  [GemType.Diamond]: { stat: 'flatArmor', value: 5, label: '+5 Armor' },
  [GemType.Onyx]: { stat: 'percentCritChance', value: 3, label: '+3% Crit Chance' },
};

/** Display colors for gems */
export const GEM_COLORS: Record<GemType, number> = {
  [GemType.Ruby]: 0xff3333,
  [GemType.Sapphire]: 0x3366ff,
  [GemType.Emerald]: 0x33ff66,
  [GemType.Topaz]: 0xffcc00,
  [GemType.Diamond]: 0xeeeeff,
  [GemType.Onyx]: 0x666666,
};

const ALL_GEM_TYPES = Object.values(GemType);

let nextGemId = 0;

/** Generate a random gem. */
export function generateGem(): Gem {
  const type = ALL_GEM_TYPES[Math.floor(Math.random() * ALL_GEM_TYPES.length)];
  const name = type.charAt(0).toUpperCase() + type.slice(1);
  return {
    id: `gem_${Date.now()}_${nextGemId++}`,
    type,
    name,
  };
}

/** Drop chance for gems from enemies (3%). */
export const GEM_DROP_CHANCE = 0.03;
