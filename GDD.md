# Pixeloot - Game Design Document

> A browser-based pixel art ARPG with tight balance, meaningful loot, and a social trading hub.

## Design Pillars

1. **Every upgrade matters** - Tight, linear power scaling. No multiplicative stacking. A 5% boost feels rewarding because nothing gives 500%.
2. **Mechanical depth over number inflation** - Weapon affixes change *how* you fight (arc radius, attack speed, range), not just how hard you hit.
3. **Respect the player's time** - No slog to endgame. Monster scaling from level 1 means every zone is the real game.
4. **Simple systems, deep decisions** - Universal health potion. No crit. No leech. Build identity comes from skill choices and gear synergies.
5. **Fair economy** - Gold-only auction house. No real money. Anti-sniping bid timers. Server-validated trades.

---

## Core Loop

```
Enter Map → Kill Monsters → Collect Loot → Upgrade Gear → Harder Maps
                                              ↓
                                        Trade with Players
```

---

## Character

### Single Class (v1)
One class to start - nail the feel before expanding. Melee/hybrid archetype that can spec into different playstyles via skill selection and gear.

### Stats
Base stats that grow per level with small per-point bonuses:

| Stat | Effect |
|------|--------|
| **Strength** | Increases melee damage, carry capacity |
| **Dexterity** | Increases attack speed, dodge chance (small, capped) |
| **Vitality** | Increases max health, health regen |
| **Intelligence** | Increases skill damage, mana/resource pool |

Stat points awarded per level. Respec available but costly (gold sink).

### Skills
- **6-8 total skills** available to the class
- **Slot 4-5 at a time** (hotbar limitation = meaningful choices)
- Skills acquired via **skill books** (dropped or purchased)
- Each skill has a small upgrade track (3-5 ranks) for incremental improvement
- Skills are distinct playstyles, not just "fire damage" vs "cold damage":
  - Cleave (wide arc, lower damage)
  - Thrust (narrow, long range, piercing)
  - Slam (AoE around player, slow)
  - Dash Strike (gap closer + damage)
  - Shield Bash (stun + knockback)
  - War Cry (buff aura, temporary)
  - Trap/Turret (place and forget)
  - Whirlwind (channeled spin)

### Health & Potions
- **One health potion** on a shared cooldown (e.g., 8 seconds)
- Heals a fixed percentage of max HP (e.g., 40%)
- Same for every player - no potion management, no flask piano
- Creates tension: do you play aggressive and risk the cooldown, or play safe?

---

## Itemization

### Gear Slots (9 total)
| Slot | Notes |
|------|-------|
| **Helmet** | Defensive focus |
| **Body Armor** | Largest defensive stat budget |
| **Gloves** | Attack speed, damage affixes |
| **Boots** | Movement speed, dodge |
| **Ring 1** | Utility / offensive |
| **Ring 2** | Utility / offensive |
| **Amulet** | Highest affix budget for jewelry |
| **Weapon** | Primary damage source |
| **Off-hand** | Shield, tome, or dual-wield option |

### Weapon Types
Different weapon types have inherent mechanical differences:

| Type | Speed | Range | Arc | Special |
|------|-------|-------|-----|---------|
| **Sword** | Medium | Medium | Medium | Balanced |
| **Axe** | Slow | Medium | Wide | Cleave bonus |
| **Mace** | Slow | Short | Narrow | Stun chance |
| **Dagger** | Fast | Short | Narrow | High base attack speed |
| **Spear** | Medium | Long | Narrow | Piercing |
| **Staff** | Slow | Long | Medium | Skill damage bonus |

### Item Rarities
| Rarity | Affixes | Color |
|--------|---------|-------|
| **Normal** | 0 | White |
| **Magic** | 1-2 | Blue |
| **Rare** | 3-4 | Yellow |
| **Unique** | Fixed special effect + stats | Orange |

### Affix Design

**Core principle:** Tight rolls. A good roll is ~30-50% better than a bad roll, not 10x.

**Offensive Affixes:**
| Affix | Example Roll Range |
|-------|-------------------|
| Flat damage | +8 to +15 |
| Attack speed | +3% to +8% |
| Weapon range | +5% to +12% |
| Arc radius | +10% to +20% |
| Projectile count | +1 |
| Skill cooldown reduction | -3% to -8% |
| Area of effect | +5% to +12% |

**Defensive Affixes:**
| Affix | Example Roll Range |
|-------|-------------------|
| Max health | +15 to +30 |
| Armor | +10 to +20 |
| Fire resistance | +5% to +12% |
| Cold resistance | +5% to +12% |
| Lightning resistance | +5% to +12% |
| Health regen | +1 to +3 per second |
| Block chance (shields) | +3% to +8% |

**Utility Affixes:**
| Affix | Example Roll Range |
|-------|-------------------|
| Movement speed | +3% to +8% |
| Gold find | +5% to +15% |
| Item rarity | +3% to +8% |
| Light radius | +10% to +25% |
| Knockback | +5% to +12% |
| Thorns (flat reflect) | +3 to +8 |

**Unique Items:**
- Have a fixed special effect that's build-defining
- Examples:
  - "Your fire skills also chill enemies"
  - "Dash Strike has no cooldown but costs 2x mana"
  - "Enemies you kill explode for 10% of their max HP"
  - "Your aura skills affect double the radius"
- Stats on uniques are fixed (no rolling) but the effect is worth the trade-off vs a well-rolled rare

---

## Combat

### Feel
- **Top-down pixel art** (classic Zelda-style camera angle)
- **Click-to-move** with keyboard skill activation (or click-to-target)
- **Responsive** - attack animations should be fast, hits should feel impactful (screen shake, flash, particles)
- 8-directional movement and facing

### Damage Formula
Simple and transparent:

```
Damage = (Base Weapon Damage + Flat Damage Bonuses) * (1 + Sum of % Damage Bonuses)
```

No crit multiplier. No penetration. No "more" vs "increased" distinction. What you see is what you get.

### Monster Scaling
- Monsters scale to **player level** in every zone
- Map modifiers add difficulty and reward:
  - "Monsters have +20% health"
  - "Monsters are extra fast"
  - "Fire enchanted monsters"
  - "Monsters reflect 5% damage as thorns"
- Higher-tier maps = more modifiers stacked = better loot
- Map tier determines the **quantity and rarity bonus** of drops, not the monster level

### Death
- Lose a percentage of gold on death (5-10%)
- Respawn at map entrance
- No corpse run, no XP loss
- Hardcore mode option: permadeath with separate leaderboard

---

## World & Maps

### Map Generation
- **Procedurally generated** tile-based maps
- Each map is a self-contained zone (enter → clear → boss → exit)
- Maps drop as items with random modifiers (like PoE maps)

### Tilesets (v1 target: 5-8)
1. **Dungeon** - Stone corridors, torch-lit, classic
2. **Forest** - Trees, clearings, streams
3. **Crypt** - Coffins, undead theme, dark
4. **Caves** - Organic tunnels, crystals, bats
5. **Fortress** - Walls, battlements, armored enemies
6. **Swamp** - Poison pools, fog, slow terrain
7. **Volcano** - Lava flows, fire enemies, destructible bridges
8. **Ruins** - Ancient temple, traps, magical enemies

### Town Hub
- Safe zone between maps
- NPCs: Vendor (buy/sell), Stash, Skill Trainer, Map Device
- Portal to Auction House / Trading Post
- Chat visible in town

---

## Economy & Trading

### Currency
- **Gold** - single currency for everything
- Gold sinks: respec, stash tabs, vendor items, auction house listing fees, death penalty

### Auction House
- **Gold-only** (no real money, ever)
- **Bid system with anti-sniping**: if a bid comes in the last 2 minutes, timer extends by 2 minutes
- **Listing fee**: small gold cost to list (prevents spam)
- **Search & filter**: by slot, affix type, min/max values
- **Server-validated**: all trades go through the backend, no client-side duplication exploits

### Vendor
- Sells basic gear (normal/magic quality) scaled to player level
- Buys any item for a fixed gold amount based on rarity
- Sells skill books (rotating stock)
- Sells maps (basic, unmodified)

---

## Anti-Cheat

### Philosophy
Client-side games can't prevent all cheating, but we can:
1. **Server-validate all trades and auction house transactions** - items can't be duplicated or fabricated for trading
2. **Server-validate leaderboard submissions** - run hash + replay verification
3. **Accept that single-player can be cheated** - and that's okay, it only affects one person
4. **Separate economies** - cheated items can't enter the trading pool

### Implementation
- Each item has a **server-generated unique ID** and creation signature
- Items entering the auction house are verified against the server's item registry
- Leaderboard runs submit a compressed replay + seed for server verification
- Client-side obfuscation as a deterrent (not a guarantee)

---

## Technical Architecture

### Client (v1 - Single Player)
- **Rendering**: Canvas 2D with sprite sheets (or PixiJS/WebGL if performance requires)
- **Language**: Vanilla JavaScript (modules via ES6 import)
- **State**: Game state in memory, persistent save to IndexedDB
- **Maps**: Procedural generation via seeded RNG
- **Art**: Pixel art sprite sheets (16x16 or 32x32 tile size)
- **Audio**: Web Audio API for sound effects, background music
- **Hosting**: GitHub Pages (static files, zero build step)

### Server (v2 - Social Layer)
- **Backend**: Lightweight (Supabase, Firebase, or custom Node.js)
- **Database**: Player accounts, item registry, auction house listings, chat logs
- **Auth**: Simple account system (email or OAuth)
- **WebSocket**: Real-time chat in town hub
- **API**: REST endpoints for auction house CRUD, leaderboard submissions
- **Hosting**: Free tier cloud (Supabase/Firebase/Railway)

### Save System
- **Local**: IndexedDB for single-player progress (gear, level, stash, map inventory)
- **Cloud sync** (v2): Upload save to server for cross-device play
- **Export/Import**: JSON save file as fallback

---

## Art Direction

### Style
- **Pixel art** - specific era TBD (16-bit SNES, GBA, or modern hi-bit)
- Top-down perspective
- Rich, readable color palettes per tileset
- Clear visual language: enemy types distinguishable at a glance
- Satisfying hit effects: screen shake, white flash on enemies, particle bursts

### UI
- Pixel-art themed UI panels (inventory grid, skill bar, minimap)
- Clean, readable fonts for stats (pixel font for flavor, readable font for numbers)
- Minimal HUD: health globe/bar, mana bar, skill hotbar, minimap

---

## Milestone Roadmap

### M1: Walking Skeleton
- [ ] Canvas renderer with tilemap
- [ ] Player character movement (8-directional)
- [ ] Basic attack with one weapon type
- [ ] 1 enemy type that chases and attacks
- [ ] Health bar, death, respawn
- [ ] One procedurally generated map

### M2: Core Combat
- [ ] Multiple weapon types with different feel (speed, range, arc)
- [ ] 4-5 skills with cooldowns
- [ ] Skill hotbar UI
- [ ] 3-4 enemy types with different behaviors
- [ ] Boss encounter
- [ ] Health potion on cooldown

### M3: Loot & Itemization
- [ ] Item drop system with rarity tiers
- [ ] Affix generation (random rolls within ranges)
- [ ] Inventory UI with gear slots
- [ ] Equip/compare/swap items
- [ ] Stat calculation from equipped gear
- [ ] Vendor NPC (buy/sell)

### M4: Progression & Maps
- [ ] Experience and leveling
- [ ] Stat point allocation
- [ ] Monster scaling with player level
- [ ] Map items with modifiers
- [ ] Map device in town
- [ ] 3-4 tilesets
- [ ] Town hub with NPCs
- [ ] Stash (shared storage)
- [ ] Save/load via IndexedDB

### M5: Polish & Content
- [ ] Remaining tilesets (5-8 total)
- [ ] More enemy types and bosses
- [ ] Unique items (8-12)
- [ ] Sound effects and music
- [ ] Minimap
- [ ] Visual effects (particles, screen shake)
- [ ] Balance pass on all numbers

### M6: Social Layer
- [ ] Backend setup (auth, database)
- [ ] Item registry and server-side validation
- [ ] Auction house (list, bid, search)
- [ ] Town chat (WebSocket)
- [ ] Leaderboards
- [ ] Cloud save sync

---

## Open Questions
- Exact pixel art resolution (16x16 vs 32x32 tiles)?
- Isometric vs pure top-down? (Currently leaning top-down for simplicity)
- Mana system details - per-skill cooldowns, shared mana pool, or hybrid?
- Skill acquisition - drops only, vendor, or level-based unlocks?
- Seasons/ladder resets for the social layer?
- Mobile support? (touch controls would need design work)
