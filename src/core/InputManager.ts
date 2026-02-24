import { SCREEN_W, SCREEN_H } from './constants';

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
  private _textInputActive = false;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private onPointerCancel: (e: PointerEvent) => void;
  private onLostPointerCapture: (e: PointerEvent) => void;
  private onContextMenu: (e: Event) => void;
  private onBlur: () => void;

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.onKeyDown = (e: KeyboardEvent) => {
      if (this._textInputActive) {
        // Always allow Escape through so panels can be closed
        if (e.code === 'Escape') {
          this.pressed.add(e.code);
        }
        return;
      }
      if (e.code in MOVEMENT_KEYS || e.code === 'Tab' || e.code === 'Space' || e.code === 'KeyE') e.preventDefault();
      this.pressed.add(e.code);
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.pressed.delete(e.code);
    };

    this.onPointerMove = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * SCREEN_W;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * SCREEN_H;
    };

    this.onPointerDown = (e: PointerEvent) => {
      this.mouseButtons.add(e.button);
      // Capture pointer so we always get the matching pointerup on this element,
      // even if the cursor leaves the canvas (prevents stuck buttons)
      this.canvas.setPointerCapture(e.pointerId);
    };

    this.onPointerUp = (e: PointerEvent) => {
      this.mouseButtons.delete(e.button);
    };

    this.onPointerCancel = (_e: PointerEvent) => {
      this.mouseButtons.clear();
    };

    this.onLostPointerCapture = (_e: PointerEvent) => {
      this.mouseButtons.clear();
    };

    this.onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    this.onBlur = () => {
      this.pressed.clear();
      this.mouseButtons.clear();
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('lostpointercapture', this.onLostPointerCapture);
    window.addEventListener('blur', this.onBlur);

    // Prevent browser context menu so RMB works as a skill input
    window.addEventListener('contextmenu', this.onContextMenu);
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

  /** When true, keyboard input is suppressed (e.g. UI text field has focus). */
  get textInputActive(): boolean {
    return this._textInputActive;
  }

  set textInputActive(value: boolean) {
    this._textInputActive = value;
    if (value) this.pressed.clear();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('lostpointercapture', this.onLostPointerCapture);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('contextmenu', this.onContextMenu);
    InputManager._instance = null;
  }
}
