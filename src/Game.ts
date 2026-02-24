import { Application, Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js';
import { Fonts, FontSize, Colors } from './ui/UITheme';
import { InputManager } from './core/InputManager';
import { createPlayer } from './entities/Player';
import { movementSystem } from './ecs/systems/MovementSystem';
import { spriteSyncSystem } from './ecs/systems/SpriteSync';
import { playerFacingSystem } from './ecs/systems/PlayerFacingSystem';
import { cameraSystem } from './ecs/systems/CameraSystem';
import { projectileSystem } from './ecs/systems/ProjectileSystem';
import { collisionSystem } from './ecs/systems/CollisionSystem';
import { pickupSystem } from './ecs/systems/PickupSystem';

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
import { showClassSelect, isClassSelectVisible, toggleClassSelect, updateClassSelect } from './ui/ClassSelect';
import { updateInventoryPanel, isInventoryOpen } from './ui/InventoryPanel';
import { updateSaveLoadPanel, isSaveLoadPanelOpen } from './ui/SaveLoadPanel';
import { updateMapDeviceUI, isMapDeviceOpen } from './ui/MapDeviceUI';
import { updateVendorPanel, isVendorOpen } from './ui/VendorPanel';
import { updateCraftingPanel, isCraftingPanelOpen } from './ui/CraftingPanel';
import { updateStashPanel, isStashOpen } from './ui/StashPanel';
import { updateLootFilterPanel } from './ui/LootFilterPanel';
import { updateMinimap, refreshMinimapLayout } from './ui/Minimap';
import { lootFilterSystem } from './ecs/systems/LootFilterSystem';
import { getAutoSave, loadGame } from './save/SaveManager';
import { applyTheme, getActiveTheme } from './core/ZoneThemes';
import { musicPlayer } from './audio/MusicPlayer';
import { enterTown, isInTown } from './core/TownManager';
import { checkNPCClick, updateComingSoonText } from './entities/NPC';
import { updateSkillAssignPanel, isSkillAssignOpen, toggleSkillAssignPanel } from './ui/SkillAssignPanel';
import { updateRangeIndicators } from './ui/RangeIndicator';
import { SCREEN_W, SCREEN_H, TILE_SIZE, LOGIC_FPS, LOGIC_STEP } from './core/constants';

/** Returns true if any UI panel is currently open (used to prevent multiple panels). */
export function isAnyPanelOpen(): boolean {
  return isClassSelectVisible() || isInventoryOpen() || isSaveLoadPanelOpen()
    || isMapDeviceOpen() || isVendorOpen() || isCraftingPanelOpen()
    || isStashOpen() || isSkillAssignOpen();
}

/**
 * PixiJS v8 Ticker kills the entire game loop if any listener throws
 * (requestAnimationFrame is never re-scheduled). Patch _tick to add
 * error recovery so the loop survives individual listener errors.
 */
function patchTickerErrorRecovery(ticker: Ticker): void {
  const origUpdate = ticker.update.bind(ticker);
  ticker.update = (currentTime?: number) => {
    try {
      origUpdate(currentTime);
    } catch (err) {
      console.error('[Ticker] listener error (game loop preserved):', err);
    }
  };
}

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
  private prevPPressed = false;
  private prevKPressed = false;
  private prevMouseDown = false;
  private gameplayStarted = false;
  public waveSystem = new WaveSystem();
  private muteText: Text;

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

    // Apply default theme ("The Grid")
    applyTheme('the_grid');

    // Draw grid on world layer
    this.drawGrid();

    // Generate dungeon and render walls on world layer (grid shows through floor tiles)
    const dungeonW = Math.floor(SCREEN_W / TILE_SIZE);
    const dungeonH = Math.floor(SCREEN_H / TILE_SIZE);
    const dungeonData = generateDungeon(dungeonW, dungeonH);
    this.tileMap = new TileMap(dungeonData);
    this.tileMap.render(this.worldLayer, getActiveTheme().wallColor);

    // Create FPS counter on hud layer
    this.fpsText = new Text({
      text: 'FPS: --',
      style: new TextStyle({
        fill: Colors.textPrimary,
        fontSize: FontSize.base,
        fontFamily: Fonts.body,
      }),
    });
    this.fpsText.position.set(8, 8);
    this.hudLayer.addChild(this.fpsText);

    // Mute indicator (top-right)
    this.muteText = new Text({
      text: '[P] VOL 50%',
      style: new TextStyle({
        fill: Colors.accentLime,
        fontSize: FontSize.base,
        fontFamily: Fonts.body,
      }),
    });
    this.muteText.position.set(SCREEN_W - 140, 8);
    this.hudLayer.addChild(this.muteText);

    // Initialize input manager
    InputManager.init(app.canvas as HTMLCanvasElement);
  }

  /** Called after the singleton is set, so modules can access `game`. */
  private initEntities(): void {
    // Create player entity
    createPlayer();

    // Initialize skill hotbar UI
    initHotbar();

    // Start menu music
    musicPlayer.play('menu');

    // Check for autosave before showing class select
    this.checkAutoSave().then((loaded) => {
      if (loaded) {
        // Autosave was loaded, skip class select and enter town
        this.gameplayStarted = true;
        enterTown();
      } else {
        // No autosave (or declined), show class selection then enter town
        showClassSelect(() => {
          this.gameplayStarted = true;
          enterTown();
        });
      }
    });

    // Patch ticker to survive errors in listeners (PixiJS kills the loop on throw)
    patchTickerErrorRecovery(this.app.ticker);

    // Start game loop
    this.startLoop();
  }

  /** Check for autosave and offer to load it. Returns true if loaded. */
  private async checkAutoSave(): Promise<boolean> {
    try {
      const autoSaveSlot = await getAutoSave();
      if (autoSaveSlot?.id != null) {
        const shouldLoad = confirm(
          `Autosave found: Lv.${autoSaveSlot.level} ${autoSaveSlot.classType}\nLoad autosave?`,
        );
        if (shouldLoad) {
          await loadGame(autoSaveSlot.id);
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed to check autosave:', e);
    }
    return false;
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

    // Scale canvas to fill window while preserving aspect ratio
    const resizeCanvas = () => {
      const canvas = app.canvas as HTMLCanvasElement;
      const scaleX = window.innerWidth / SCREEN_W;
      const scaleY = window.innerHeight / SCREEN_H;
      const scale = Math.min(scaleX, scaleY);
      canvas.style.width = `${SCREEN_W * scale}px`;
      canvas.style.height = `${SCREEN_H * scale}px`;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Wait for custom fonts to load before initializing UI
    await document.fonts.ready;

    const g = new Game(app);
    // Set singleton before initEntities so modules importing `game` can access it
    game = g;
    g.initEntities();
    return g;
  }

  /** Draws a grid covering the viewport using the active zone theme colors. */
  private drawGrid(): void {
    const theme = getActiveTheme();
    const g = new Graphics();

    // Vertical lines
    for (let x = 0; x <= SCREEN_W; x += TILE_SIZE) {
      g.moveTo(x, 0).lineTo(x, SCREEN_H).stroke({ width: 1, color: theme.gridColor, alpha: theme.gridAlpha });
    }

    // Horizontal lines
    for (let y = 0; y <= SCREEN_H; y += TILE_SIZE) {
      g.moveTo(0, y).lineTo(SCREEN_W, y).stroke({ width: 1, color: theme.gridColor, alpha: theme.gridAlpha });
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
      if (this.gameplayStarted && (!isAnyPanelOpen() || isClassSelectVisible())) {
        toggleClassSelect();
      }
    }
    this.prevCPressed = cDown;

    // Check for 'J' key toggle (skill assignment panel) - edge detect
    const kDown = InputManager.instance.isPressed('KeyJ');
    if (kDown && !this.prevKPressed) {
      if (this.gameplayStarted && (!isAnyPanelOpen() || isSkillAssignOpen())) {
        toggleSkillAssignPanel();
      }
    }
    this.prevKPressed = kDown;

    // Music controls: P to toggle mute, +/- for volume
    const pDown = InputManager.instance.isPressed('KeyP');
    if (pDown && !this.prevPPressed) {
      musicPlayer.toggleMute();
    }
    this.prevPPressed = pDown;

    if (InputManager.instance.isPressed('Equal')) {
      // + key (=/+)
      musicPlayer.setVolume(musicPlayer.getMasterVolume() + 0.01);
    }
    if (InputManager.instance.isPressed('Minus')) {
      // - key
      musicPlayer.setVolume(musicPlayer.getMasterVolume() - 0.01);
    }

    // Skill system: tick cooldowns every frame (even during panels/town)
    skillSystem.tickSkills(dt);

    // Pause gameplay while any UI panel is open
    const panelOpen = isAnyPanelOpen();

    if (panelOpen) {
      // Keep prev-input state current so rising edges work when panel closes
      skillSystem.resetPrevInput();
      return;
    }

    // NPC click interaction in town (rising edge of left mouse), skills outside town
    if (isInTown()) {
      const mouseDown = InputManager.instance.isMouseDown(0);
      if (mouseDown && !this.prevMouseDown) {
        const mouse = InputManager.instance.getMousePosition();
        const worldPos = screenToWorld(mouse.x, mouse.y);
        checkNPCClick(worldPos.x, worldPos.y);
      }
      this.prevMouseDown = mouseDown;
      // Keep skill prev-input current while in town
      skillSystem.resetPrevInput();
    } else {
      this.prevMouseDown = InputManager.instance.isMouseDown(0);

      // Check skill input only outside town
      const playerEntities = world.with('player', 'position').entities;
      if (playerEntities.length > 0) {
        const p = playerEntities[0];
        if (!p.dead && !p.inputDisabled) {
          skillSystem.checkInput(p.position);
        } else {
          // Keep prev-input state current while stunned/dead so rising edges
          // aren't eaten when the player regains control
          skillSystem.resetPrevInput();
        }
      }
    }

    statusEffectSystem(dt);
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

    // Range indicators (after camera, before HUD)
    const playerEnts = world.with('player', 'position').entities;
    if (playerEnts.length > 0 && !isInTown()) {
      const p = playerEnts[0];
      const screenMouse = InputManager.instance.getMousePosition();
      const mouseWorld = screenToWorld(screenMouse.x, screenMouse.y);
      updateRangeIndicators(p.position, mouseWorld);
    }

    enemyHealthBarSystem();
    updateHUD();
    updateStatPanel();
    updateHotbar();
    updateBossHealthBar();
    updateClassSelect();
    updateSkillAssignPanel();
    updateInventoryPanel();
    updateSaveLoadPanel();
    updateMapDeviceUI();
    updateVendorPanel();
    updateCraftingPanel();
    updateStashPanel();
    lootFilterSystem();
    updateLootFilterPanel(dt);
    updateComingSoonText(dt);
    updateMinimap();

    // Music HUD indicator
    if (musicPlayer.isMuted()) {
      this.muteText.text = '[P] MUTED';
      this.muteText.style.fill = Colors.accentRed;
    } else {
      const pct = Math.round(musicPlayer.getMasterVolume() * 100);
      this.muteText.text = `[P] VOL ${pct}%`;
      this.muteText.style.fill = Colors.accentLime;
    }

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

/** Convert screen-space coordinates to world-space by removing camera offset. */
export function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: screenX - game.entityLayer.position.x,
    y: screenY - game.entityLayer.position.y,
  };
}

// Singleton instance — set after create() resolves
export let game: Game;

export async function boot(): Promise<Game> {
  game = await Game.create();
  return game;
}
