# Pixeloot Tech Reference

Quick-reference for all libraries in the stack. See GDD.md for game design.

## Project Setup

```bash
npm create vite@latest pixeloot -- --template vanilla-ts
cd pixeloot
npm install pixi.js pixi-filters howler rot-js miniplex dexie
npm install -D @types/howler
```

## PixiJS v8

### Init (async required in v8)
```typescript
import { Application, Assets, Container, Sprite } from 'pixi.js';

async function main() {
  const app = new Application();
  await app.init({
    width: 1280, height: 720,
    backgroundColor: 0x1a1a2e,
    antialias: false,      // off for pixel art
    preference: 'webgpu',  // falls back to WebGL
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  document.body.appendChild(app.canvas);

  // Game loop
  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime;
    updateGame(dt);
  });
}
main();
```

### Layer Structure (Render Groups)
```typescript
const worldLayer  = new Container({ isRenderGroup: true });  // tiles, terrain
const entityLayer = new Container({ isRenderGroup: true });  // enemies, player, projectiles
const effectLayer = new Container();                          // particles, hit flashes
const hudLayer    = new Container({ isRenderGroup: true });  // UI, health bars, minimap
app.stage.addChild(worldLayer, entityLayer, effectLayer, hudLayer);
```

### Glow & Bloom (pixi-filters v6)
```typescript
import { GlowFilter } from 'pixi-filters/glow';
import { AdvancedBloomFilter } from 'pixi-filters/advanced-bloom';

// Per-entity glow (player, bosses only - expensive per entity)
sprite.filters = [new GlowFilter({ distance: 15, outerStrength: 2, color: 0x00ffff, quality: 0.1 })];

// Screen bloom on effects layer
effectLayer.filters = [new AdvancedBloomFilter({ threshold: 0.5, bloomScale: 0.8, blur: 8, quality: 4 })];
effectLayer.filterArea = new Rectangle(0, 0, 1280, 720); // always set explicitly
```

### ParticleContainer (1M particles @ 60fps)
```typescript
import { ParticleContainer, Particle, Rectangle } from 'pixi.js';

const particles = new ParticleContainer({
  boundsArea: new Rectangle(0, 0, 1280, 720),
  dynamicProperties: { position: true, rotation: false, scale: false, color: true },
});

const p = new Particle({ texture: sparkTex, x: 100, y: 200, tint: 0xff6600 });
particles.addParticle(p);
```

### Key v8 Changes from v7
- `app.init()` is async
- Sprites can't have children (wrap in Container)
- `cacheAsBitmap` → `cacheAsTexture(true)`
- `getBounds()` returns `Bounds` object, use `.rectangle`
- Single import: everything from `'pixi.js'`
- Filters import: `'pixi-filters/glow'` not `'@pixi/filter-glow'`

## Howler.js

### Audio Sprites (pack all SFX in one file)
```typescript
import { Howl, Howler } from 'howler';

Howler.volume(0.7);

const sfx = new Howl({
  src: ['sounds/sfx.webm', 'sounds/sfx.mp3'],
  sprite: {
    hit:      [0,    200],
    cast:     [300,  500],
    shoot:    [900,  350],
    pickup:   [1400, 300],
    die:      [1800, 500],
    uiClick:  [2400, 100],
  },
});

sfx.play('hit');
```

### Music with Crossfade
```typescript
const music = new Howl({
  src: ['music/dungeon.webm', 'music/dungeon.mp3'],
  loop: true, volume: 0, html5: true,
});
const id = music.play();
music.fade(0, 0.6, 1500, id);
```

## rot.js (Dungeon Generation)

```typescript
import { Map as RotMap } from 'rot-js';

const dungeon = new RotMap.Digger(80, 40, {
  roomWidth: [4, 12], roomHeight: [4, 8],
  corridorLength: [2, 6],
});

const tiles: number[][] = [];
dungeon.create((x, y, wall) => {
  if (!tiles[y]) tiles[y] = [];
  tiles[y][x] = wall; // 0 = floor, 1 = wall
});

const rooms = dungeon.getRooms();    // { _x1, _y1, _x2, _y2 }[]
const corridors = dungeon.getCorridors();
```

## miniplex (ECS)

```typescript
import { World } from 'miniplex';

// Define entity type
type Entity = {
  position?: { x: number; y: number };
  velocity?: { x: number; y: number };
  health?: { current: number; max: number };
  enemy?: true;
  player?: true;
  sprite?: Sprite;
};

const world = new World<Entity>();

// Create entities
const player = world.add({ position: { x: 400, y: 300 }, health: { current: 100, max: 100 }, player: true });
const enemy = world.add({ position: { x: 100, y: 100 }, velocity: { x: 1, y: 0 }, health: { current: 30, max: 30 }, enemy: true });

// Query (auto-updates as entities change)
const movers = world.with('position', 'velocity');
const enemies = world.with('enemy', 'position', 'health');

// System
function movementSystem(dt: number) {
  for (const { position, velocity } of movers) {
    position.x += velocity.x * dt;
    position.y += velocity.y * dt;
  }
}
```

## Dexie.js (Save System)

```typescript
import Dexie, { type EntityTable } from 'dexie';

interface SaveSlot { id?: number; name: string; timestamp: number; }
interface PlayerState { saveId: number; level: number; stats: object; inventory: object; }
interface WorldState { saveId: number; mapProgress: object; stash: object; }

const db = new Dexie('pixeloot') as Dexie & {
  saves: EntityTable<SaveSlot, 'id'>;
  playerState: EntityTable<PlayerState, 'saveId'>;
  worldState: EntityTable<WorldState, 'saveId'>;
};

db.version(1).stores({
  saves: '++id, name, timestamp',
  playerState: 'saveId',
  worldState: 'saveId',
});

// Save
await db.saves.add({ name: 'Slot 1', timestamp: Date.now() });
await db.playerState.put({ saveId: 1, level: 12, stats: {...}, inventory: {...} });

// Load
const save = await db.playerState.get(1);
```

## Supabase (v2 Social Layer)

### Client Setup
```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### Auth (anonymous → Discord upgrade)
```typescript
// Start anonymous
await supabase.auth.signInAnonymously();

// Upgrade later
await supabase.auth.linkIdentity({ provider: 'discord' });
```

### Chat via Broadcast
```typescript
const channel = supabase.channel('chat:trading');

// Send
channel.send({ type: 'broadcast', event: 'message', payload: { user: 'Hero', text: 'WTS rare bow +14 dmg' } });

// Receive
channel.on('broadcast', { event: 'message' }, ({ payload }) => {
  addChatMessage(payload.user, payload.text);
}).subscribe();
```

### Trade via RPC (atomic swap)
```sql
-- Server-side function
create function execute_trade(sender_id uuid, receiver_id uuid, offer jsonb, request jsonb)
returns void language plpgsql security definer as $$
begin
  -- validate ownership, swap items, log trade
end;
$$;
```
```typescript
await supabase.rpc('execute_trade', { sender_id, receiver_id, offer, request });
```

### Leaderboard with Realtime
```typescript
supabase.channel('leaderboard')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' },
    (payload) => updateLeaderboardUI(payload.new))
  .subscribe();
```

## Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pixeloot/',  // for GitHub Pages
  resolve: { alias: { '@': '/src' } },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: { pixi: ['pixi.js'], howler: ['howler'] },
      },
    },
  },
});
```

## Key Links
- [PixiJS v8 docs](https://pixijs.com/8.x/guides)
- [PixiJS v8 migration](https://pixijs.com/8.x/guides/migrations/v8)
- [pixi-filters](https://github.com/pixijs/filters)
- [PixiJS open-games (examples)](https://github.com/pixijs/open-games)
- [PixiJS performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips)
- [Howler.js](https://howlerjs.com/)
- [rot.js](https://github.com/ondras/rot.js)
- [miniplex](https://github.com/hmans/miniplex)
- [Dexie.js](https://dexie.org/)
- [Supabase docs](https://supabase.com/docs)
- [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits)
- [Vite static deploy](https://vite.dev/guide/static-deploy)
