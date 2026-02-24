# Pixeloot - Game Design Document

> A browser-based pixel art ARPG with tight balance, meaningful loot, and old-school social trading.

## Design Pillars

1. **Every upgrade matters** - Tight, linear power scaling. No multiplicative stacking. A 5% boost feels rewarding because nothing gives 500%.
2. **Positioning is king** - Enemy waves and formations reward smart movement. Line up shots, kite groups, exploit geometry. Skill expression comes from *where* you stand, not just what you press.
3. **Mechanical depth over number inflation** - Weapon affixes change *how* you fight (projectile speed, pierce count, spread angle), not just how hard you hit.
4. **Respect the player's time** - No slog to endgame. Monster scaling from level 1 means every zone is the real game.
5. **Simple systems, deep decisions** - Universal health potion. No crit. No leech. Build identity comes from skill choices and gear synergies.
6. **Old-school social** - Chat-based trading. You meet people, negotiate, build trust. No silent auction house. The community *is* the economy.

---

## Core Loop

```
Enter Map → Kill Monsters → Collect Loot → Upgrade Gear → Harder Maps
                                ↓                ↓
                            Salvage          Chat → Trade → Show Off
                                ↓
                        Craft / Reroll
```

---

## Art Direction

### Two-Phase Visual Strategy

**Phase 1 (Prototyping): Geometry Wars Style**
- **Dark background** with subtle grid or particle field
- **Neon vector-style enemies** - bright, glowing, distinct silhouettes
- **Clear hitboxes** - geometric primitives show exact collision boundaries
- **Glow/bloom effects** on projectiles, explosions, pickups
- **Color-coded enemy types** - each shape/color = different behavior at a glance
- Purpose: nail the gameplay feel with perfect visual clarity before investing in art

**Phase 2 (Production): Pixel Art Skin**
- Layer pixel art sprites on top of the proven hitbox geometry
- Top-down perspective, 32x32 tile size
- Rich palettes per zone theme (dark dungeon, lush forest, fire caves, etc.)
- Pixel art UI panels (inventory, skill bar, minimap)
- The geometry hitboxes remain underneath - pixel art is the costume, not the collision

**Colorblind Accessibility**
- Enemy types distinguished by **shape AND color** (never color alone)
- Shapes are readable at a glance even in monochrome
- Optional high-contrast mode that adds extra border/pattern distinction
- Loot rarity uses glow intensity + icon markers in addition to color

### Color Language (Phase 1)
| Element | Color | Shape |
|---------|-------|-------|
| Player (Ranger) | Cyan / Teal | Arrow/chevron |
| Player (Mage) | Purple / Violet | Circle with inner glow |
| Rusher enemies | Red | Triangle (pointing at player) |
| Swarm enemies | Orange | Small circles |
| Tank enemies | Green | Large hexagon |
| Ranged enemies | Magenta | Diamond |
| Fast enemies | Yellow | Crescent |
| Boss enemies | White + multi-glow | Large, unique per zone |
| Loot drops | Rarity color | Star burst |
| Health | Red | - |
| Mana/Resource | Blue | - |
| Gold | Gold/Amber | - |
| Danger zones | Red pulse/flash | - |

### UI
- Dark panel UI with accent borders (neon in Phase 1, pixel art frames in Phase 2)
- Clean readable font for stats (monospace for numbers)
- Minimal HUD: health bar, mana bar, skill hotbar, minimap
- Inventory grid with rarity glow + icon markers
- **Loot filter** (toggle what drops are shown/highlighted by rarity and affix type)

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
- **One health potion** on a shared cooldown (8 seconds)
- Heals **30% of max HP** over 2 seconds (heal-over-time, not instant)
- Same for every player - no potion management, no flask piano
- HoT prevents binary "immortal vs dead" - you can still die during the heal if you take heavy damage
- Creates tension: do you pop it early and waste healing, or risk waiting?

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

**Core principle:** Tight rolls with mechanical variety. A good roll is ~30-50% better than a bad roll, not 10x. Excitement comes from *conditional* and *conversion* affixes, not bigger numbers.

**Offensive Affixes:**
| Affix | Example Roll Range | Notes |
|-------|-------------------|-------|
| Flat damage | +8 to +15 | |
| Attack speed | +3% to +8% | |
| Projectile speed | +5% to +12% | Faster = harder for enemies to dodge |
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

**Conditional Affixes (chase items):**
These are the loot excitement layer - rare affixes that change *behavior*, not just numbers:

| Affix | Example |
|-------|---------|
| Kill bonus | "Kills grant +15% movement speed for 3s" |
| Elemental conversion | "30% of damage dealt as fire" |
| Low-health bonus | "Below 40% HP: +20% attack speed" |
| Full-mana bonus | "At full mana: +10% damage" |
| Skill enhancement | "Multi Shot fires +2 arrows" |
| On-hit effect | "Hits have 8% chance to slow for 1s" |
| Breakpoint unlock | "With 50+ Dexterity: arrows ricochet once" |

These are rarer than standard affixes and only appear on Rare+ items. They don't break the math (no multiplicative scaling) but they create build identity and chase goals.

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

## Crafting & Salvage

### Philosophy
Bad drops should always feel like progress, not trash. Every item has a use beyond vendoring.

### Salvage
- **Break down** any item at the Salvage NPC (or portable salvage kit)
- Yields **materials** based on rarity:
  - Normal → Scrap (common)
  - Magic → Essence (uncommon)
  - Rare → Crystal (rare)
  - Unique → Prism (very rare, also obtained from bosses)

### Crafting Recipes
| Action | Cost | Effect |
|--------|------|--------|
| **Reroll affixes** | Crystals | Reroll all random affixes on a Rare item (keeps rarity) |
| **Upgrade rarity** | Essences → Crystals | Normal → Magic → Rare (random affixes added) |
| **Add socket** | Prism | Add a socket to an item (max 1 socket per item) |
| **Socket gems** | Found gems | Insert a gem into a socketed item for a fixed bonus |

### Gems (Socket System)
Simple, fixed bonuses when socketed:
| Gem | Bonus |
|-----|-------|
| Ruby | +Flat damage |
| Sapphire | +Max mana |
| Emerald | +Health regen |
| Topaz | +Movement speed |
| Diamond | +All resistances |
| Onyx | +Gold find |

Gems drop from bosses and high-tier maps. Can be removed and reused (costs gold).

---

## Status Effects

### Framework
Clear, consistent rules for all status effects in the game:

| Effect | What it Does | Duration | Stacking |
|--------|-------------|----------|----------|
| **Slow** | -30% movement speed | 2s | Refreshes duration, doesn't stack intensity |
| **Chill** | -20% movement speed, -15% attack speed | 3s | Refreshes duration |
| **Burn** | Damage over time (flat per tick) | 3s | Refreshes duration, new source replaces old |
| **Shock** | Next hit taken deals +25% damage | 4s or until triggered | Refreshes duration |
| **Stun** | Cannot move or attack | 0.5s | Cannot re-stun for 3s after (diminishing returns) |
| **Knockback** | Pushed away from source | Instant | N/A |
| **Mark** | Takes +15% damage from all sources | 5s | Single instance, refreshes |

### Immunity Rules
- **Bosses** are immune to Stun (can be Slowed at half effectiveness)
- **Stun diminishing returns**: 3-second immunity window after each stun
- **Players** can build resistance to reduce duration of negative effects
- **Elemental resistance** reduces damage from Burn but doesn't prevent the status

---

## Defensive Formulas

### Armor
Damage reduction follows a **diminishing returns curve** so armor is always useful but never reaches immunity:

```
Damage Reduction % = Armor / (Armor + K)
where K = 100 + (10 * Monster Level)
```

Example at level 20 (K = 300):
- 100 Armor → 25% reduction
- 200 Armor → 40% reduction
- 300 Armor → 50% reduction
- 600 Armor → 67% reduction

Always useful to stack more, but returns diminish. No armor cap needed.

### Resistances
- Each element has a separate resistance percentage
- **Cap: 75%** (can't become immune)
- Monsters in higher-tier maps deal more elemental damage, making resistance feel necessary without being mandatory in early maps
- Resistance reduces damage AND duration of the associated status effect

### Dodge
- Chance to completely avoid a hit
- **Cap: 25%** (prevents dodge from being the only defensive stat)
- Calculated per-hit, purely random (no pseudo-random)

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
| Type | Shape (Phase 1) | Color | Behavior |
|------|-----------------|-------|----------|
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
Monsters have a **base level per map tier**, plus scaling based on player level:

```
Monster Level = max(Map Base Level, Player Level - 2) + Map Tier Bonus
```

- **Map Base Level** prevents trivializing early content at high level
- **Player Level - 2** keeps monsters close but slightly below (upgrades always feel impactful)
- **Map Tier Bonus** (+0 to +5) makes higher-tier maps genuinely harder, not just more modifiers
- Map modifiers add difficulty and reward on top:
  - "Monsters have +20% health"
  - "Monsters are extra fast"
  - "Fire enchanted monsters"
  - "Monsters fire on death"
  - "Extra Swarm enemies"
  - "Boss has 2 extra phases"
- Higher-tier maps = more modifiers stacked = better loot
- Map tier determines the **quantity and rarity bonus** of drops

### Death
- Lose a percentage of gold on death (5-10%)
- Respawn at map entrance
- No corpse run, no XP loss
- Hardcore mode: deferred until core balance is proven. Add permadeath + separate leaderboard once death scenarios feel fair

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
- NPCs: Vendor (buy/sell), Stash, Skill Trainer, Map Device, Salvage NPC
- Chat panel docked at bottom of screen (persistent across town & maps)

---

## Economy & Trading

### Currency
- **Gold** - single currency for everything
- Gold sinks: respec, stash tabs, vendor items, death penalty, map crafting, gem removal, crafting fees

### Chat Channels
Persistent chat panel at the bottom of the screen - visible whether you're in town or clearing a map. This is the social backbone.

| Channel | Purpose |
|---------|---------|
| **General** | Anything goes, main social space |
| **Trading** | Item links + offers, negotiations |
| **LFG** | Looking for group (future co-op feature) |
| **Hardcore** | Separate community for HC players (added when HC mode ships) |

- Players can **link items** in chat (hover to see stats)
- Click a player's name to **whisper** (private message)
- Right-click a player's name to **request trade**
- **Report / mute** options for moderation

### Trading
Old-school style, like D2 chat channels:
- **Negotiate in chat** - post what you have, what you want
- **Trade window** - both players place items/gold, both confirm
- **No need to be in the same place** - trade request works from any screen
- **Trust & reputation** - players learn who's reliable over time
- **Server-validated** - trade window is server-authoritative, prevents duplication

### Why No Auction House
- Auction houses kill community interaction
- Automated pricing flattens the economy (everything trends to "known value")
- Chat-based trading creates stories: "I got this insane deal from a guy who didn't know what he had"
- Forces players to *talk to each other*
- Can always add a **bulletin board** later (post WTB/WTS listings) without full automation

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

### Tech Stack
| Layer | Choice | Why |
|-------|--------|-----|
| **Renderer** | PixiJS v8 | WebGL/WebGPU batching, filters (GlowFilter, BloomFilter), ParticleContainer (1M particles @ 60fps) |
| **Language** | TypeScript | Type safety for item/affix/stat systems, better AI-assisted development |
| **Build** | Vite | Near-zero config, fast HMR, native TS support, still deploys as static files |
| **Architecture** | Hybrid ECS/OOP | miniplex ECS for mass entities (enemies, projectiles, particles); OOP for unique logic (player, bosses, UI) |
| **Audio** | Howler.js | 7KB, audio sprites for SFX, Web Audio API with HTML5 fallback |
| **Maps** | rot.js | TypeScript dungeon generator (BSP rooms + corridors), pathfinding, FOV |
| **Saves** | Dexie.js (IndexedDB) | Schema versioning, bulk ops, typed queries over raw IndexedDB |
| **Backend (v2)** | Supabase | Postgres + auth + Realtime (Broadcast for chat, Presence for online status, CDC for leaderboards) |
| **Hosting** | GitHub Pages | Static output via GitHub Actions deploy workflow |

### Client Architecture
```
src/
├── main.ts              # Entry point, async app init
├── Game.ts              # PixiJS Application, main loop, scene management
├── core/                # Engine primitives
│   ├── GameLoop.ts      # Fixed timestep logic + PixiJS ticker render
│   ├── InputManager.ts  # WASD + mouse aim
│   └── EventBus.ts      # Typed pub/sub for game events
├── ecs/                 # miniplex ECS
│   ├── world.ts         # World singleton
│   ├── components/      # Position, Velocity, Health, Damage, StatusEffect...
│   └── systems/         # Movement, Collision, Combat, Particle, StatusEffect...
├── entities/            # Entity factories (createPlayer, createEnemy, createProjectile)
├── scenes/              # GameScene, MenuScene, TownScene
├── map/                 # rot.js dungeon gen, tilemap rendering, zone themes
├── loot/                # Item generation, affix pools, rarity rolls, crafting
├── audio/               # Howler.js wrapper, SFX sprites, music manager
├── save/                # Dexie.js schema, save/load, export/import
├── ui/                  # HUD, inventory, skill bar, chat panel, trade window
├── online/              # Supabase client, auth, realtime channels (v2)
└── types/               # Shared interfaces (Item, Affix, Enemy, Skill, etc.)
```

### Performance Strategy
| Concern | Solution |
|---------|----------|
| Glow effects | PixiJS `GlowFilter` on player/bosses only; bake glow into spritesheet textures for common enemies |
| Bloom | `AdvancedBloomFilter` on effects layer only, with explicit `filterArea` |
| Particles | `ParticleContainer` with lightweight `Particle` objects, not Sprites. Budget cap, oldest fade first |
| Projectiles | Object pool (pre-allocate, recycle). Never `new` in game loop |
| Collision | Spatial hash grid (PixiJS `@pixi/spatial-hash` or custom). O(1) neighbor lookup vs O(n²) |
| Rendering | Texture atlases for batch rendering. Group by blend mode. `cullable = true` for off-screen entities |
| Scene graph | `isRenderGroup: true` on world/entity/HUD layers (GPU-side transform caching) |
| Game loop | Fixed timestep for logic, variable render. Frame time counter from M1 |
| Profiling | Track frame time from day one. Profile before optimizing |

### Server Architecture (v2 - Social Layer)
| Feature | Supabase Service | Notes |
|---------|-----------------|-------|
| **Auth** | Supabase Auth | Anonymous sign-in for frictionless start → Discord OAuth upgrade to persist |
| **Chat** | Realtime Broadcast | One channel per chat room (general, trading, lfg, hardcore). Private channels via RLS |
| **Trading** | Postgres RPC | Atomic item swap via server-side function. RLS on inventory table |
| **Leaderboards** | Postgres + CDC | Realtime subscriptions push score updates to all clients |
| **Item Registry** | Postgres | Server-generated item IDs + creation signatures for anti-cheat |
| **Presence** | Realtime Presence | "Who's online" in town hub, 10 state keys per user |

**Free tier ceiling**: ~200 concurrent WebSocket connections, 500MB database, 50K MAU. Enough for development and early access. Pro ($25/mo) bumps to 500 connections.

### Save System
- **Dexie.js** with schema versioning (handles game updates gracefully)
- Object stores: `saves` (metadata/slots), `playerState` (inventory, stats, skills), `worldState` (map progress, stash), `settings`
- Save on checkpoints: town entry, map clear, manual save
- **Cloud sync** (v2): upload save to Supabase on logout/checkpoint
- **Export/Import**: JSON file as fallback (for backup or device transfer)

---

## Milestone Roadmap

### M1: Walking Skeleton
- [ ] Canvas renderer with dark background + grid
- [ ] Player character (glowing shape) with WASD movement
- [ ] Mouse-aim projectile attack
- [ ] 1 enemy type (Rusher) that chases player
- [ ] Health bar, death, respawn
- [ ] One procedurally generated room
- [ ] Frame time counter (performance baseline)

### M2: Core Combat & Classes
- [ ] Ranger class with 4 skills (Power Shot, Multi Shot, Rain of Arrows, Evasive Roll)
- [ ] Mage class with 4 skills (Fireball, Frost Nova, Lightning Chain, Teleport)
- [ ] Skill hotbar UI (4 slots)
- [ ] 4-5 enemy types with different behaviors
- [ ] Wave spawning system with formations
- [ ] Health potion on cooldown (HoT)
- [ ] Boss encounter (1 boss)
- [ ] Status effects framework (slow, burn, shock, stun, knockback)

### M3: Loot & Itemization
- [ ] Item drop system with rarity tiers + glow colors
- [ ] Affix generation (standard + conditional affixes)
- [ ] Inventory UI with gear slots
- [ ] Equip/compare/swap items
- [ ] Stat calculation from equipped gear
- [ ] Weapon types with different projectile behavior
- [ ] Vendor NPC (buy/sell)
- [ ] Loot filter (toggle display by rarity/type)
- [ ] Salvage system + crafting materials

### M4: Progression & Maps
- [ ] Experience and leveling
- [ ] Stat point allocation
- [ ] Monster scaling formula (base level + tier bonus)
- [ ] Map items with modifiers
- [ ] Map device in town
- [ ] 3-4 zone themes
- [ ] Town hub with NPCs (vendor, stash, salvage, skill trainer)
- [ ] Stash (shared storage)
- [ ] Crafting recipes (reroll, upgrade, socket)
- [ ] Gem drops + socketing
- [ ] Save/load via IndexedDB

### M5: Polish & Content
- [ ] Remaining zone themes (5-8 total)
- [ ] More enemy types and bosses
- [ ] Unique items (8-12)
- [ ] Sound effects and music
- [ ] Minimap
- [ ] Visual effects (particles, screen shake, glow tuning)
- [ ] Balance pass on all numbers (damage, armor, resistances, scaling)
- [ ] Remaining skills for both classes (6 each)
- [ ] Colorblind / high-contrast mode
- [ ] Pixel art layer (Phase 2 visuals)

### M6: Social Layer
- [ ] Backend setup (auth, database)
- [ ] Item registry and server-side validation
- [ ] Chat system with channels (General, Trading, LFG, Hardcore)
- [ ] Item linking in chat (hover to preview stats)
- [ ] Trade window (request from chat, both confirm)
- [ ] Report / mute moderation tools
- [ ] Leaderboards
- [ ] Cloud save sync

---

## Open Questions
- Mana system: per-skill cooldowns, shared mana pool, or hybrid?
- Skill acquisition: drops only, vendor, or level-based unlocks?
- Seasons/ladder resets for the social layer?
- Mobile support? (touch controls would need design work, twin-stick style could work)
- Should maps have a timer for bonus loot (speed-clear incentive)?
- Hardcore mode: when to introduce, separate economy or shared?
- Co-op: future feature? How does monster scaling work in a party?
