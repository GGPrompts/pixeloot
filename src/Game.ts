import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

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

  private fpsText: Text;
  private fpsTimer = 0;
  private frameCount = 0;
  private logicAccumulator = 0;

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

    return new Game(app);
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
  private fixedUpdate(_dt: number): void {
    // Future: ECS system ticks, physics, AI, etc.
  }

  /** Called every render frame for visual-only work. */
  private frameUpdate(dt: number): void {
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
