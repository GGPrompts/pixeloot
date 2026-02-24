const MOVEMENT_KEYS: Record<string, { x: number; y: number }> = {
  KeyW: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 },
  KeyS: { x: 0, y: 1 },
  KeyD: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowDown: { x: 0, y: 1 },
  ArrowRight: { x: 1, y: 0 },
};

export class InputManager {
  private static _instance: InputManager | null = null;

  private pressed = new Set<string>();
  private mouse = { x: 0, y: 0 };
  private mouseButtons = new Set<number>();
  private canvas: HTMLCanvasElement;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;
  private onBlur: () => void;

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.code in MOVEMENT_KEYS) e.preventDefault();
      this.pressed.add(e.code);
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.pressed.delete(e.code);
    };

    this.onMouseMove = (e: MouseEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    };

    this.onMouseDown = (e: MouseEvent) => {
      this.mouseButtons.add(e.button);
    };

    this.onMouseUp = (e: MouseEvent) => {
      this.mouseButtons.delete(e.button);
    };

    this.onBlur = () => {
      this.pressed.clear();
      this.mouseButtons.clear();
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onBlur);
  }

  static init(canvas: HTMLCanvasElement): InputManager {
    if (!InputManager._instance) {
      InputManager._instance = new InputManager(canvas);
    }
    return InputManager._instance;
  }

  static get instance(): InputManager {
    if (!InputManager._instance) {
      throw new Error('InputManager not initialized. Call InputManager.init(canvas) first.');
    }
    return InputManager._instance;
  }

  /** Returns a normalized movement vector from WASD/arrow keys. */
  getMovementVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    for (const code of this.pressed) {
      const dir = MOVEMENT_KEYS[code];
      if (dir) {
        x += dir.x;
        y += dir.y;
      }
    }

    // Normalize diagonal movement
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) {
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  /** Returns the mouse position relative to the canvas. */
  getMousePosition(): { x: number; y: number } {
    return { x: this.mouse.x, y: this.mouse.y };
  }

  /** Returns whether a specific key is currently pressed. */
  isPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Returns whether a mouse button is currently held down. 0 = left, 2 = right. */
  isMouseDown(button = 0): boolean {
    return this.mouseButtons.has(button);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onBlur);
    InputManager._instance = null;
  }
}
