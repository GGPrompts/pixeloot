# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173/pixeloot/)
npm run build     # TypeScript check + Vite production build
npm run preview   # Serve production build locally
```

No test runner is configured. Quality gate is `npm run build` (tsc strict mode + vite bundle). Testing is manual play-testing in the browser.

## Project Overview

Pixeloot is a browser-based ARPG built with TypeScript, PixiJS v8, and a Miniplex ECS. The game logic runs at a fixed 1280x720 resolution with 60Hz logic step, CSS-scaled to fill the browser window. Uses procedural audio (no asset files for SFX/music). See GDD.md for design pillars and TECH-REFERENCE.md for library API patterns.

## Architecture

### Game Loop (Game.ts)

`Game.boot()` initializes PixiJS, creates render layers, and starts the ticker. The main loop splits into:
- **Fixed logic step** (60Hz): ECS systems, skill cooldowns, wave spawning, status effects
- **Frame update**: sprite sync, camera, HUD, UI panels

Constants: `SCREEN_W=1280`, `SCREEN_H=720`, `TILE_SIZE=32`, `LOGIC_FPS=60`

### Render Layers (bottom to top)

`worldLayer` (grid/tiles) → `entityLayer` (player/enemies/projectiles) → `effectLayer` (particles/damage numbers) → `hudLayer` (UI panels/minimap). First three are `isRenderGroup=true`.

### Camera and Coordinate Spaces

The camera centers on the player by offsetting `worldLayer`, `entityLayer`, and `effectLayer`. The `hudLayer` stays in screen space. Use `screenToWorld(screenX, screenY)` from Game.ts when converting mouse/screen coordinates to world positions (e.g., for aiming, NPC clicks, skill targeting).

### ECS (ecs/)

- **world.ts** defines the `Entity` type — a single interface with ~50 optional component properties. Entities only carry the components they need.
- **systems/** contains 16 system functions, each querying the world for entities with specific components and running per-frame logic (movement, collision, AI, health, projectiles, etc.).
- Systems are called explicitly from Game.ts's ticker, not auto-discovered.

### Key Singletons

- `game` (Game.ts) — PixiJS app, render layers, tileMap, game loop
- `world` (ecs/world.ts) — Miniplex ECS world instance
- `inventory` (core/Inventory.ts) — per-class equipment (8 slots) and 20-slot backpack, plus shared maps/gems. `getGearState()`/`setGearState()`/`clearGear()` support class switching. Items have level requirements enforced on equip (`item.level > player.level` blocks equip)
- `skillSystem` (core/SkillSystem.ts) — slot-based skill management (LMB/RMB/Space/E), assignment, cooldowns
- `musicPlayer` / `sfxPlayer` — procedural audio (Web Audio API, no external files)

### Loot System (loot/)

Item generation pipeline: `ItemGenerator` → `AffixRoller` → `NameGenerator`. Items have a rarity (Normal/Magic/Rare/Unique), a slot type, and 0-4 rolled affixes. `DropTable` handles weight-based drops. `UniqueItems.ts` defines 12 fixed-effect uniques with `effectId` fields — all 12 have runtime implementations via `UniqueEffects.ts` (skill modifiers, on-kill/on-hit triggers, passives, system hooks like cheat-death). Crafting (salvage/reroll/upgrade/socket/gem removal) is in `Crafting.ts`, UI in `CraftingPanel.ts`.

### Stats (core/ComputedStats.ts)

Aggregates affixes from all equipped gear into flat + percentage bonuses. Syncs derived values (health, speed, damage) to the player entity. Fires `onGearChange()` callbacks. Two distinct speed stats: **attackSpeed** (from weapons, Dexterity, gear affixes) scales the LMB primary attack cooldown only; **cooldownReduction** (from Focus stat, gear CDR affixes, capped at 40%) scales all 4 skill slot cooldowns. Cooldowns always tick, even while panels are open or in town. Armor damage reduction scales with monster level: `getDamageReduction(monsterLevel)` returns `armor / (armor + 100 + 10 * monsterLevel)` per GDD formula.

### Dungeon Generation and Pathfinding (map/)

Uses rot-js Digger algorithm. `DungeonGenerator.ts` produces a tile grid (~80x50 tiles), widens corridors to 3 tiles in post-processing, `TileMap.ts` renders it. Player spawns in the center of the first room. `Pathfinding.ts` maintains a BFS flow field from the player's tile that enemies query for wall-aware navigation (rebuilt only when the player changes tiles).

### Monster Scaling and Map Modifiers

Monster level = `max(mapBaseLevel, playerLevel - 2) + mapTierBonus`. Map tier (1-5) is wired through `MapDevice.getActiveTierBonus()` into WaveSystem and EnemySpawner. All 7 map modifiers are functional: hp_boost, speed_boost, extra_swarm, fire_enchanted (Burn on hit), explode_on_death (volatile AoE), resist_first_hit (iron skin absorbs first hit), boss_phases (empowered boss with 5 phases). Stat respec available in StatPanel for gold (`level * 50`).

### Save System (save/)

Dexie (IndexedDB) with schema v3. Tables: `saves` (slot metadata), `playerState` (shared: gold, maps, gems, last active class), `classState` (per-class: level, XP, stats, equipped gear, backpack, skill assignments), `inventoryState` (legacy v1/v2 compat), `worldState` (wave number), `stashState`. Each class (Ranger/Mage) has independent progression stored in `classState` keyed by `[saveId+classType]`. `switchClass()` in SaveManager.ts saves current class to a staging area (saveId=0) and loads/creates the target class. Auto-save on key events, optional load on startup. Backward-compatible with v1/v2 saves via legacy fallback in `loadGame()`.

### UI (ui/)

All UI is PixiJS-native (Container/Graphics/Text). Each panel exports an `update*()` function called from the game loop and an `is*Open()` predicate for input gating. No DOM framework. All panels close with Escape and have a clickable `[X] close` button.

**Theme system** — All colors, fonts, and drawing helpers are centralized in `src/ui/UITheme.ts`. When adding or modifying UI:
- Import `Colors`, `Fonts`, `FontSize` from `UITheme.ts` — never hardcode hex colors or font strings
- Use `drawPanelBg()` for panel backgrounds (navy fill + 3D pixel border)
- Use `drawPixelBorder()` for 3D chunky borders (highlight top/left, shadow bottom/right)
- Use `drawSlotBg()` for item/skill slots, `drawDivider()` for section separators
- Use `makeCloseButton()` for standard [X] close buttons
- Use `abbreviate()` for truncating item names, `getRarityColor()` for rarity lookups
- Fonts: `Fonts.display` ('Press Start 2P') for titles/labels, `Fonts.body` ('VT323') for body text
- Font sizes: xs=12, sm=14, base=16, lg=18, xl=20, 2xl=24, 3xl=28 — minimum 12px for readability
- Rarity colors: Normal `0xBCBCBC`, Magic `0x4488FF`, Rare `0xFCBF00`, Unique `0xFF7700`
- Shared tooltip logic lives in `src/ui/Tooltip.ts` (used by InventoryPanel, VendorPanel, StashPanel)

### Character Classes (entities/classes/)

Ranger (bow/dexterity) and Mage (spell/intelligence), each with 6 skills and **separate progression** (level, XP, stat points, stats, gear, backpack). Shared across classes: gold, maps, gems, stash. Switching classes (C key) saves current class state and loads the other via `switchClass()` in SaveManager.ts. Items have level requirements — can't equip high-level gear on a fresh alt. Transfer items between classes via the shared stash.

Controls: LMB (primary attack, hold-to-fire), RMB (assignable, single-press), Space (movement skill, single-press), E (assignable, single-press). Players assign 2 of 4 assignable skills to RMB/E via the skill assignment panel (J key). Panel hotkeys: I (inventory), V (vendor), K (crafting), M (map device), J (skill assign), C (class select), Tab (stats). Only one panel can be open at a time — `isAnyPanelOpen()` in Game.ts guards all toggles. Each `SkillDef` has `slotType` ('primary'|'movement'|'assignable') and `targetType` for input routing and range indicators. Primary attacks have short base cooldowns (Ranger 0.4s, Mage 0.5s) scaled by attackSpeed; other skills have longer cooldowns scaled by CDR only.

### Audio (audio/)

100% procedural — `ChipPlayer.ts` generates chip-tune music tracks, `SFXManager.ts` synthesizes sound effects via Web Audio oscillators and noise. No audio asset files.

## Conventions

- Path alias: `@/*` maps to `src/*`
- Vite base path is `/pixeloot/` (GitHub Pages deployment)
- 4-stat system: Dexterity, Intelligence, Vitality, Focus. No crit, no leech — by design (see GDD.md)
- Enemy types distinguished by shape AND color (colorblind accessible)
- Issue tracking uses `bd` (beads), not markdown files or TodoWrite
