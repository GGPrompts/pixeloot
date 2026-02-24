/**
 * SFXManager -- Singleton Web Audio-based sound effects system.
 * All sounds are procedurally synthesized using oscillators, noise, and envelopes.
 * No external audio files needed.
 */

type SFXDefinition = (ctx: AudioContext, dest: GainNode) => void;

class SFXManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 0.5;
  private muted = false;
  private contextResumed = false;

  constructor() {
    // Auto-resume AudioContext on first user interaction (browser requirement)
    const resumeHandler = () => {
      this.contextResumed = true;
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      document.removeEventListener('click', resumeHandler);
      document.removeEventListener('keydown', resumeHandler);
      document.removeEventListener('pointerdown', resumeHandler);
    };
    document.addEventListener('click', resumeHandler);
    document.addEventListener('keydown', resumeHandler);
    document.addEventListener('pointerdown', resumeHandler);
  }

  /** Lazily create AudioContext and master gain. */
  private ensureContext(): { ctx: AudioContext; dest: GainNode } {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return { ctx: this.ctx, dest: this.masterGain! };
  }

  /** Play a named sound effect. */
  play(sfxName: string): void {
    const def = SFX_DEFINITIONS[sfxName];
    if (!def) {
      console.warn(`SFXManager: unknown sfx "${sfxName}"`);
      return;
    }
    const { ctx, dest } = this.ensureContext();
    try {
      def(ctx, dest);
    } catch (e) {
      // Silently swallow audio errors (e.g. too many oscillators)
    }
  }

  /** Set master volume (0-1). */
  setVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (!this.muted && this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  /** Get master volume (0-1). */
  getMasterVolume(): number {
    return this.masterVolume;
  }

  /** Toggle mute on/off. Returns the new muted state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
    return this.muted;
  }

  /** Check if currently muted. */
  isMuted(): boolean {
    return this.muted;
  }
}

// ---------------------------------------------------------------------------
// Helper utilities for building procedural sounds
// ---------------------------------------------------------------------------

/** Create a white noise buffer. */
function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Play a noise burst with amplitude envelope. */
function noiseBurst(
  ctx: AudioContext,
  dest: AudioNode,
  opts: { duration: number; attack?: number; decay: number; volume?: number; filterFreq?: number },
): void {
  const now = ctx.currentTime;
  const vol = opts.volume ?? 0.4;
  const attack = opts.attack ?? 0.005;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, opts.duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + opts.decay);

  if (opts.filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = opts.filterFreq;
    noise.connect(filter);
    filter.connect(gain);
  } else {
    noise.connect(gain);
  }

  gain.connect(dest);
  noise.start(now);
  noise.stop(now + opts.duration);
}

/** Play a tone with ADSR-like envelope. */
function tonePulse(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    frequency: number;
    type?: OscillatorType;
    duration: number;
    attack?: number;
    decay?: number;
    volume?: number;
    freqEnd?: number;
    detune?: number;
  },
): void {
  const now = ctx.currentTime;
  const vol = opts.volume ?? 0.3;
  const attack = opts.attack ?? 0.005;
  const decay = opts.decay ?? opts.duration;

  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.frequency, now);
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(opts.freqEnd, 20), now + opts.duration);
  }
  if (opts.detune) {
    osc.detune.value = opts.detune;
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + opts.duration + 0.05);
}

/** Play a simple blip (short sine tone). */
function blip(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  delay: number = 0,
  volume: number = 0.25,
): void {
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(now);
  osc.stop(now + 0.12);
}

// ---------------------------------------------------------------------------
// Sound effect definitions
// ---------------------------------------------------------------------------

const SFX_DEFINITIONS: Record<string, SFXDefinition> = {
  /**
   * hit_physical - Short noise burst with quick decay (sword/arrow impact)
   */
  hit_physical(ctx, dest) {
    noiseBurst(ctx, dest, { duration: 0.15, decay: 0.1, volume: 0.35, filterFreq: 3000 });
    // Low thud component
    tonePulse(ctx, dest, { frequency: 120, type: 'sine', duration: 0.08, decay: 0.06, volume: 0.2 });
  },

  /**
   * hit_magic - Sine sweep down with shimmer
   */
  hit_magic(ctx, dest) {
    tonePulse(ctx, dest, {
      frequency: 800,
      freqEnd: 200,
      type: 'sine',
      duration: 0.25,
      decay: 0.2,
      volume: 0.25,
    });
    // Shimmer overtone
    tonePulse(ctx, dest, {
      frequency: 1600,
      freqEnd: 400,
      type: 'sine',
      duration: 0.2,
      decay: 0.15,
      volume: 0.1,
    });
    noiseBurst(ctx, dest, { duration: 0.1, decay: 0.08, volume: 0.1, filterFreq: 5000 });
  },

  /**
   * cast_ranger - Quick bow twang (sawtooth pluck)
   */
  cast_ranger(ctx, dest) {
    tonePulse(ctx, dest, {
      frequency: 300,
      freqEnd: 150,
      type: 'sawtooth',
      duration: 0.15,
      attack: 0.002,
      decay: 0.12,
      volume: 0.2,
    });
    // String vibration
    tonePulse(ctx, dest, {
      frequency: 600,
      freqEnd: 300,
      type: 'triangle',
      duration: 0.1,
      attack: 0.002,
      decay: 0.08,
      volume: 0.1,
    });
  },

  /**
   * cast_mage - Magical shimmer (rising sine with harmonics)
   */
  cast_mage(ctx, dest) {
    tonePulse(ctx, dest, {
      frequency: 400,
      freqEnd: 900,
      type: 'sine',
      duration: 0.3,
      attack: 0.01,
      decay: 0.25,
      volume: 0.2,
    });
    // Harmonic shimmer
    tonePulse(ctx, dest, {
      frequency: 800,
      freqEnd: 1800,
      type: 'sine',
      duration: 0.25,
      attack: 0.02,
      decay: 0.2,
      volume: 0.1,
    });
    tonePulse(ctx, dest, {
      frequency: 1200,
      freqEnd: 2700,
      type: 'sine',
      duration: 0.2,
      attack: 0.03,
      decay: 0.15,
      volume: 0.05,
    });
  },

  /**
   * pickup_normal - Simple blip
   */
  pickup_normal(ctx, dest) {
    blip(ctx, dest, 660, 0, 0.2);
  },

  /**
   * pickup_magic - Double blip higher pitch
   */
  pickup_magic(ctx, dest) {
    blip(ctx, dest, 880, 0, 0.2);
    blip(ctx, dest, 1100, 0.08, 0.2);
  },

  /**
   * pickup_rare - Triple ascending blip
   */
  pickup_rare(ctx, dest) {
    blip(ctx, dest, 880, 0, 0.22);
    blip(ctx, dest, 1100, 0.08, 0.22);
    blip(ctx, dest, 1320, 0.16, 0.25);
  },

  /**
   * pickup_unique - Dramatic chord
   */
  pickup_unique(ctx, dest) {
    // Major chord: root, third, fifth, octave
    const freqs = [440, 554, 660, 880];
    for (const freq of freqs) {
      tonePulse(ctx, dest, {
        frequency: freq,
        type: 'sine',
        duration: 0.6,
        attack: 0.01,
        decay: 0.5,
        volume: 0.12,
      });
    }
    // Shimmer noise
    noiseBurst(ctx, dest, { duration: 0.3, attack: 0.01, decay: 0.25, volume: 0.06, filterFreq: 6000 });
  },

  /**
   * pickup_gold - Quick coin sound
   */
  pickup_gold(ctx, dest) {
    blip(ctx, dest, 1200, 0, 0.15);
    blip(ctx, dest, 1500, 0.05, 0.15);
  },

  /**
   * pickup_map - Special map pickup
   */
  pickup_map(ctx, dest) {
    blip(ctx, dest, 600, 0, 0.2);
    blip(ctx, dest, 800, 0.1, 0.2);
    blip(ctx, dest, 600, 0.2, 0.15);
  },

  /**
   * pickup_gem - Gem pickup sound
   */
  pickup_gem(ctx, dest) {
    tonePulse(ctx, dest, {
      frequency: 1000,
      freqEnd: 1500,
      type: 'sine',
      duration: 0.2,
      attack: 0.005,
      decay: 0.15,
      volume: 0.2,
    });
    blip(ctx, dest, 1500, 0.1, 0.18);
  },

  /**
   * enemy_death - Short descending noise burst
   */
  enemy_death(ctx, dest) {
    noiseBurst(ctx, dest, { duration: 0.2, decay: 0.15, volume: 0.3, filterFreq: 2000 });
    tonePulse(ctx, dest, {
      frequency: 300,
      freqEnd: 80,
      type: 'square',
      duration: 0.2,
      decay: 0.15,
      volume: 0.15,
    });
  },

  /**
   * player_death - Low dramatic tone
   */
  player_death(ctx, dest) {
    tonePulse(ctx, dest, {
      frequency: 150,
      freqEnd: 50,
      type: 'sawtooth',
      duration: 1.0,
      attack: 0.05,
      decay: 0.9,
      volume: 0.3,
    });
    tonePulse(ctx, dest, {
      frequency: 100,
      freqEnd: 40,
      type: 'sine',
      duration: 1.2,
      attack: 0.1,
      decay: 1.0,
      volume: 0.2,
    });
    noiseBurst(ctx, dest, { duration: 0.5, attack: 0.05, decay: 0.4, volume: 0.15, filterFreq: 1000 });
  },

  /**
   * level_up - Ascending arpeggio fanfare
   */
  level_up(ctx, dest) {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    const spacing = 0.1;
    for (let i = 0; i < notes.length; i++) {
      tonePulse(ctx, dest, {
        frequency: notes[i],
        type: 'square',
        duration: 0.3,
        attack: 0.005,
        decay: 0.25,
        volume: 0.15,
      });
      blip(ctx, dest, notes[i], i * spacing, 0.2);
    }
    // Final chord sustain
    for (const freq of [523, 659, 784, 1047]) {
      const now = ctx.currentTime + notes.length * spacing;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.65);
    }
  },

  /**
   * ui_click - Soft click
   */
  ui_click(ctx, dest) {
    tonePulse(ctx, dest, {
      frequency: 1000,
      type: 'sine',
      duration: 0.05,
      attack: 0.002,
      decay: 0.03,
      volume: 0.15,
    });
  },

  /**
   * potion_use - Bubbling sound
   */
  potion_use(ctx, dest) {
    // Series of quick random-pitch blips to simulate bubbling
    const bubbleCount = 6;
    for (let i = 0; i < bubbleCount; i++) {
      const delay = i * 0.06 + Math.random() * 0.03;
      const freq = 400 + Math.random() * 600;
      const now = ctx.currentTime + delay;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.04);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.08);
    }
    // Underlying soft tone
    tonePulse(ctx, dest, {
      frequency: 300,
      freqEnd: 500,
      type: 'sine',
      duration: 0.4,
      attack: 0.02,
      decay: 0.35,
      volume: 0.1,
    });
  },
};

/** Singleton SFX manager instance */
export const sfxPlayer = new SFXManager();
