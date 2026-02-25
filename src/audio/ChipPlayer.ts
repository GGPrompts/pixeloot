/**
 * ChipPlayer -- Minimal chiptune playback engine.
 * TypeScript ES module port of the original IIFE-based playback-engine.js.
 * Plays compact song JSON exported by the tracker using Web Audio API oscillators.
 * No audio files needed.
 */

// ---- Song data types ----

export interface Instrument {
  name?: string;
  wave?: string;
  vol?: number;
  a?: number;
  d?: number;
  s?: number;
  r?: number;
  detune?: number;
  detuneOsc?: boolean;
  detuneAmount?: number;
  filterType?: string;
  filterFreq?: number;
  filterQ?: number;
  fmRatio?: number;
  fmDepth?: number;
  fmWave?: OscillatorType;
}

/** Compact cell: [midi, instrumentIndex, duration, velocity?] or null for empty */
export type Cell = [number, number, number, number?] | null;

export interface Pattern {
  id?: number;
  len: number;
  name?: string;
  ch?: (Cell | null)[][];
  /** Tracker-native format with event objects */
  channels?: { r: number; n: number; i: number; d?: number; v?: number }[][];
}

export interface SongData {
  title?: string;
  bpm: number;
  rpb?: number;
  rowsPerBeat?: number;
  instruments: Instrument[];
  patterns: Pattern[];
  seq?: number[][];
  sequence?: number[][];
  loopStartSeq?: number;
  loopEndSeq?: number;
  shortEndSeq?: number;
  channels?: { name: string }[];
}

// ---- ChipPlayer class ----

export class ChipPlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private pulseWaves: Record<string, PeriodicWave> = {};
  private playing = false;
  private paused = false;
  private song: SongData | null = null;
  private timerID: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private seqIndex = 0;
  private rowIndex = 0;
  private shortMode = false;
  private onEndCallback: (() => void) | null = null;
  private ownsContext = false;

  private static readonly SCHEDULE_AHEAD = 0.1;
  private static readonly TIMER_INTERVAL = 25;

  // ---- Helpers ----

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private buildPulseWave(duty: number): PeriodicWave {
    const harmonics = 64;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let n = 1; n <= harmonics; n++) {
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }
    return this.ctx!.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  private createNoiseBuffer(): AudioBuffer {
    const len = Math.ceil(this.ctx!.sampleRate * 2);
    const buf = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private secondsPerRow(): number {
    const rpb = this.song!.rpb ?? this.song!.rowsPerBeat ?? 4;
    return 60 / (this.song!.bpm * rpb);
  }

  // ---- Playback note ----

  private playNote(midi: number, inst: Instrument, time: number, durationRows: number, velocity?: number): void {
    const ctx = this.ctx!;
    const vol = (inst.vol !== undefined ? inst.vol : 0.8) * (velocity != null ? velocity / 15 : 1);
    const a = inst.a ?? 0.01;
    const d = inst.d ?? 0.1;
    const s = inst.s !== undefined ? inst.s : 0.6;
    const r = inst.r ?? 0.1;
    const rows = durationRows || 1;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(vol, time + a);
    gainNode.gain.linearRampToValueAtTime(vol * s, time + a + d);

    const releaseAt = time + this.secondsPerRow() * rows - 0.005;
    gainNode.gain.setValueAtTime(vol * s, releaseAt);
    gainNode.gain.linearRampToValueAtTime(0, releaseAt + r);

    const endTime = releaseAt + r + 0.05;
    let dest: AudioNode = gainNode;

    // Optional filter
    if (inst.filterType && inst.filterType !== 'none') {
      const filter = ctx.createBiquadFilter();
      filter.type = inst.filterType as BiquadFilterType;
      filter.frequency.setValueAtTime(inst.filterFreq ?? 2000, time);
      filter.Q.setValueAtTime(inst.filterQ ?? 1, time);
      filter.connect(gainNode);
      dest = filter;
    }

    const freq = this.midiToFreq(midi);
    const wave = inst.wave ?? 'square';

    if (wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      src.connect(dest);
      src.start(time);
      src.stop(endTime);
    } else if (wave === 'pluck') {
      this.playPluck(ctx, freq, inst, time, endTime, dest);
    } else if (wave === 'fm') {
      this.playFM(ctx, freq, inst, time, endTime, dest);
    } else {
      this.playOscillator(ctx, freq, wave, inst, time, endTime, dest);
    }

    gainNode.connect(this.masterGain!);
  }

  private playPluck(ctx: AudioContext, freq: number, inst: Instrument, time: number, endTime: number, dest: AudioNode): void {
    const period = 1 / freq;
    const burstDur = 0.02;
    const brightness = inst.filterFreq ?? 4000;

    const burstLen = Math.ceil(ctx.sampleRate * (burstDur + 0.01));
    const burstBuf = ctx.createBuffer(1, burstLen, ctx.sampleRate);
    const burstData = burstBuf.getChannelData(0);
    for (let i = 0; i < burstLen; i++) burstData[i] = Math.random() * 2 - 1;

    const burstSrc = ctx.createBufferSource();
    burstSrc.buffer = burstBuf;

    const pluckDelay = ctx.createDelay(1);
    pluckDelay.delayTime.setValueAtTime(period, time);

    const fbGain = ctx.createGain();
    fbGain.gain.setValueAtTime(0.996, time);
    fbGain.gain.linearRampToValueAtTime(0, endTime);

    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass';
    fbFilter.frequency.setValueAtTime(brightness, time);
    fbFilter.Q.setValueAtTime(0.5, time);

    const airGain = brightness > 5000 ? 0.5 : brightness > 3500 ? 1.0 : 1.5;

    const bodyLow = ctx.createBiquadFilter();
    bodyLow.type = 'peaking';
    bodyLow.frequency.setValueAtTime(190, time);
    bodyLow.Q.setValueAtTime(0.8, time);
    bodyLow.gain.setValueAtTime(3, time);

    const bodyMid = ctx.createBiquadFilter();
    bodyMid.type = 'peaking';
    bodyMid.frequency.setValueAtTime(820, time);
    bodyMid.Q.setValueAtTime(0.7, time);
    bodyMid.gain.setValueAtTime(2, time);

    const bodyAir = ctx.createBiquadFilter();
    bodyAir.type = 'peaking';
    bodyAir.frequency.setValueAtTime(2800, time);
    bodyAir.Q.setValueAtTime(0.6, time);
    bodyAir.gain.setValueAtTime(airGain, time);

    burstSrc.connect(pluckDelay);
    pluckDelay.connect(fbFilter);
    fbFilter.connect(fbGain);
    fbGain.connect(pluckDelay);
    fbGain.connect(bodyLow);
    bodyLow.connect(bodyMid);
    bodyMid.connect(bodyAir);
    bodyAir.connect(dest);

    burstSrc.start(time);
    burstSrc.stop(time + burstDur);

    // Optional detuned 2nd pluck
    if (inst.detuneOsc && inst.detuneAmount) {
      const freq2p = freq * Math.pow(2, inst.detuneAmount / 1200);
      const burstBuf2 = ctx.createBuffer(1, burstLen, ctx.sampleRate);
      const bd2 = burstBuf2.getChannelData(0);
      for (let i = 0; i < burstLen; i++) bd2[i] = Math.random() * 2 - 1;

      const burstSrc2 = ctx.createBufferSource();
      burstSrc2.buffer = burstBuf2;

      const pluckDelay2 = ctx.createDelay(1);
      pluckDelay2.delayTime.setValueAtTime(1 / freq2p, time);

      const fbGain2 = ctx.createGain();
      fbGain2.gain.setValueAtTime(0.996, time);
      fbGain2.gain.linearRampToValueAtTime(0, endTime);

      const fbFilter2 = ctx.createBiquadFilter();
      fbFilter2.type = 'lowpass';
      fbFilter2.frequency.setValueAtTime(brightness, time);
      fbFilter2.Q.setValueAtTime(0.5, time);

      burstSrc2.connect(pluckDelay2);
      pluckDelay2.connect(fbFilter2);
      fbFilter2.connect(fbGain2);
      fbGain2.connect(pluckDelay2);
      fbGain2.connect(bodyLow);

      burstSrc2.start(time);
      burstSrc2.stop(time + burstDur);
    }
  }

  private playFM(ctx: AudioContext, freq: number, inst: Instrument, time: number, endTime: number, dest: AudioNode): void {
    const fmRatio = inst.fmRatio !== undefined ? inst.fmRatio : 2;
    const fmDepth = inst.fmDepth !== undefined ? inst.fmDepth : 200;
    const fmWave: OscillatorType = inst.fmWave ?? 'sine';

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, time);

    const mod = ctx.createOscillator();
    mod.type = fmWave;
    mod.frequency.setValueAtTime(freq * fmRatio, time);

    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(fmDepth, time);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(dest);

    carrier.start(time);
    carrier.stop(endTime);
    mod.start(time);
    mod.stop(endTime);

    // Optional detuned 2nd FM voice
    if (inst.detuneOsc && inst.detuneAmount) {
      const carrier2 = ctx.createOscillator();
      carrier2.type = 'sine';
      carrier2.frequency.setValueAtTime(freq, time);
      carrier2.detune.setValueAtTime(inst.detuneAmount, time);

      const mod2 = ctx.createOscillator();
      mod2.type = fmWave;
      mod2.frequency.setValueAtTime(freq * fmRatio, time);
      mod2.detune.setValueAtTime(inst.detuneAmount, time);

      const modGain2 = ctx.createGain();
      modGain2.gain.setValueAtTime(fmDepth, time);

      mod2.connect(modGain2);
      modGain2.connect(carrier2.frequency);
      carrier2.connect(dest);

      carrier2.start(time);
      carrier2.stop(endTime);
      mod2.start(time);
      mod2.stop(endTime);
    }
  }

  private playOscillator(ctx: AudioContext, freq: number, wave: string, inst: Instrument, time: number, endTime: number, dest: AudioNode): void {
    const osc = ctx.createOscillator();
    if (wave === 'pulse25') {
      if (!this.pulseWaves['25']) this.pulseWaves['25'] = this.buildPulseWave(0.25);
      osc.setPeriodicWave(this.pulseWaves['25']);
    } else if (wave === 'pulse12') {
      if (!this.pulseWaves['12']) this.pulseWaves['12'] = this.buildPulseWave(0.125);
      osc.setPeriodicWave(this.pulseWaves['12']);
    } else {
      osc.type = wave as OscillatorType;
    }
    osc.frequency.setValueAtTime(freq, time);
    if (inst.detune) osc.detune.setValueAtTime(inst.detune, time);
    osc.connect(dest);
    osc.start(time);
    osc.stop(endTime);

    // Optional detuned second oscillator
    if (inst.detuneOsc && inst.detuneAmount) {
      const osc2 = ctx.createOscillator();
      if (wave === 'pulse25') {
        osc2.setPeriodicWave(this.pulseWaves['25']);
      } else if (wave === 'pulse12') {
        osc2.setPeriodicWave(this.pulseWaves['12']);
      } else {
        osc2.type = wave as OscillatorType;
      }
      osc2.frequency.setValueAtTime(freq, time);
      osc2.detune.setValueAtTime((inst.detune ?? 0) + inst.detuneAmount, time);
      osc2.connect(dest);
      osc2.start(time);
      osc2.stop(endTime);
    }
  }

  // ---- Scheduler ----

  private scheduleRow(time: number): void {
    const song = this.song!;
    const seqRow = song.seq![this.seqIndex];
    for (let ch = 0; ch < seqRow.length; ch++) {
      const patIdx = seqRow[ch];
      const pat = song.patterns[patIdx];
      if (!pat || !pat.ch || !pat.ch[ch]) continue;
      const cell = pat.ch[ch][this.rowIndex];
      if (!cell || cell[0] < 0) continue;
      const midi = cell[0];
      const inst = song.instruments[cell[1]] ?? song.instruments[0];
      const dur = cell[2] || 1;
      const vel = cell[3];
      this.playNote(midi, inst, time, dur, vel);
    }
  }

  private advanceWithLoop(): void {
    this.rowIndex++;
    const song = this.song!;
    const seqRow = song.seq![this.seqIndex];
    const patIdx = seqRow[0];
    const patLen = song.patterns[patIdx] ? song.patterns[patIdx].len : 16;
    if (this.rowIndex >= patLen) {
      this.rowIndex = 0;
      this.seqIndex++;
      // Check shortEndSeq BEFORE normal loop logic
      if (this.shortMode && song.shortEndSeq != null && this.seqIndex >= song.shortEndSeq) {
        this.stopInternal();
        if (this.onEndCallback) this.onEndCallback();
        return;
      }
      const loopEnd = song.loopEndSeq != null ? song.loopEndSeq : song.seq!.length;
      const loopStart = song.loopStartSeq ?? 0;
      if (this.seqIndex >= loopEnd) {
        this.seqIndex = loopStart;
      }
    }
  }

  private stopInternal(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }
  }

  private startScheduler(): void {
    this.timerID = setInterval(() => {
      while (this.nextNoteTime < this.ctx!.currentTime + ChipPlayer.SCHEDULE_AHEAD) {
        this.scheduleRow(this.nextNoteTime);
        this.advanceWithLoop();
        this.nextNoteTime += this.secondsPerRow();
      }
    }, ChipPlayer.TIMER_INTERVAL);
  }

  // ---- Public API ----

  init(): void {
    this.ctx = new AudioContext();
    this.ownsContext = true;
    this.masterGain = this.ctx.createGain();

    // Insert analyser between masterGain and destination for energy detection
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.noiseBuffer = this.createNoiseBuffer();
    this.pulseWaves = {};
  }

  /** Init with an external AudioContext and gain node (for embedding). */
  initExternal(externalCtx: AudioContext, externalGainNode: GainNode): void {
    this.ctx = externalCtx;
    this.ownsContext = false;
    this.masterGain = externalGainNode;
    this.noiseBuffer = this.createNoiseBuffer();
    this.pulseWaves = {};
  }

  load(songJSON: SongData): void {
    // Deep-copy to avoid mutating original
    const song: SongData = JSON.parse(JSON.stringify(songJSON));

    // Normalize tracker-native format to compact format
    if (song.sequence && !song.seq) {
      song.seq = song.sequence;
    }
    // Normalize rowsPerBeat -> rpb
    if (song.rowsPerBeat && !song.rpb) {
      song.rpb = song.rowsPerBeat;
    }
    // Normalize instruments with long-form ADSR keys
    for (const inst of song.instruments) {
      if ((inst as any).attack !== undefined && inst.a === undefined) inst.a = (inst as any).attack;
      if ((inst as any).decay !== undefined && inst.d === undefined) inst.d = (inst as any).decay;
      if ((inst as any).sustain !== undefined && inst.s === undefined) inst.s = (inst as any).sustain;
      if ((inst as any).release !== undefined && inst.r === undefined) inst.r = (inst as any).release;
      if ((inst as any).volume !== undefined && inst.vol === undefined) inst.vol = (inst as any).volume;
    }

    for (let p = 0; p < song.patterns.length; p++) {
      const pat = song.patterns[p];
      if (pat.channels && !pat.ch) {
        const len = pat.len || 16;
        pat.ch = [];
        for (let c = 0; c < pat.channels.length; c++) {
          const dense: (Cell | null)[] = new Array(len).fill(null);
          const events = pat.channels[c];
          for (let e = 0; e < events.length; e++) {
            const ev = events[e];
            const cell: Cell = [ev.n, ev.i, ev.d ?? 1];
            if (ev.v != null) cell.push(ev.v);
            dense[ev.r] = cell;
          }
          pat.ch.push(dense);
        }
      }
    }

    this.song = song;
    this.seqIndex = 0;
    this.rowIndex = 0;
  }

  play(): void {
    if (this.playing || !this.song) return;
    if (!this.ctx) this.init();
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
    this.playing = true;
    this.paused = false;
    this.seqIndex = 0;
    this.rowIndex = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.05;
    this.startScheduler();
  }

  stop(): void {
    this.paused = false;
    this.stopInternal();
  }

  pause(): void {
    if (!this.playing || this.paused) return;
    this.paused = true;
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }
    if (this.ctx?.suspend) this.ctx.suspend();
  }

  resume(): void {
    if (!this.playing || !this.paused) return;
    this.paused = false;
    if (this.ctx?.resume) {
      this.ctx.resume().then(() => {
        this.nextNoteTime = this.ctx!.currentTime + 0.05;
        this.startScheduler();
      });
    }
  }

  setVolume(v: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
  }

  getVolume(): number {
    return this.masterGain?.gain.value ?? 0;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  isPaused(): boolean {
    return this.paused;
  }

  setShortMode(enabled: boolean): void {
    this.shortMode = enabled;
  }

  onEnd(cb: (() => void) | null): void {
    this.onEndCallback = cb;
  }

  /**
   * Returns a 0-1 energy value based on average low-mid frequency data.
   * Useful for driving audio-reactive visual effects.
   */
  getEnergy(): number {
    if (!this.analyser || !this.analyserData) return 0;
    this.analyser.getByteFrequencyData(this.analyserData as Uint8Array<ArrayBuffer>);
    // Average the low-mid bins (first half of frequency data)
    const bins = this.analyserData.length >> 1;
    let sum = 0;
    for (let i = 0; i < bins; i++) {
      sum += this.analyserData[i];
    }
    return sum / (bins * 255);
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }
}
