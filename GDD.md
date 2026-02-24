# Pixeloot - Game Design Document

> A browser-based neon ARPG with tight balance, meaningful loot, and old-school social trading.

## Design Pillars

1. **Every upgrade matters** - Tight, linear power scaling. No multiplicative stacking. A 5% boost feels rewarding because nothing gives 500%.
2. **Positioning is king** - Enemy waves and formations reward smart movement. Line up shots, kite groups, exploit geometry. Skill expression comes from *where* you stand, not just what you press.
3. **Mechanical depth over number inflation** - Weapon affixes change *how* you fight (projectile speed, pierce count, spread angle), not just how hard you hit.
4. **Respect the player's time** - No slog to endgame. Monster scaling from level 1 means every zone is the real game.
5. **Simple systems, deep decisions** - Universal health potion. No crit. No leech. Build identity comes from skill choices and gear synergies.
6. **Old-school social** - In-person trading. You meet people, chat, build trust. No silent auction house. The community *is* the economy.

---

## Core Loop

```
Enter Map → Kill Monsters → Collect Loot → Upgrade Gear → Harder Maps
                                              ↓
                                    Meet Players → Trade in Town
```

---

## Art Direction

### Geometry Wars Aesthetic
- **Dark background** with subtle grid or particle field
- **Neon vector-style enemies** - bright, glowing, distinct silhouettes
- **Clear hitboxes** - what you see is what you hit (and what hits you)
- **Glow/bloom effects** on projectiles, explosions, pickups
- **Color-coded enemy types** - each enemy shape/color = different behavior at a glance
- **Canvas 2D rendering** with glow filters (`shadowBlur`, additive compositing)
- No sprite sheets needed for v1 - geometric primitives with glow look great immediately

### Color Language
| Element | Color |
|---------|-------|
| Player (Ranger) | Cyan / Teal |
| Player (Mage) | Purple / Violet |
| Basic enemies | Red / Orange |
| Fast enemies | Yellow |
| Tank enemies | Green |
| Ranged enemies | Magenta |
| Boss enemies | White with multi-color glow |
| Loot drops | Rarity color (white/blue/yellow/orange) |
| Health | Red |
| Mana/Resource | Blue |
| Gold | Gold/Amber |
| Danger zones | Red pulse/flash |

### UI
- Dark panel UI with neon accent borders
- Clean readable font for stats (monospace for numbers)
- Minimal HUD: health bar, mana bar, skill hotbar, minimap
- Inventory grid with glow on rarity colors

---

## Character

### Two Classes (v1)
Start with two ranged classes to avoid melee collision complexity. Each has a distinct feel and encourages different positioning.

#### Ranger (Bow)
- **Identity**: Precision, piercing, line-based damage
- **Strength**: Rewards lining up enemies - arrows pierce through groups
- **Playstyle**: Kiting, finding angles, crowd threading
- **Skills**:
  - **Power Shot** - Charged arrow, high damage, pierces all enemies in a line
  - **Multi Shot** - Fan of arrows in a spread arc
  - **Rain of Arrows** - AoE circle after short delay (area denial)
  - **Evasive Roll** - Dash with brief invulnerability frames
  - **Trap** - Place an explosive on the ground, detonates on proximity
  - **Mark Target** - Single enemy takes increased damage from all sources

#### Mage (Spells)
- **Identity**: Area control, elemental zones, crowd management
- **Strength**: Rewards grouping enemies together - AoE payoff
- **Playstyle**: Herding, zoning, burst on clusters
- **Skills**:
  - **Fireball** - Projectile that explodes on impact (AoE splash)
  - **Frost Nova** - AoE ring around player, slows enemies
  - **Lightning Chain** - Bounces between nearby enemies (rewards tight groups)
  - **Teleport** - Blink to target location
  - **Arcane Wall** - Place a barrier that blocks enemy movement
  - **Meteor** - Large AoE after long delay, massive damage (commit & payoff)

### Shared Rules
- **Slot 4 skills at a time** (pick from your class's 6)
- Skills acquired via **skill books** (dropped or purchased from vendor)
- Each skill has **3-5 ranks** for incremental upgrades
- **Stat points** per level into 4 stats (respec available, costs gold)

### Stats
| Stat | Effect |
|------|--------|
| **Dexterity** | Projectile speed, attack speed (Ranger primary) |
| **Intelligence** | Skill damage, AoE radius (Mage primary) |
| **Vitality** | Max health, health regen |
| **Focus** | Mana pool, mana regen, cooldown reduction |

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
| **Gloves** | Attack speed, projectile affixes |
| **Boots** | Movement speed, dodge |
| **Ring 1** | Utility / offensive |
| **Ring 2** | Utility / offensive |
| **Amulet** | Highest affix budget for jewelry |
| **Weapon** | Primary damage source (bow or staff/wand) |
| **Off-hand** | Quiver (Ranger) or Tome (Mage) |

### Weapon Types
| Type | Speed | Range | Special |
|------|-------|-------|---------|
| **Short Bow** | Fast | Medium | Quick shots |
| **Long Bow** | Slow | Long | Higher base damage, pierce |
| **Crossbow** | Medium | Medium | Flat trajectory, knockback |
| **Wand** | Fast | Medium | Quick casts |
| **Staff** | Slow | Long | Higher base damage, AoE bonus |
| **Orb** | Medium | Medium | Homing projectiles (slight tracking) |

### Item Rarities
| Rarity | Affixes | Glow Color |
|--------|---------|------------|
| **Normal** | 0 | White (dim) |
| **Magic** | 1-2 | Blue |
| **Rare** | 3-4 | Yellow |
| **Unique** | Fixed special effect + stats | Orange (pulsing) |

### Affix Design

**Core principle:** Tight rolls. A good roll is ~30-50% better than a bad roll, not 10x.

**Offensive Affixes:**
| Affix | Example Roll Range | Notes |
|-------|-------------------|-------|
| Flat damage | +8 to +15 | |
| Attack speed | +3% to +8% | |
| Projectile speed | +5% to +12% | Faster = harder to dodge for enemies |
| Projectile count | +1 | Rare, powerful |
| Pierce count | +1 to +2 | Arrows/bolts pass through N extra enemies |
| Spread angle | -5% to -12% | Tighter grouping on multi-shot |
| Skill cooldown reduction | -3% to -8% | |
| Area of effect | +5% to +12% | |

**Defensive Affixes:**
| Affix | Example Roll Range |
|-------|-------------------|
| Max health | +15 to +30 |
| Armor | +10 to +20 |
| Fire resistance | +5% to +12% |
| Cold resistance | +5% to +12% |
| Lightning resistance | +5% to +12% |
| Health regen | +1 to +3 per second |
| Dodge chance | +2% to +5% (capped at ~20% total) |

**Utility Affixes:**
| Affix | Example Roll Range |
|-------|-------------------|
| Movement speed | +3% to +8% |
| Gold find | +5% to +15% |
| Item rarity | +3% to +8% |
| Light radius | +10% to +25% |
| Knockback on hit | +5% to +12% |
| Mana regen | +1 to +3 per second |

**Unique Items:**
- Fixed special effect that's build-defining
- Examples:
  - "Power Shot fires 3 arrows in a narrow spread"
  - "Fireball leaves burning ground for 3 seconds"
  - "Evasive Roll drops a trap at your starting position"
  - "Lightning Chain can bounce to the same enemy twice"
  - "Enemies you kill explode for 10% of their max HP"
  - "Teleport leaves a Frost Nova at your departure point"
- Stats on uniques are fixed (no rolling) but the effect is worth the trade-off vs a well-rolled rare

---

## Combat & Positioning

### Core Philosophy
The game is about **where you stand**, not just what buttons you press. Enemies come in formations and waves designed to reward positioning:

- **Lines of enemies** → Pierce skills shine (Ranger Power Shot threading 6 enemies)
- **Tight clusters** → AoE payoff (Mage Fireball into a pack, Lightning Chain bouncing)
- **Spread formations** → Multi Shot / wide attacks
- **Chasing swarms** → Kiting into choke points, using Arcane Wall to funnel
- **Mixed waves** → Priority targeting (kill the ranged enemy in back while kiting melee)

### Enemy Behaviors
| Type | Shape | Color | Behavior |
|------|-------|-------|----------|
| **Rusher** | Triangle (pointing at player) | Red | Charges straight at player, fast |
| **Swarm** | Small circles | Orange | Moves in packs, weak individually |
| **Tank** | Large hexagon | Green | Slow, high HP, body-blocks for others |
| **Sniper** | Diamond | Magenta | Stays at range, fires projectiles |
| **Flanker** | Crescent | Yellow | Fast, tries to circle behind player |
| **Splitter** | Pentagon | Teal | Splits into 2 smaller copies on death |
| **Shielder** | Square with front bar | White | Has a directional shield, must hit from behind |
| **Boss** | Large, unique per zone | White + multi-glow | Multi-phase, mixed mechanics |

### Wave Design
Maps spawn enemies in designed waves/formations:
- **Column** - single file line, pierce opportunity
- **Pincer** - two groups from opposite sides
- **Surround** - ring closing in, need escape skill
- **Shield wall** - tanks in front, snipers behind
- **Chaotic swarm** - many small enemies from all directions
- **Boss + adds** - boss with periodic reinforcement waves

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
  - "Monsters fire on death"
  - "Extra Swarm enemies"
  - "Boss has 2 extra phases"
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
- **Procedurally generated** arena/room-based maps
- Each map is a self-contained zone (enter → clear waves → boss → exit)
- Maps drop as items with random modifiers (like PoE maps)
- Rooms connected by corridors - chokepoints matter for positioning

### Zone Themes (v1 target: 5-8)
Each theme changes the visual palette (background color, grid tint, particle effects) and enemy composition:

1. **The Grid** - Classic dark + cyan grid, basic enemy mix (tutorial zone)
2. **Neon Wastes** - Purple/magenta void, heavy swarm + flanker spawns
3. **Reactor Core** - Orange/red glow, fire-themed enemies, burning ground hazards
4. **Frozen Array** - Blue/white, slow zones on the ground, cold enemies
5. **Overgrowth** - Green/teal, organic shapes, splitters and tanks
6. **Storm Network** - Yellow/white, lightning enemies, chain damage
7. **The Abyss** - Near-black, enemies barely glow until close (visibility challenge)
8. **Chromatic Rift** - Multi-color, all enemy types, hardest zone

### Town Hub
- Safe zone between maps
- NPCs: Vendor (buy/sell), Stash, Skill Trainer, Map Device
- **Other players visible** - walk around, chat, initiate trades
- Chat visible in town (proximity or global)

---

## Economy & Trading

### Currency
- **Gold** - single currency for everything
- Gold sinks: respec, stash tabs, vendor items, death penalty, map crafting

### In-Person Trading
Old-school style, like D2:
- **Must be in town together** to trade
- **Trade window** - both players place items/gold, both confirm
- **Chat to negotiate** - no automated pricing, builds community
- **Trust & reputation** - players learn who's reliable
- **Server-validated** - trade window is server-authoritative, prevents duplication

### Why No Auction House
- Auction houses kill community interaction
- Automated pricing flattens the economy (everything trends to "known value")
- In-person trading creates stories: "I got this insane deal from a guy who didn't know what he had"
- Forces players to *talk to each other*
- Can always add a bulletin board later (post what you're looking for / offering) without full automation

### Vendor
- Sells basic gear (normal/magic quality) scaled to player level
- Buys any item for a fixed gold amount based on rarity
- Sells skill books (rotating stock)
- Sells maps (basic, unmodified)

---

## Anti-Cheat

### Philosophy
Client-side games can't prevent all cheating, but we can:
1. **Server-validate all trades** - items can't be duplicated or fabricated for trading
2. **Server-validate leaderboard submissions** - run hash + replay verification
3. **Accept that single-player can be cheated** - and that's okay, it only affects one person
4. **Separate economies** - cheated items can't enter the trading pool

### Implementation
- Each item has a **server-generated unique ID** and creation signature
- Items entering trade are verified against the server's item registry
- Leaderboard runs submit a compressed replay + seed for server verification
- Client-side obfuscation as a deterrent (not a guarantee)

---

## Technical Architecture

### Client (v1 - Single Player)
- **Rendering**: Canvas 2D with glow effects (`shadowBlur`, additive compositing)
- **Language**: Vanilla JavaScript (ES6 modules)
- **State**: Game state in memory, persistent save to IndexedDB
- **Maps**: Procedural generation via seeded RNG
- **Art**: Geometric primitives with neon glow (no sprite sheets needed)
- **Audio**: Web Audio API for sound effects, background music
- **Hosting**: GitHub Pages (static files, zero build step)

### Server (v2 - Social Layer)
- **Backend**: Lightweight (Supabase, Firebase, or custom Node.js)
- **Database**: Player accounts, item registry, trade logs, chat
- **Auth**: Simple account system (email or OAuth)
- **WebSocket**: Real-time town hub (player positions, chat, trade requests)
- **API**: REST endpoints for leaderboard submissions, item validation
- **Hosting**: Free tier cloud (Supabase/Firebase/Railway)

### Save System
- **Local**: IndexedDB for single-player progress (gear, level, stash, map inventory)
- **Cloud sync** (v2): Upload save to server for cross-device play
- **Export/Import**: JSON save file as fallback

---

## Milestone Roadmap

### M1: Walking Skeleton
- [ ] Canvas renderer with dark background + grid
- [ ] Player character (glowing shape) with WASD movement
- [ ] Mouse-aim projectile attack
- [ ] 1 enemy type (Rusher) that chases player
- [ ] Health bar, death, respawn
- [ ] One procedurally generated room

### M2: Core Combat & Classes
- [ ] Ranger class with 4 skills (Power Shot, Multi Shot, Rain of Arrows, Evasive Roll)
- [ ] Mage class with 4 skills (Fireball, Frost Nova, Lightning Chain, Teleport)
- [ ] Skill hotbar UI (4 slots)
- [ ] 4-5 enemy types with different behaviors
- [ ] Wave spawning system with formations
- [ ] Health potion on cooldown
- [ ] Boss encounter (1 boss)

### M3: Loot & Itemization
- [ ] Item drop system with rarity tiers + glow colors
- [ ] Affix generation (random rolls within ranges)
- [ ] Inventory UI with gear slots
- [ ] Equip/compare/swap items
- [ ] Stat calculation from equipped gear
- [ ] Weapon types with different projectile behavior
- [ ] Vendor NPC (buy/sell)

### M4: Progression & Maps
- [ ] Experience and leveling
- [ ] Stat point allocation
- [ ] Monster scaling with player level
- [ ] Map items with modifiers
- [ ] Map device in town
- [ ] 3-4 zone themes
- [ ] Town hub (single player)
- [ ] Stash (shared storage)
- [ ] Save/load via IndexedDB

### M5: Polish & Content
- [ ] Remaining zone themes (5-8 total)
- [ ] More enemy types and bosses
- [ ] Unique items (8-12)
- [ ] Sound effects and music
- [ ] Minimap
- [ ] Visual effects (particles, screen shake, glow tuning)
- [ ] Balance pass on all numbers
- [ ] Remaining skills for both classes (6 each)

### M6: Social Layer
- [ ] Backend setup (auth, database)
- [ ] Item registry and server-side validation
- [ ] Town hub multiplayer (see other players)
- [ ] Chat system
- [ ] In-person trade window
- [ ] Leaderboards
- [ ] Cloud save sync

---

## Open Questions
- Mana system: per-skill cooldowns, shared mana pool, or hybrid?
- Skill acquisition: drops only, vendor, or level-based unlocks?
- Seasons/ladder resets for the social layer?
- Mobile support? (touch controls would need design work, twin-stick style could work)
- Should maps have a timer for bonus loot (speed-clear incentive)?
- Hardcore-only trade server vs shared?
