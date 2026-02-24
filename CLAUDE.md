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
- `inventory` (core/Inventory.ts) — player equipment (8 slots + offhand) and 20-slot backpack
- `skillSystem` (core/SkillSystem.ts) — skill management, hotbar binding
- `musicPlayer` / `sfxPlayer` — procedural audio (Web Audio API, no external files)

### Loot System (loot/)

Item generation pipeline: `ItemGenerator` → `AffixRoller` → `NameGenerator`. Items have a rarity (Normal/Magic/Rare/Unique), a slot type, and 0-4 rolled affixes. `DropTable` handles weight-based drops. `UniqueItems.ts` defines fixed-effect uniques. Crafting (salvage/reroll/upgrade/socket) is in `CraftingSystem.ts`.

### Stats (core/ComputedStats.ts)

Aggregates affixes from all equipped gear into flat + percentage bonuses. Syncs derived values (health, speed, damage) to the player entity. Fires `onGearChange()` callbacks.

### Dungeon Generation and Pathfinding (map/)

Uses rot-js Digger algorithm. `DungeonGenerator.ts` produces a tile grid (~80x50 tiles), widens corridors to 3 tiles in post-processing, `TileMap.ts` renders it. Player spawns in the center of the first room. `Pathfinding.ts` maintains a BFS flow field from the player's tile that enemies query for wall-aware navigation (rebuilt only when the player changes tiles).

### Save System (save/)

Dexie (IndexedDB) with tables: saves, playerState, inventoryState, worldState, stashState. Auto-save on key events, optional load on startup.

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

Ranger (bow/dexterity) and Mage (spell/intelligence), each with 6 skills. Players select 4 active skills for the hotbar (keys 1-4).

### Audio (audio/)

100% procedural — `ChipPlayer.ts` generates chip-tune music tracks, `SFXManager.ts` synthesizes sound effects via Web Audio oscillators and noise. No audio asset files.

## Conventions

- Path alias: `@/*` maps to `src/*`
- Vite base path is `/pixeloot/` (GitHub Pages deployment)
- 4-stat system: Dexterity, Intelligence, Vitality, Focus. No crit, no leech — by design (see GDD.md)
- Enemy types distinguished by shape AND color (colorblind accessible)
- Issue tracking uses `bd` (beads), not markdown files or TodoWrite
