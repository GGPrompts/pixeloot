import { InputManager } from './InputManager';

export interface SkillDef {
  name: string;
  key: string;          // hotbar key: '1', '2', '3', '4'
  cooldown: number;     // seconds
  execute: (playerPos: { x: number; y: number }, mousePos: { x: number; y: number }) => void;
}

export interface SkillState {
  def: SkillDef;
  cooldownRemaining: number;
}

const KEY_CODES: Record<string, string> = {
  '1': 'Digit1',
  '2': 'Digit2',
  '3': 'Digit3',
  '4': 'Digit4',
};

class SkillSystem {
  private skills: SkillState[] = [];
  private prevPressed = new Set<string>();

  /** Set the current class skills (replaces all). */
  setClass(defs: SkillDef[]): void {
    this.skills = defs.map((def) => ({
      def,
      cooldownRemaining: 0,
    }));
  }

  /** Decrease cooldowns each tick. */
  tickSkills(dt: number): void {
    for (const skill of this.skills) {
      if (skill.cooldownRemaining > 0) {
        skill.cooldownRemaining -= dt;
        if (skill.cooldownRemaining < 0) skill.cooldownRemaining = 0;
      }
    }
  }

  /** Try to use a skill by index (0-3). Returns true if it fired. */
  tryUseSkill(
    index: number,
    playerPos: { x: number; y: number },
    mousePos: { x: number; y: number },
  ): boolean {
    const skill = this.skills[index];
    if (!skill) return false;
    if (skill.cooldownRemaining > 0) return false;

    skill.def.execute(playerPos, mousePos);
    skill.cooldownRemaining = skill.def.cooldown;
    return true;
  }

  /**
   * Check key presses (1-4) and trigger skills.
   * Must be called each tick with player position.
   */
  checkInput(playerPos: { x: number; y: number }): void {
    const input = InputManager.instance;
    const mousePos = input.getMousePosition();

    for (let i = 0; i < this.skills.length; i++) {
      const keyCode = KEY_CODES[this.skills[i].def.key];
      if (!keyCode) continue;

      const isDown = input.isPressed(keyCode);
      const wasDown = this.prevPressed.has(keyCode);

      // Only trigger on key-down edge (not held)
      if (isDown && !wasDown) {
        this.tryUseSkill(i, playerPos, mousePos);
      }

      if (isDown) {
        this.prevPressed.add(keyCode);
      } else {
        this.prevPressed.delete(keyCode);
      }
    }
  }

  /** Get skill states for HUD display. */
  getSkills(): readonly SkillState[] {
    return this.skills;
  }
}

export const skillSystem = new SkillSystem();
