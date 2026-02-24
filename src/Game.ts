import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { InputManager } from './core/InputManager';
import { createPlayer } from './entities/Player';
import { movementSystem } from './ecs/systems/MovementSystem';
import { spriteSyncSystem } from './ecs/systems/SpriteSync';
import { playerFacingSystem } from './ecs/systems/PlayerFacingSystem';
import { cameraSystem } from './ecs/systems/CameraSystem';
import { projectileSystem } from './ecs/systems/ProjectileSystem';
import { collisionSystem } from './ecs/systems/CollisionSystem';
import { pickupSystem } from './ecs/systems/PickupSystem';
import { firingSystem } from './ecs/systems/FiringSystem';
import { aiSystem } from './ecs/systems/AISystem';
import { bossAISystem } from './ecs/systems/BossAISystem';
import { updateBossHealthBar } from './ui/BossHealthBar';
import { generateDungeon } from './map/DungeonGenerator';
import { TileMap } from './map/TileMap';
import { WaveSystem } from './entities/WaveSystem';
import { healthSystem } from './ecs/systems/HealthSystem';
import { enemyHealthBarSystem } from './ecs/systems/EnemyHealthBarSystem';
import { updateHUD } from './ui/HUD';
import { updateStatPanel } from './ui/StatPanel';
import { skillSystem } from './core/SkillSystem';
import { world } from './ecs/world';
import { statusEffectSystem } from './ecs/systems/StatusEffectSystem';
import { initHotbar, updateHotbar } from './ui/SkillHotbar';
import { showClassSelect, isClassSelectVisible, toggleClassSelect } from './ui/ClassSelect';
import { updateInventoryPanel, isInventoryOpen } from './ui/InventoryPanel';

const SCREEN_W = 1280;
const SCREEN_H = 720;
const TILE_SIZE = 32;
const LOGIC_FPS = 60;
const LOGIC_STEP = 1 / LOGIC_FPS;

export class Game {
  public app: Application;

  // Render layers (bottom to top)
  public worldLayer: Container;
  public entityLayer: Container;
  public effectLayer: Container;
  public hudLayer: Container;
  public tileMap!: TileMap;

  private fpsText: Text;
  private fpsTimer = 0;
  private frameCount = 0;
  private logicAccumulator = 0;
  private prevCPressed = false;
  private gameplayStarted = false;
  public waveSystem = new WaveSystem();

  private constructor(app: Application) {
    this.app = app;

    // Create render-group layers
    this.worldLayer = new Container({ isRenderGroup: true });
    this.entityLayer = new Container({ isRenderGroup: true });
    this.effectLayer = new Container(); // regular container for particles/flashes
    this.hudLayer = new Container({ isRenderGroup: true });

    // Add layers to stage in draw order
    app.stage.addChild(this.worldLayer);
    app.stage.addChild(this.entityLayer);
    app.stage.addChild(this.effectLayer);
    app.stage.addChild(this.hudLayer);

    // Draw grid on world layer
    this.drawGrid();

    // Generate dungeon and render walls on world layer (grid shows through floor tiles)
    const dungeonW = Math.floor(SCREEN_W / TILE_SIZE);
    const dungeonH = Math.floor(SCREEN_H / TILE_SIZE);
    const dungeonData = generateDungeon(dungeonW, dungeonH);
    this.tileMap = new TileMap(dungeonData);
    this.tileMap.render(this.worldLayer);

    // Create FPS counter on hud layer
    this.fpsText = new Text({
      text: 'FPS: --',
      style: new TextStyle({
        fill: 0xffffff,
        fontSize: 14,
        fontFamily: 'monospace',
      }),
    });
    this.fpsText.position.set(8, 8);
    this.hudLayer.addChild(this.fpsText);

    // Initialize input manager
    InputManager.init(app.canvas as HTMLCanvasElement);
  }

  /** Called after the singleton is set, so modules can access `game`. */
  private initEntities(): void {
    // Create player entity
    createPlayer();

    // Initialize skill hotbar UI
    initHotbar();

    // Show class selection screen before gameplay starts
    showClassSelect(() => {
      this.gameplayStarted = true;
      this.waveSystem.start();
    });

    // Start game loop
    this.startLoop();
  }

  /** Factory — creates and initialises the PixiJS application. */
  static async create(): Promise<Game> {
    const app = new Application();

    await app.init({
      width: SCREEN_W,
      height: SCREEN_H,
      backgroundColor: 0x1a1a2e,
      antialias: false,
      preference: 'webgpu',
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    document.body.appendChild(app.canvas);

    const g = new Game(app);
    // Set singleton before initEntities so modules importing `game` can access it
    game = g;
    g.initEntities();
    return g;
  }

  /** Draws a subtle cyan grid covering the viewport. */
  private drawGrid(): void {
    const g = new Graphics();

    // Vertical lines
    for (let x = 0; x <= SCREEN_W; x += TILE_SIZE) {
      g.moveTo(x, 0).lineTo(x, SCREEN_H).stroke({ width: 1, color: 0x00ffff, alpha: 0.06 });
    }

    // Horizontal lines
    for (let y = 0; y <= SCREEN_H; y += TILE_SIZE) {
      g.moveTo(0, y).lineTo(SCREEN_W, y).stroke({ width: 1, color: 0x00ffff, alpha: 0.06 });
    }

    this.worldLayer.addChild(g);
  }

  /** Sets up the ticker-based game loop with a fixed logic timestep. */
  private startLoop(): void {
    this.app.ticker.add((ticker) => {
      const dtSec = ticker.deltaTime / 60; // ticker.deltaTime is in frames (60fps=1.0)

      // --- Fixed-step logic updates ---
      this.logicAccumulator += dtSec;
      while (this.logicAccumulator >= LOGIC_STEP) {
        this.fixedUpdate(LOGIC_STEP);
        this.logicAccumulator -= LOGIC_STEP;
      }

      // --- Per-frame updates (rendering, FPS counter) ---
      this.frameUpdate(dtSec);
    });
  }

  /** Called at a fixed 60 Hz rate for deterministic game logic. */
  private fixedUpdate(dt: number): void {
    // Check for 'C' key toggle (class select) - edge detect
    const cDown = InputManager.instance.isPressed('KeyC');
    if (cDown && !this.prevCPressed) {
      if (this.gameplayStarted) {
        toggleClassSelect();
      }
    }
    this.prevCPressed = cDown;

    // Pause gameplay while class select or inventory is open
    if (isClassSelectVisible()) return;
    if (isInventoryOpen()) return;

    // Skill system: tick cooldowns and check key input
    skillSystem.tickSkills(dt);
    const playerEntities = world.with('player', 'position').entities;
    if (playerEntities.length > 0) {
      const p = playerEntities[0];
      if (!p.dead && !p.inputDisabled) {
        skillSystem.checkInput(p.position);
      }
    }

    statusEffectSystem(dt);
    firingSystem(dt);
    aiSystem(dt);
    bossAISystem(dt);
    movementSystem(dt);
    projectileSystem(dt);
    collisionSystem(dt);
    pickupSystem(dt);
    healthSystem(dt);
    this.waveSystem.update(dt);
  }

  /** Called every render frame for visual-only work. */
  private frameUpdate(dt: number): void {
    // ECS visual systems
    spriteSyncSystem();
    playerFacingSystem();
    cameraSystem();
    enemyHealthBarSystem();
    updateHUD();
    updateStatPanel();
    updateHotbar();
    updateBossHealthBar();
    updateInventoryPanel();

    // FPS counter — update display every 500 ms
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      const fps = Math.round(this.frameCount / this.fpsTimer);
      this.fpsText.text = `FPS: ${fps}`;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }
  }
}

// Singleton instance — set after create() resolves
export let game: Game;

export async function boot(): Promise<Game> {
  game = await Game.create();
  return game;
}
