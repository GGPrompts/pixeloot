/**
 * Music Track Designs for Pixeloot
 *
 * Each design specifies the compositional blueprint for a ChipPlayer JSON track.
 * These are NOT playable SongData -- they are structured design documents that
 * a composer (human or AI) uses to author the final JSON patterns.
 *
 * Existing tracks (not duplicated here):
 *   - menu.json    "Monastery of the Morning Mist"  -- 88 BPM, meditative
 *   - town.json    "Survivors: Campfire Rest"        -- 84 BPM, warm/safe
 *   - combat.json  "Speedrun Any%"                   -- 155 BPM, driving action
 *   - boss.json    "Megabyte Menace"                 -- 165 BPM, intense boss
 *   - victory.json "Compendium Fanfare"              -- 140 BPM, triumphant
 *
 * ChipPlayer capabilities reference:
 *   Waveforms: square, triangle, sawtooth, sine, pulse25, pulse12, noise, pluck, fm
 *   ADSR: a (attack), d (decay), s (sustain 0-1), r (release) -- all in seconds
 *   Filters: lowpass, highpass, bandpass, notch (filterType/filterFreq/filterQ)
 *   FM synth: fmRatio, fmDepth, fmWave
 *   Pluck: Karplus-Strong with filterFreq controlling brightness
 *   Detune: detuneOsc + detuneAmount (cents) for chorus/thickening
 *   Channels: 4 simultaneous (lead, harmony, bass, percussion typical split)
 *   Velocity: 0-15 per note event
 *   Pattern format: events with r=row, n=MIDI, i=instrument, d=duration, v=velocity
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InstrumentDesign {
  /** Channel role: lead, harmony, bass, percussion */
  role: 'lead' | 'harmony' | 'bass' | 'percussion';
  /** Descriptive name for the instrument */
  name: string;
  /** ChipPlayer waveform */
  wave: 'square' | 'triangle' | 'sawtooth' | 'sine' | 'pulse25' | 'pulse12' | 'noise' | 'pluck' | 'fm';
  /** Volume 0-1 */
  vol: number;
  /** ADSR envelope in seconds (sustain is 0-1 level) */
  adsr: { a: number; d: number; s: number; r: number };
  /** Optional filter */
  filter?: { type: 'lowpass' | 'highpass' | 'bandpass' | 'notch'; freq: number; q: number };
  /** Optional FM parameters (only when wave is 'fm') */
  fm?: { ratio: number; depth: number; wave?: 'sine' | 'square' | 'sawtooth' | 'triangle' };
  /** Optional detune chorus */
  detune?: { enabled: true; cents: number };
  /** Optional pluck brightness (only when wave is 'pluck') */
  pluckBrightness?: number;
  /** Design notes */
  notes: string;
}

export interface ChordStep {
  /** Chord name, e.g. "Am", "C", "F#dim" */
  chord: string;
  /** Duration in beats */
  beats: number;
}

export interface MelodyNote {
  /** Note name with octave, e.g. "E5", "C4" */
  note: string;
  /** Duration in beats (can be fractional) */
  beats: number;
  /** Dynamic marking */
  dynamic?: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
}

export interface DynamicElement {
  /** What changes */
  type: 'tempo_shift' | 'filter_sweep' | 'channel_drop' | 'channel_add' | 'intensity_build' | 'breakdown' | 'key_change' | 'time_signature_change';
  /** When it happens (pattern/section name or description) */
  trigger: string;
  /** What exactly happens */
  description: string;
}

export interface TrackDesign {
  /** Track identifier for the filename (e.g. "the_grid", "reactor_core") */
  id: string;
  /** Display title for the track */
  title: string;
  /** Where this track plays */
  context: string;
  /** Mood and feel description */
  mood: string;
  /** Beats per minute */
  bpm: number;
  /** Musical key */
  key: string;
  /** Scale type */
  scale: 'major' | 'natural_minor' | 'harmonic_minor' | 'dorian' | 'mixolydian' | 'phrygian' | 'pentatonic_minor' | 'pentatonic_major' | 'chromatic' | 'whole_tone' | 'blues';
  /** Rows per beat (ChipPlayer rpb, typically 4) */
  rpb: number;
  /** Pattern length in rows (typically 32 = 8 beats at rpb 4) */
  patternLen: number;
  /** Approximate total duration before loop */
  durationEstimate: string;
  /** Instrument definitions for all 4 channels */
  instruments: InstrumentDesign[];
  /** Chord progression (repeating unit) */
  chordProgression: ChordStep[];
  /** Melody outline for lead channel (first 8-16 bars) */
  melodyOutline: MelodyNote[];
  /** Bass line description */
  bassApproach: string;
  /** Percussion pattern description */
  percussionPattern: string;
  /** Dynamic changes throughout the track */
  dynamics: DynamicElement[];
  /** General composition notes */
  compositionNotes: string;
}

// ---------------------------------------------------------------------------
// Track Designs
// ---------------------------------------------------------------------------

export const MUSIC_DESIGNS: TrackDesign[] = [

  // =======================================================================
  // 1. THE GRID -- Tutorial / first zone
  // =======================================================================
  {
    id: 'the_grid',
    title: 'Initialization Sequence',
    context: 'The Grid zone -- tutorial area, first dungeon the player enters. Classic dark background with cyan grid lines.',
    mood: 'Curious, building confidence. Starts sparse and clean, layers in as the player learns. Retro digital aesthetic -- think Tron meets early NES. Not threatening, but hints that danger is ahead.',
    bpm: 128,
    key: 'C',
    scale: 'pentatonic_minor',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~2:30 before loop',
    instruments: [
      {
        role: 'lead',
        name: 'Grid Scanner',
        wave: 'pulse25',
        vol: 0.55,
        adsr: { a: 0.02, d: 0.12, s: 0.5, r: 0.15 },
        detune: { enabled: true, cents: 6 },
        notes: 'Thin, digital pulse lead. The detune gives it a slight shimmering quality like a CRT refresh. Pentatonic phrases keep it approachable and non-threatening.'
      },
      {
        role: 'harmony',
        name: 'Data Stream',
        wave: 'triangle',
        vol: 0.4,
        adsr: { a: 0.03, d: 0.15, s: 0.45, r: 0.2 },
        filter: { type: 'lowpass', freq: 2200, q: 1 },
        notes: 'Soft triangle arpeggios that ripple underneath the lead. Filtered to stay warm. Plays broken chord patterns that outline the harmony without competing with the melody.'
      },
      {
        role: 'bass',
        name: 'Foundation Layer',
        wave: 'triangle',
        vol: 0.7,
        adsr: { a: 0.01, d: 0.08, s: 0.8, r: 0.1 },
        notes: 'Clean triangle bass. Simple root-fifth patterns. Steady and predictable -- this is the tutorial, the bass should feel like solid ground.'
      },
      {
        role: 'percussion',
        name: 'Bit Tick',
        wave: 'noise',
        vol: 0.25,
        adsr: { a: 0.001, d: 0.04, s: 0, r: 0.02 },
        filter: { type: 'highpass', freq: 6000, q: 1.5 },
        notes: 'Very light hi-hat ticks. Minimal percussion -- the grid is calm. Just enough rhythmic anchor to keep the player moving. No kick drum initially; it enters in the B section.'
      }
    ],
    chordProgression: [
      { chord: 'Cm', beats: 8 },
      { chord: 'Eb', beats: 8 },
      { chord: 'Bb', beats: 8 },
      { chord: 'Gm', beats: 8 },
    ],
    melodyOutline: [
      // Phrase 1: ascending discovery
      { note: 'C4', beats: 2 },
      { note: 'Eb4', beats: 1 },
      { note: 'G4', beats: 2 },
      { note: 'Bb4', beats: 1 },
      { note: 'C5', beats: 2, dynamic: 'mf' },
      // Phrase 2: settling back
      { note: 'Bb4', beats: 1.5 },
      { note: 'G4', beats: 1.5 },
      { note: 'Eb4', beats: 2 },
      { note: 'C4', beats: 3, dynamic: 'p' },
      // Phrase 3: variation with rhythmic push
      { note: 'G4', beats: 1 },
      { note: 'Bb4', beats: 0.5 },
      { note: 'C5', beats: 0.5 },
      { note: 'Eb5', beats: 2, dynamic: 'f' },
      { note: 'C5', beats: 2 },
      { note: 'Bb4', beats: 1 },
      { note: 'G4', beats: 4, dynamic: 'mp' },
    ],
    bassApproach: 'Root notes on beat 1 and 3, fifth on beat 2 and 4. Straightforward eighth-note pulse in the B section. The bass is the metronome -- never syncopated, always reliable.',
    percussionPattern: 'A section: hi-hat on every other beat (half-time feel). B section: add a soft kick on 1 and 3, hi-hat moves to eighth notes. C section (loop point): full pattern with kick-snare-hat, but still restrained. The buildup mirrors the player learning the game.',
    dynamics: [
      {
        type: 'channel_add',
        trigger: 'Pattern 3 (after intro)',
        description: 'Bass channel enters. First two patterns are lead + harmony only, creating a sparse "booting up" feel.'
      },
      {
        type: 'channel_add',
        trigger: 'Pattern 5',
        description: 'Percussion enters with soft hi-hats. The grid comes alive.'
      },
      {
        type: 'intensity_build',
        trigger: 'Patterns 7-8 (pre-loop)',
        description: 'Melody moves up an octave, bass adds eighth notes, percussion gets a kick drum. Full energy for the loop point.'
      }
    ],
    compositionNotes: 'The grid is the player\'s first zone, so this track teaches them the audio language of the game. It should feel like a computer powering on -- channels layer in one by one. The pentatonic scale avoids any dissonance, keeping the mood safe but energetic. By the loop point, all 4 channels are active and the player has "booted up" into the full game. Keep the BPM moderate (128) -- faster than town but not combat-level intensity.'
  },

  // =======================================================================
  // 2. NEON WASTES -- Swarm/flanker heavy zone
  // =======================================================================
  {
    id: 'neon_wastes',
    title: 'Signal Decay',
    context: 'Neon Wastes zone -- purple/magenta void, heavy swarm and flanker spawns. Enemies come fast and from all sides.',
    mood: 'Tense, relentless, paranoid. The player is surrounded. Driving rhythm that never lets up. Synth-wave influence with a dark, decayed edge. Like a corrupted transmission from a dying neon city.',
    bpm: 140,
    key: 'D',
    scale: 'phrygian',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~2:00 before loop',
    instruments: [
      {
        role: 'lead',
        name: 'Neon Blade',
        wave: 'sawtooth',
        vol: 0.6,
        adsr: { a: 0.005, d: 0.1, s: 0.6, r: 0.12 },
        filter: { type: 'lowpass', freq: 3500, q: 2 },
        notes: 'Aggressive sawtooth lead with a resonant filter that gives it a biting, buzzy quality. The phrygian mode (flat 2nd) creates instant tension -- the Eb against D root is unsettling. Short phrases, staccato, like warning signals.'
      },
      {
        role: 'harmony',
        name: 'Void Pad',
        wave: 'pulse12',
        vol: 0.35,
        adsr: { a: 0.08, d: 0.2, s: 0.5, r: 0.3 },
        detune: { enabled: true, cents: 8 },
        notes: 'Narrow pulse wave with heavy detune for a thick, ominous pad. Slow attack so it swells in. Plays sustained chords that create a wall of uneasy sound beneath the lead. The 12.5% duty cycle gives it a hollow, distant quality.'
      },
      {
        role: 'bass',
        name: 'Decay Driver',
        wave: 'sawtooth',
        vol: 0.7,
        adsr: { a: 0.005, d: 0.06, s: 0.75, r: 0.08 },
        filter: { type: 'lowpass', freq: 1200, q: 1.5 },
        notes: 'Filtered sawtooth bass with a growling low end. Plays a relentless sixteenth-note ostinato pattern that never stops -- the rhythmic engine of the track. The low-pass filter keeps it from being harsh but the sawtooth harmonics give it teeth.'
      },
      {
        role: 'percussion',
        name: 'Static Crash',
        wave: 'noise',
        vol: 0.4,
        adsr: { a: 0.001, d: 0.08, s: 0, r: 0.04 },
        filter: { type: 'bandpass', freq: 3000, q: 2 },
        notes: 'Metallic, crunchy percussion. Bandpass-filtered noise sounds like broken machinery. Kick on every beat, snare on 2 and 4, with double-time hat patterns in the B section to ramp up tension.'
      }
    ],
    chordProgression: [
      { chord: 'Dm', beats: 4 },
      { chord: 'Ebmaj', beats: 4 },
      { chord: 'Cm', beats: 4 },
      { chord: 'Dm', beats: 4 },
    ],
    melodyOutline: [
      // Aggressive descending phrases
      { note: 'D5', beats: 0.5, dynamic: 'f' },
      { note: 'C5', beats: 0.5 },
      { note: 'Bb4', beats: 0.5 },
      { note: 'A4', beats: 0.5 },
      { note: 'G4', beats: 1, dynamic: 'ff' },
      // Rest, then stab
      { note: 'D5', beats: 0.5, dynamic: 'ff' },
      { note: 'Eb5', beats: 1.5 },
      // Descending again, lower
      { note: 'Bb4', beats: 0.5 },
      { note: 'A4', beats: 0.5 },
      { note: 'G4', beats: 0.5 },
      { note: 'F4', beats: 0.5 },
      { note: 'Eb4', beats: 1 },
      { note: 'D4', beats: 2, dynamic: 'mf' },
      // Chromatic climb back up
      { note: 'Eb4', beats: 0.5 },
      { note: 'F4', beats: 0.5 },
      { note: 'G4', beats: 0.5 },
      { note: 'A4', beats: 0.5 },
      { note: 'Bb4', beats: 1 },
      { note: 'D5', beats: 2, dynamic: 'f' },
    ],
    bassApproach: 'Relentless sixteenth-note pulse on the root, shifting with chord changes. Occasionally breaks into a descending chromatic run (D-Db-C-B) for 2 beats before snapping back. The bass IS the intensity of this zone -- if it stopped, the whole track would collapse.',
    percussionPattern: 'Four-on-the-floor kick with snare on 2 and 4. Hi-hat plays constant eighth notes. Every 4th bar, the hat doubles to sixteenths for one bar, creating a brief surge. A fill pattern every 8 bars uses rapid-fire noise bursts descending in pitch (high bandpass to low).',
    dynamics: [
      {
        type: 'filter_sweep',
        trigger: 'Every 8-bar phrase boundary',
        description: 'The harmony pad\'s filter opens from 800Hz to 3000Hz over 2 bars then snaps back. Creates a breathing, pulsing sensation.'
      },
      {
        type: 'breakdown',
        trigger: 'Pattern 5 (mid-track)',
        description: 'Bass and percussion drop out for 4 bars. Only lead and pad remain, creating sudden emptiness. Then everything slams back in at once -- the musical equivalent of enemies surrounding you.'
      },
      {
        type: 'intensity_build',
        trigger: 'Patterns 7-8 (pre-loop)',
        description: 'Lead moves up an octave, bass doubles speed, percussion adds extra hits on the and-of-beats. Maximum density before looping back.'
      }
    ],
    compositionNotes: 'Phrygian mode is the key to this track\'s identity. The flat 2nd (Eb over D) creates a distinctly menacing flavor without resorting to minor. The sawtooth-heavy instrumentation contrasts with the Grid\'s clean pulses -- this zone is corrupted, decayed. The relentless bass ostinato matches the swarm enemies that never stop coming. The breakdown at pattern 5 is crucial -- it gives the ear a moment of relief that makes the return hit harder. Keep the lead phrases short and stabbing, like radar pings in hostile territory.'
  },

  // =======================================================================
  // 3. REACTOR CORE -- Fire zone, burning ground hazards
  // =======================================================================
  {
    id: 'reactor_core',
    title: 'Meltdown Protocol',
    context: 'Reactor Core zone -- orange/red glow, fire-themed enemies, burning ground hazards. The most aggressive standard zone.',
    mood: 'Urgent, scorching, industrial. Like an alarm blaring in a facility that is minutes from catastrophic failure. Percussion-heavy with metallic textures. The heat is literal -- every second in this zone costs HP if you stand still.',
    bpm: 152,
    key: 'E',
    scale: 'harmonic_minor',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~1:45 before loop',
    instruments: [
      {
        role: 'lead',
        name: 'Alarm Siren',
        wave: 'square',
        vol: 0.65,
        adsr: { a: 0.005, d: 0.06, s: 0.7, r: 0.08 },
        notes: 'Pure square wave lead, cutting and urgent. The harmonic minor scale\'s augmented second (F to G#) gives a Middle Eastern urgency that sounds like danger. Plays fast sixteenth-note runs interspersed with held notes that ring like alarms.'
      },
      {
        role: 'harmony',
        name: 'Molten Drone',
        wave: 'fm',
        vol: 0.4,
        adsr: { a: 0.04, d: 0.15, s: 0.5, r: 0.2 },
        fm: { ratio: 3, depth: 150, wave: 'sine' },
        notes: 'FM synthesis creates a harsh, metallic drone. The 3:1 ratio produces a bell-like quality that warps into something industrial at high modulation depth. Sustains long chords that shimmer and distort, like heat haze over molten metal.'
      },
      {
        role: 'bass',
        name: 'Piston',
        wave: 'triangle',
        vol: 0.8,
        adsr: { a: 0.002, d: 0.05, s: 0.85, r: 0.06 },
        notes: 'Heavy triangle bass playing a mechanical, repetitive pattern. Eighth-note pump on the root that sounds like pistons firing. Drops to sub-bass notes (E1/F1) on accented beats for chest-thumping impact.'
      },
      {
        role: 'percussion',
        name: 'Foundry Kit',
        wave: 'noise',
        vol: 0.45,
        adsr: { a: 0.001, d: 0.1, s: 0, r: 0.05 },
        filter: { type: 'lowpass', freq: 600, q: 3 },
        notes: 'Heavy, boomy percussion. The low-pass filter with high Q gives it a resonant industrial thump like hammering on sheet metal. Use two noise instruments: this one for kicks, plus a second with highpass at 4000Hz for metallic clangs on off-beats.'
      }
    ],
    chordProgression: [
      { chord: 'Em', beats: 4 },
      { chord: 'F', beats: 4 },
      { chord: 'G#dim', beats: 4 },
      { chord: 'Em', beats: 4 },
    ],
    melodyOutline: [
      // Alarm phrase -- tritone interval for maximum urgency
      { note: 'E5', beats: 0.25, dynamic: 'ff' },
      { note: 'F5', beats: 0.25 },
      { note: 'E5', beats: 0.25 },
      { note: 'F5', beats: 0.25 },
      { note: 'G#5', beats: 1, dynamic: 'ff' },
      { note: 'E5', beats: 1 },
      // Descending run
      { note: 'D5', beats: 0.5 },
      { note: 'C5', beats: 0.5 },
      { note: 'B4', beats: 0.5 },
      { note: 'A4', beats: 0.5 },
      { note: 'G#4', beats: 1, dynamic: 'f' },
      // Rising chromatic tension
      { note: 'A4', beats: 0.5 },
      { note: 'B4', beats: 0.5 },
      { note: 'C5', beats: 0.5 },
      { note: 'D5', beats: 0.5 },
      { note: 'E5', beats: 2, dynamic: 'ff' },
    ],
    bassApproach: 'Pumping eighth notes on the root, every beat. On chord changes, a quick chromatic slide into the new root (2 sixteenth notes). The mechanical regularity is the point -- this is a machine running at capacity. Add occasional octave jumps (E2 to E1) on bar downbeats for weight.',
    percussionPattern: 'Double-time feel: kick on every eighth note in the A section (relentless pounding). Metallic clang on 2 and 4. Every 4 bars, the kick drops out for one beat then comes back harder -- a brief stumble in the machine. Fill patterns use rapid ascending noise bursts.',
    dynamics: [
      {
        type: 'tempo_shift',
        trigger: 'Breakdown section (pattern 4)',
        description: 'Not an actual BPM change, but the lead switches to half-time phrases while bass and percussion continue at full speed. Creates a feeling of time stretching in the heat.'
      },
      {
        type: 'filter_sweep',
        trigger: 'Every 4-bar loop of the bass',
        description: 'The FM harmony instrument\'s modulation depth ramps from 100 to 300 over 4 bars, making the texture progressively more distorted and chaotic, then resets. Simulates rising temperature.'
      },
      {
        type: 'intensity_build',
        trigger: 'Final 4 patterns before loop',
        description: 'All instruments at maximum velocity. Lead plays continuous sixteenth notes. Bass adds chromatic passing tones. Percussion fills every gap. The meltdown is happening NOW.'
      }
    ],
    compositionNotes: 'Harmonic minor is perfect for fire/danger. The augmented second (F to G#) is the signature interval -- use it constantly in the lead. The E-F motion (half step) creates relentless tension. The FM harmony instrument is what distinguishes this zone sonically from everything else -- that metallic, bell-like distortion says "furnace" in a way no other waveform can. Keep the percussion HEAVY -- this is the most percussive zone track. The player should feel like they are inside a machine. Short track length (~1:45) means it loops faster, reinforcing the urgency.'
  },

  // =======================================================================
  // 4. FROZEN ARRAY -- Ice zone, slow effects
  // =======================================================================
  {
    id: 'frozen_array',
    title: 'Absolute Zero',
    context: 'Frozen Array zone -- blue/white palette, slow zones on the ground, cold enemies. Enemies chill and freeze the player.',
    mood: 'Ethereal, vast, lonely. Crystalline textures over a slow, deep bass. The cold slows everything down -- tempo, note density, even the attack times. Beautiful but dangerous, like thin ice over deep water.',
    bpm: 96,
    key: 'F#',
    scale: 'dorian',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~3:00 before loop',
    instruments: [
      {
        role: 'lead',
        name: 'Ice Crystal',
        wave: 'pluck',
        vol: 0.55,
        adsr: { a: 0.01, d: 0.3, s: 0.2, r: 0.4 },
        pluckBrightness: 6000,
        notes: 'Karplus-Strong pluck with high brightness for a glassy, crystalline attack that rings out and decays. Long release time lets notes overlap and shimmer. The pluck\'s natural decay mimics ice forming -- sharp attack, long resonance. Dorian mode\'s raised 6th (D#) adds unexpected warmth to the cold.'
      },
      {
        role: 'harmony',
        name: 'Frost Haze',
        wave: 'sine',
        vol: 0.3,
        adsr: { a: 0.15, d: 0.3, s: 0.6, r: 0.5 },
        detune: { enabled: true, cents: 10 },
        notes: 'Very slow-attack sine pads with heavy detune for a shimmering, out-of-focus quality. The slow envelope means notes fade in and out like breath in cold air. Play simple intervals (fifths, octaves) to create a vast, open harmonic space.'
      },
      {
        role: 'bass',
        name: 'Deep Freeze',
        wave: 'triangle',
        vol: 0.65,
        adsr: { a: 0.03, d: 0.12, s: 0.7, r: 0.2 },
        notes: 'Slow-moving triangle bass. Whole notes and half notes only -- the bass barely moves, like a frozen lake. Occasional octave drop for depth. The slightly longer attack (0.03s) softens the transient, making it feel submerged.'
      },
      {
        role: 'percussion',
        name: 'Frost Chime',
        wave: 'noise',
        vol: 0.2,
        adsr: { a: 0.002, d: 0.06, s: 0, r: 0.08 },
        filter: { type: 'highpass', freq: 8000, q: 2 },
        notes: 'Extremely high-passed noise for a delicate, icy shimmer. Not a traditional drum sound -- more like ice crystals tinkling. Sparse placement, never on a regular grid. Some hits are barely audible. Use a second noise instrument with bandpass at 400Hz for rare, distant booms (ice cracking).'
      }
    ],
    chordProgression: [
      { chord: 'F#m', beats: 8 },
      { chord: 'A', beats: 8 },
      { chord: 'E', beats: 8 },
      { chord: 'D#dim', beats: 4 },
      { chord: 'F#m', beats: 4 },
    ],
    melodyOutline: [
      // Sparse, floating notes with lots of space
      { note: 'F#4', beats: 4, dynamic: 'mp' },
      // silence for 2 beats
      { note: 'A4', beats: 3, dynamic: 'p' },
      { note: 'C#5', beats: 2, dynamic: 'mp' },
      // silence for 3 beats
      { note: 'E5', beats: 4, dynamic: 'mf' },
      { note: 'D#5', beats: 2, dynamic: 'mp' },
      // silence for 2 beats
      { note: 'C#5', beats: 3, dynamic: 'p' },
      { note: 'A4', beats: 4 },
      // silence for 4 beats
      { note: 'F#4', beats: 6, dynamic: 'pp' },
    ],
    bassApproach: 'Glacially slow. One note per 8-beat chord. Occasional gentle portamento effect (two notes a half step apart played in sequence with overlap). The bass should feel like tectonic movement beneath ice -- massive but barely perceptible.',
    percussionPattern: 'No regular beat. Instead, place crystalline noise hits at irregular intervals (rows 0, 7, 11, 18, 25 etc). A deep boom sound (lowpass 200Hz noise) every 16 or 32 rows. This is ambient percussion, not rhythmic percussion. The player supplies the rhythm through their own movement and attacks.',
    dynamics: [
      {
        type: 'channel_drop',
        trigger: 'Patterns 3-4 (first bridge)',
        description: 'Bass drops out entirely. Only the pluck lead and sine pad remain, floating in empty space. Creates a sensation of being suspended over an abyss of cold.'
      },
      {
        type: 'filter_sweep',
        trigger: 'Across the entire track, very slowly',
        description: 'The sine pad\'s detune amount gradually increases from 10 cents to 25 cents over the full track length, then resets at the loop. The harmony becomes progressively more unstable, like ice beginning to fracture.'
      },
      {
        type: 'intensity_build',
        trigger: 'Patterns 7-8 (climax before loop)',
        description: 'Lead pluck plays faster notes (eighth notes instead of whole notes). A second pluck with lower brightness (2000Hz) doubles it an octave below. Bass returns with a pedal tone. The ice is cracking -- then silence, and the loop restarts from stillness.'
      }
    ],
    compositionNotes: 'This track lives and dies by what it DOESN\'T play. The silence between notes is as important as the notes themselves. At 96 BPM with sparse note placement, this is the slowest zone track, and it should feel like time is freezing. The Karplus-Strong pluck is perfect for ice -- it has a natural crystalline quality that no oscillator can match. Dorian mode was chosen over natural minor because the raised 6th (D#) adds a hint of melancholy beauty rather than pure darkness. This zone should feel hauntingly pretty, not just cold. Contrast with the Reactor Core: where that track fills every gap, this one leaves most of the space empty.'
  },

  // =======================================================================
  // 5. OVERGROWTH -- Organic zone, splitters and tanks
  // =======================================================================
  {
    id: 'overgrowth',
    title: 'Spore Bloom',
    context: 'Overgrowth zone -- green/teal palette, organic shapes, splitter and tank enemies. Enemies are resilient and multiply.',
    mood: 'Primal, groovy, unsettling growth. A thick, swampy rhythm that feels alive and spreading. Not fast, but relentless in a biological way -- like fungal growth timelapsed. Jazz-influenced chromatic movement.',
    bpm: 118,
    key: 'Bb',
    scale: 'dorian',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~2:30 before loop',
    instruments: [
      {
        role: 'lead',
        name: 'Spore Call',
        wave: 'pulse25',
        vol: 0.55,
        adsr: { a: 0.03, d: 0.18, s: 0.45, r: 0.2 },
        filter: { type: 'lowpass', freq: 2800, q: 1.5 },
        notes: 'Slightly muffled pulse lead that sounds organic rather than digital. The longer attack (0.03s) softens the edge, making it sound like something growing rather than being switched on. Plays swung rhythms -- triplet feel within the 4/4 grid.'
      },
      {
        role: 'harmony',
        name: 'Mycelium Web',
        wave: 'triangle',
        vol: 0.4,
        adsr: { a: 0.05, d: 0.2, s: 0.5, r: 0.25 },
        detune: { enabled: true, cents: 12 },
        notes: 'Heavily detuned triangle for a thick, wobbly texture that sounds like something pulsing underground. Plays slow-moving intervals that creep chromatically. The 12-cent detune is aggressive -- it should sound slightly wrong, like nature mutated.'
      },
      {
        role: 'bass',
        name: 'Root System',
        wave: 'sawtooth',
        vol: 0.65,
        adsr: { a: 0.01, d: 0.08, s: 0.75, r: 0.1 },
        filter: { type: 'lowpass', freq: 900, q: 2 },
        notes: 'Deep, filtered sawtooth bass. The heavy filtering removes the buzz but keeps the warmth. Plays a syncopated groove with ghost notes -- not a straight pulse. The bassline is the "heartbeat" of the overgrowth, and it swings.'
      },
      {
        role: 'percussion',
        name: 'Organic Kit',
        wave: 'noise',
        vol: 0.35,
        adsr: { a: 0.003, d: 0.1, s: 0, r: 0.06 },
        filter: { type: 'bandpass', freq: 1500, q: 1.5 },
        notes: 'Mid-range percussion with a woody, organic quality. Bandpass at 1500Hz sounds less metallic, more like something hollow being struck. Swung timing to match the bass groove. Add a second noise instrument (lowpass 300Hz, long decay 0.2s) for deep, thumping heartbeat hits.'
      }
    ],
    chordProgression: [
      { chord: 'Bbm', beats: 4 },
      { chord: 'Cm', beats: 4 },
      { chord: 'Dbmaj', beats: 4 },
      { chord: 'Cm', beats: 2 },
      { chord: 'Bbm', beats: 2 },
    ],
    melodyOutline: [
      // Swung, bluesy phrases
      { note: 'Bb4', beats: 1.5, dynamic: 'mf' },
      { note: 'Db5', beats: 0.5 },
      { note: 'C5', beats: 1 },
      { note: 'Ab4', beats: 1, dynamic: 'mp' },
      // Chromatic creep
      { note: 'G4', beats: 1 },
      { note: 'Ab4', beats: 0.5 },
      { note: 'A4', beats: 0.5 },
      { note: 'Bb4', beats: 2, dynamic: 'mf' },
      // Higher reach
      { note: 'Db5', beats: 1 },
      { note: 'Eb5', beats: 1.5 },
      { note: 'F5', beats: 0.5 },
      { note: 'Eb5', beats: 1 },
      { note: 'Db5', beats: 1 },
      { note: 'C5', beats: 1 },
      { note: 'Bb4', beats: 3, dynamic: 'mp' },
    ],
    bassApproach: 'Syncopated groove with emphasis on the "and" of beats 2 and 4. Ghost notes (low velocity, v=4-6) on sixteenth-note subdivisions create a bubbling, organic feel. Occasional chromatic approach notes from a half step below the target. The bass should sound like it\'s alive and crawling.',
    percussionPattern: 'Swung pattern: kick on 1 and the "and" of 2. Woody snare on 3. Ghost hat notes everywhere in between at low velocity. Every 4th bar, add an extra kick hit at the end of the bar that overlaps into the next -- the rhythmic equivalent of something sprouting and spreading.',
    dynamics: [
      {
        type: 'channel_add',
        trigger: 'Pattern 3',
        description: 'Harmony enters with a single sustained note, then slowly begins moving. Like mycelium spreading -- it starts as one point and branches out.'
      },
      {
        type: 'breakdown',
        trigger: 'Pattern 6',
        description: 'Everything drops to bass and percussion only. The groove continues but the melody and harmony vanish, leaving just the pulsing root system. Creates tension before the B section.'
      },
      {
        type: 'key_change',
        trigger: 'Pattern 7 (B section)',
        description: 'Shift up a minor third to Db Dorian for 2 patterns. The harmonic shift feels like entering a deeper part of the overgrowth. Return to Bb for the loop.'
      }
    ],
    compositionNotes: 'The swing feel is what makes this track unique in the soundtrack. Where every other zone is straight 4/4, the Overgrowth grooves. The chromatic movement (especially the G to Ab to A to Bb creep in the melody) sounds like something growing by increments. Dorian mode adds the same bittersweet quality as the Frozen Array but at a completely different tempo and texture. The filtered sawtooth bass is the secret weapon -- it provides warmth and body that triangle can\'t match, while staying smooth enough to not clash with the lead. This should be the track that players find themselves nodding their heads to without realizing it.'
  },

  // =======================================================================
  // 6. STORM NETWORK -- Lightning zone, chain damage
  // =======================================================================
  {
    id: 'storm_network',
    title: 'Voltage Surge',
    context: 'Storm Network zone -- yellow/white palette, lightning enemies, chain damage. Damage jumps between enemies and the player if too close together.',
    mood: 'Electric, erratic, exhilarating. Lightning is fast and unpredictable -- the music should match. Irregular accents, staccato bursts, moments of silence followed by explosive hits. More exciting than scary.',
    bpm: 160,
    key: 'A',
    scale: 'mixolydian',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~1:50 before loop',
    instruments: [
      {
        role: 'lead',
        name: 'Arc Flash',
        wave: 'square',
        vol: 0.6,
        adsr: { a: 0.001, d: 0.04, s: 0.55, r: 0.06 },
        notes: 'Extremely fast attack square wave for sharp, crackling notes. Very short envelope creates staccato bursts that sound like electrical discharge. Plays rapid arpeggios and scalar runs with irregular rhythmic placement -- not on the grid but syncopated to feel unstable.'
      },
      {
        role: 'harmony',
        name: 'Static Field',
        wave: 'pulse12',
        vol: 0.4,
        adsr: { a: 0.02, d: 0.1, s: 0.5, r: 0.15 },
        filter: { type: 'highpass', freq: 1500, q: 1 },
        notes: 'Thin, buzzy pulse wave filtered to remove low end. Creates a persistent electrical hum beneath the lead. Plays power chords (root + fifth) in rhythmic stabs that accent off-beats. The high-pass filter keeps it bright and crackling.'
      },
      {
        role: 'bass',
        name: 'Thunder Roll',
        wave: 'triangle',
        vol: 0.75,
        adsr: { a: 0.005, d: 0.06, s: 0.8, r: 0.08 },
        notes: 'Punchy triangle bass that provides the grounding for all the erratic upper voices. Plays a driving eighth-note pattern but with irregular accent placement (velocity 15 on unexpected beats). The bass is the "ground wire" -- without it, the track would feel totally chaotic.'
      },
      {
        role: 'percussion',
        name: 'Spark Kit',
        wave: 'noise',
        vol: 0.4,
        adsr: { a: 0.001, d: 0.03, s: 0, r: 0.02 },
        filter: { type: 'highpass', freq: 7000, q: 2 },
        notes: 'Very bright, snappy noise percussion. The high frequency makes it sound like static crackle. Plays extremely fast rolls (32nd-note fills) that simulate the sound of electrical arcing. Use a second noise instrument (lowpass 400Hz) for thunder-boom kicks on downbeats.'
      }
    ],
    chordProgression: [
      { chord: 'A', beats: 4 },
      { chord: 'G', beats: 4 },
      { chord: 'D', beats: 4 },
      { chord: 'A', beats: 4 },
    ],
    melodyOutline: [
      // Lightning strike: fast burst then ring
      { note: 'A5', beats: 0.25, dynamic: 'ff' },
      { note: 'E5', beats: 0.25, dynamic: 'ff' },
      { note: 'C#5', beats: 0.25, dynamic: 'f' },
      { note: 'A4', beats: 0.25, dynamic: 'mf' },
      { note: 'E5', beats: 2, dynamic: 'mf' },
      // Second strike, offset timing
      { note: 'G5', beats: 0.25, dynamic: 'ff' },
      { note: 'D5', beats: 0.25 },
      { note: 'B4', beats: 0.25 },
      { note: 'G4', beats: 2 },
      // Ascending chain
      { note: 'A4', beats: 0.5 },
      { note: 'B4', beats: 0.5 },
      { note: 'C#5', beats: 0.5 },
      { note: 'D5', beats: 0.5 },
      { note: 'E5', beats: 0.5 },
      { note: 'F#5', beats: 0.5 },
      { note: 'G5', beats: 0.5 },
      { note: 'A5', beats: 2, dynamic: 'ff' },
    ],
    bassApproach: 'Driving eighth notes with accent on beat 1 and the "and" of 3 (velocity 15 vs 9). The Mixolydian b7 (G natural instead of G#) gives the bassline a rock/blues edge. Occasional chromatic passing tones between chord roots add electrical instability.',
    percussionPattern: 'Fast hi-hat sixteenths with accented snare on 2 and 4. Kick pattern is irregular: beat 1, "and" of 2, beat 4 -- asymmetric to feel unpredictable. Every 2 bars, a 32nd-note snare roll for half a beat (lightning crackle). Every 8 bars, a dramatic kick roll building to a cymbal crash.',
    dynamics: [
      {
        type: 'channel_drop',
        trigger: 'Randomly placed 1-beat gaps (rows 13, 29 of certain patterns)',
        description: 'ALL channels cut for exactly 1 beat, then slam back. Simulates a power outage / lightning flash. Use sparingly (2-3 times across the full track) for maximum impact.'
      },
      {
        type: 'intensity_build',
        trigger: 'Patterns 5-6',
        description: 'Lead plays continuous arpeggios at sixteenth-note speed. Harmony stabs become more frequent. Bass velocity increases. The storm is building to its peak.'
      },
      {
        type: 'breakdown',
        trigger: 'Pattern 7 (eye of the storm)',
        description: 'Sudden quiet: only the bass plays at low velocity with sparse percussion. The lead is completely silent. One bar of this, then the full storm returns with maximum intensity for the loop.'
      }
    ],
    compositionNotes: 'Mixolydian mode gives this track a brighter, more exciting feel than the minor-key zones. Lightning is spectacular, not just threatening -- the music should be thrilling to listen to. The b7 (G natural in A Mixolydian) gives a rock/blues power-chord feeling that pairs naturally with the power chord harmony stabs. The key dynamic trick is the full-channel dropouts -- when everything cuts for one beat and slams back, it mimics the flash-and-crack of lightning better than any note could. At 160 BPM this is the second-fastest zone track (after Reactor Core), appropriate for the chain-damage mechanic that punishes slow play.'
  },

  // =======================================================================
  // 7. THE ABYSS -- Darkness zone, visibility challenge
  // =======================================================================
  {
    id: 'the_abyss',
    title: 'Event Horizon',
    context: 'The Abyss zone -- near-black background, enemies barely glow until close. A visibility challenge zone where darkness itself is the enemy.',
    mood: 'Dread, oppressive void, claustrophobic. Minimal. Every sound feels like it is being swallowed by darkness. Long silences punctuated by distant, half-heard motifs. The absence of music IS the music.',
    bpm: 80,
    key: 'C#',
    scale: 'phrygian',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~3:30 before loop',
    instruments: [
      {
        role: 'lead',
        name: 'Void Whisper',
        wave: 'sine',
        vol: 0.35,
        adsr: { a: 0.1, d: 0.3, s: 0.3, r: 0.6 },
        filter: { type: 'lowpass', freq: 1800, q: 1 },
        notes: 'A barely-there sine lead, heavily filtered and with a very slow attack. Notes fade in from nothing and dissolve back. The low volume and slow envelope mean the player is never quite sure if they heard something or imagined it. Plays only 3-4 notes per pattern, maximum.'
      },
      {
        role: 'harmony',
        name: 'Dark Matter',
        wave: 'fm',
        vol: 0.25,
        adsr: { a: 0.2, d: 0.4, s: 0.4, r: 0.8 },
        fm: { ratio: 1.5, depth: 80, wave: 'sine' },
        notes: 'Inharmonic FM pad with a non-integer ratio (1.5) that creates a slightly wrong, alien timbre. Extremely slow attack means it materializes over nearly a full second. Plays single sustained notes or intervals a tritone apart (the most dissonant interval). This is the sound of the void itself.'
      },
      {
        role: 'bass',
        name: 'Gravity Well',
        wave: 'triangle',
        vol: 0.5,
        adsr: { a: 0.05, d: 0.15, s: 0.6, r: 0.3 },
        notes: 'Sub-bass triangle that plays incredibly sparse notes -- one every 16 or 32 rows. When it hits, it should feel like the floor dropping out. The slow attack keeps it from being startling; instead it creeps in and pulls everything down.'
      },
      {
        role: 'percussion',
        name: 'Void Pulse',
        wave: 'noise',
        vol: 0.15,
        adsr: { a: 0.01, d: 0.2, s: 0, r: 0.15 },
        filter: { type: 'bandpass', freq: 800, q: 3 },
        notes: 'Distant, muffled thuds. The narrow bandpass and long decay create a sound like something massive shifting in the dark, far away. Place these at irregular, widely-spaced intervals. The player should feel their heartbeat in the gaps between hits.'
      }
    ],
    chordProgression: [
      { chord: 'C#m', beats: 16 },
      { chord: 'Dm', beats: 8 },
      { chord: 'C#m', beats: 8 },
    ],
    melodyOutline: [
      // Almost nothing. Each note is an event.
      { note: 'C#4', beats: 8, dynamic: 'pp' },
      // 8 beats of silence
      { note: 'D4', beats: 6, dynamic: 'pp' },
      // 10 beats of silence
      { note: 'E4', beats: 4, dynamic: 'p' },
      { note: 'C#4', beats: 12, dynamic: 'pp' },
      // 16 beats of silence
      { note: 'G#3', beats: 8, dynamic: 'ppp' },
    ],
    bassApproach: 'One bass note per chord change at most. Sometimes skip a chord entirely. When the bass does play, it should be a physical sensation -- a rumble from the deep. Consider leaving the bass channel completely empty for entire patterns to maximize the dread when it returns.',
    percussionPattern: 'No rhythm. Individual thuds at intervals of 12-20 rows apart. Never predictable. Occasionally, a very long decay hit (0.4s) that sounds like distant thunder or something enormous moving. The absence of a regular beat is the scariest thing about this track.',
    dynamics: [
      {
        type: 'channel_drop',
        trigger: 'Patterns 2-3',
        description: 'Only the FM pad plays. Everything else is silent. The player is alone with the sound of the void.'
      },
      {
        type: 'intensity_build',
        trigger: 'Pattern 6',
        description: 'The lead plays its most notes here: 6-8 notes in one pattern, the densest passage. Still sparse by any other track\'s standard, but in context this feels like a crescendo. The bass enters for the first time in several patterns.'
      },
      {
        type: 'channel_drop',
        trigger: 'Pattern 8 (pre-loop)',
        description: 'Total silence for 8-16 rows. Nothing plays. Then a single, very low bass note fades in and the loop restarts. The silence is the climax.'
      }
    ],
    compositionNotes: 'This is the hardest track to write because most of it is silence. The temptation is to add more, but RESIST. The Abyss is defined by absence. At 80 BPM with 3-4 notes per pattern, there might only be 30-40 note events in the entire track. Every single one matters. The Phrygian mode\'s half-step motion (C# to D) is perfect for dread -- it\'s the interval of the Jaws theme, of danger approaching. The FM pad\'s inharmonic ratio creates an alien, non-musical tone that suggests something incomprehensible in the dark. This track should make the player turn up their speakers and lean forward, straining to hear if that was a note or just their imagination.'
  },

  // =======================================================================
  // 8. CHROMATIC RIFT -- Multi-color chaos, hardest zone
  // =======================================================================
  {
    id: 'chromatic_rift',
    title: 'Prismatic Overdrive',
    context: 'Chromatic Rift zone -- multi-color palette, all enemy types at once. The hardest zone in the game, pulling elements from every other zone.',
    mood: 'Chaotic, virtuosic, overwhelming. A mashup that quotes melodic fragments from other zone tracks, stitched together in a frantic collage. The musical equivalent of fighting every enemy type simultaneously. Controlled chaos.',
    bpm: 168,
    key: 'Am',
    scale: 'chromatic',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~2:00 before loop',
    instruments: [
      {
        role: 'lead',
        name: 'Prismatic Lead',
        wave: 'square',
        vol: 0.65,
        adsr: { a: 0.005, d: 0.08, s: 0.65, r: 0.1 },
        notes: 'Classic square lead at maximum aggression. Fast attack, moderate sustain. Plays the most technically demanding melodic line in the soundtrack: rapid scale runs, wide interval jumps, chromatic passages. The "chromatic" in Chromatic Rift is literal -- this lead uses all 12 notes freely.'
      },
      {
        role: 'harmony',
        name: 'Rift Stab',
        wave: 'sawtooth',
        vol: 0.5,
        adsr: { a: 0.005, d: 0.06, s: 0.5, r: 0.08 },
        filter: { type: 'lowpass', freq: 3000, q: 1.5 },
        notes: 'Aggressive sawtooth stabs for chord hits. Plays in rhythmic unison with the kick drum on strong beats, creating a wall-of-sound effect. Between stabs, slides chromatically for unsettling pitch shifts. This instrument provides the harmonic chaos.'
      },
      {
        role: 'bass',
        name: 'Rift Engine',
        wave: 'sawtooth',
        vol: 0.75,
        adsr: { a: 0.003, d: 0.05, s: 0.8, r: 0.06 },
        filter: { type: 'lowpass', freq: 1000, q: 2 },
        notes: 'Heavy, driving filtered sawtooth bass. Sixteenth-note patterns that shift between different zone signature basslines: straight pump (Grid), chromatic crawl (Overgrowth), mechanical eighths (Reactor). The bass cycles through styles every 4 bars, never settling.'
      },
      {
        role: 'percussion',
        name: 'Chaos Kit',
        wave: 'noise',
        vol: 0.45,
        adsr: { a: 0.001, d: 0.06, s: 0, r: 0.03 },
        filter: { type: 'bandpass', freq: 2500, q: 2 },
        notes: 'Dense, complex percussion. Layer a kick (lowpass 400Hz), snare (bandpass 2500Hz), and hat (highpass 7000Hz) using instrument switching within the same channel. Fills are constant -- this track never settles into a simple groove.'
      }
    ],
    chordProgression: [
      // Rapidly shifting, unstable
      { chord: 'Am', beats: 2 },
      { chord: 'Bb', beats: 2 },
      { chord: 'Cm', beats: 2 },
      { chord: 'Dm', beats: 2 },
      { chord: 'Eb', beats: 2 },
      { chord: 'Dm', beats: 2 },
      { chord: 'Cm', beats: 2 },
      { chord: 'Am', beats: 2 },
    ],
    melodyOutline: [
      // Opening: quotes from other zones, rapid-fire
      // Grid quote (C pentatonic minor fragment)
      { note: 'C5', beats: 0.5, dynamic: 'f' },
      { note: 'Eb5', beats: 0.5 },
      { note: 'G5', beats: 0.5 },
      // Neon Wastes quote (Phrygian descent)
      { note: 'F5', beats: 0.5, dynamic: 'ff' },
      { note: 'E5', beats: 0.25 },
      { note: 'Eb5', beats: 0.25 },
      // Reactor Core quote (alarm interval)
      { note: 'E5', beats: 0.25 },
      { note: 'F5', beats: 0.25 },
      { note: 'E5', beats: 0.25 },
      { note: 'F5', beats: 0.25 },
      // Storm quote (rapid arpeggio)
      { note: 'A5', beats: 0.25, dynamic: 'ff' },
      { note: 'E5', beats: 0.25 },
      { note: 'C5', beats: 0.25 },
      { note: 'A4', beats: 0.25 },
      // Chromatic ascent (pure rift)
      { note: 'A4', beats: 0.25, dynamic: 'f' },
      { note: 'Bb4', beats: 0.25 },
      { note: 'B4', beats: 0.25 },
      { note: 'C5', beats: 0.25 },
      { note: 'C#5', beats: 0.25 },
      { note: 'D5', beats: 0.25 },
      { note: 'Eb5', beats: 0.25 },
      { note: 'E5', beats: 0.25 },
      { note: 'F5', beats: 0.25 },
      { note: 'F#5', beats: 0.25 },
      { note: 'G5', beats: 0.25 },
      { note: 'A5', beats: 1, dynamic: 'ff' },
    ],
    bassApproach: 'Cycling zone-signature patterns every 4 bars: straight eighth pump (Grid), sixteenth-note ostinato (Neon Wastes), mechanical pump with slides (Reactor Core), syncopated groove (Overgrowth), driving eighths with accents (Storm Network). The bass is the musical timeline of the player\'s journey.',
    percussionPattern: 'The most complex drum pattern in the soundtrack. Kick on every beat plus the "and" of 2 and 4. Snare on 2 and 4 with ghost notes on surrounding sixteenths. Hat plays constant sixteenths with accented opens on off-beats. Every 2 bars, a fill that uses all available row subdivisions. No two bars have the exact same pattern.',
    dynamics: [
      {
        type: 'key_change',
        trigger: 'Every 4 patterns',
        description: 'The tonal center shifts: Am -> Cm -> Em -> Am. Each shift quotes a different zone\'s harmonic language. The constant modulation prevents the ear from ever settling.'
      },
      {
        type: 'breakdown',
        trigger: 'Pattern 5',
        description: 'Abrupt: everything cuts to just the bass playing a chromatic ascending line alone. Then the other channels slam back in one at a time over 4 bars: percussion, harmony, lead. A compressed version of the Grid\'s layer-in dynamic.'
      },
      {
        type: 'intensity_build',
        trigger: 'Patterns 7-8 (final push)',
        description: 'Maximum everything. All channels at full velocity. Lead plays continuous sixteenth notes. Harmony stabs on every beat. Bass at maximum density. Percussion fills every gap. This is the endgame.'
      }
    ],
    compositionNotes: 'This is the "final exam" track, both for the player and for the soundtrack. It should feel like a greatest-hits medley played at breakneck speed. The key compositional challenge is quoting other zones\' signature motifs (the Grid\'s pentatonic ascent, the Reactor\'s alarm interval, the Storm\'s arpeggios) while keeping the track coherent. The rapidly shifting chord progression (2 beats per chord) prevents any harmonic stability -- the player is being pulled in every direction at once, just like the gameplay. At 168 BPM, this is the fastest zone track, appropriate for the hardest content. The chromatic scale means NO wrong notes -- everything is fair game, which is both liberating and chaotic.'
  },

  // =======================================================================
  // 9. BOSS PHASE TRANSITION -- Layered on top of boss music
  // =======================================================================
  {
    id: 'boss_enraged',
    title: 'Core Breach',
    context: 'Boss fight enrage phase. Plays when a boss enters its final phase (below 30% HP). Should work as an intensification of the existing boss track "Megabyte Menace" (165 BPM) or as a standalone replacement.',
    mood: 'Desperate, frantic, no turning back. The boss is at its most dangerous and the player is running low on resources. This is the final push -- either you finish it or it finishes you. Maximum musical intensity.',
    bpm: 175,
    key: 'D',
    scale: 'harmonic_minor',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~1:00 before loop (short, tight loop)',
    instruments: [
      {
        role: 'lead',
        name: 'Breach Siren',
        wave: 'square',
        vol: 0.7,
        adsr: { a: 0.002, d: 0.05, s: 0.7, r: 0.06 },
        notes: 'Maximum-presence square lead. Fastest attack in the soundtrack (0.002s). Plays an aggressive melodic line built almost entirely on the augmented second (Eb to F#) and the leading tone (C# to D). Every phrase drives upward, creating relentless forward motion.'
      },
      {
        role: 'harmony',
        name: 'Warning Klaxon',
        wave: 'pulse25',
        vol: 0.5,
        adsr: { a: 0.005, d: 0.04, s: 0.6, r: 0.06 },
        notes: 'Rhythmic pulse stabs playing power chord intervals (root + fifth) on every beat. The fast envelope makes each stab punchy and aggressive. Between stabs, short rests create a pulsing, alarm-like rhythm. This channel provides the sense of emergency.'
      },
      {
        role: 'bass',
        name: 'Impact Driver',
        wave: 'triangle',
        vol: 0.85,
        adsr: { a: 0.002, d: 0.04, s: 0.85, r: 0.05 },
        notes: 'Extremely heavy triangle bass. Sixteenth-note pedal on D2, the lowest note that still reads clearly. Occasional octave drops to D1 on downbeats for physical impact. The bass is a wall of low-frequency energy that the player feels in their chest.'
      },
      {
        role: 'percussion',
        name: 'Breach Kit',
        wave: 'noise',
        vol: 0.5,
        adsr: { a: 0.001, d: 0.05, s: 0, r: 0.03 },
        filter: { type: 'bandpass', freq: 2000, q: 2 },
        notes: 'The loudest percussion in the soundtrack. Constant double-time feel: kick and snare alternate on every eighth note. Hi-hat plays straight sixteenths. No ghost notes, no subtlety -- maximum forward drive. A crash hit on the downbeat of every pattern.'
      }
    ],
    chordProgression: [
      { chord: 'Dm', beats: 2 },
      { chord: 'Eb', beats: 2 },
      { chord: 'A', beats: 2 },
      { chord: 'Dm', beats: 2 },
    ],
    melodyOutline: [
      // Alarm: rapid alternation on the augmented 2nd
      { note: 'Eb5', beats: 0.25, dynamic: 'ff' },
      { note: 'F#5', beats: 0.25 },
      { note: 'Eb5', beats: 0.25 },
      { note: 'F#5', beats: 0.25 },
      { note: 'A5', beats: 1, dynamic: 'ff' },
      // Descending chromatic slide
      { note: 'A5', beats: 0.25 },
      { note: 'G5', beats: 0.25 },
      { note: 'F#5', beats: 0.25 },
      { note: 'F5', beats: 0.25 },
      { note: 'E5', beats: 0.25 },
      { note: 'Eb5', beats: 0.25 },
      { note: 'D5', beats: 1, dynamic: 'f' },
      // Rising to climax
      { note: 'D5', beats: 0.5 },
      { note: 'F5', beats: 0.5 },
      { note: 'A5', beats: 0.5 },
      { note: 'C#6', beats: 0.5 },
      { note: 'D6', beats: 2, dynamic: 'ff' },
    ],
    bassApproach: 'Relentless sixteenth-note pedal on the root D. When the chord changes, the bass slides chromatically to the new root over 2 sixteenths then hammers it. The A chord gets a dramatic octave drop. This is not a musical bassline -- it is a battering ram.',
    percussionPattern: 'No subtlety. Kick on every eighth note. Snare on 2 and 4, plus the "and" of 1 and 3. Hi-hat sixteenths at full velocity. Crash on beat 1 of every pattern. A snare roll (sixteenth notes for a full beat) leads into each new pattern. This is controlled percussive violence.',
    dynamics: [
      {
        type: 'tempo_shift',
        trigger: 'The track itself is 10 BPM faster than the normal boss track',
        description: 'The tempo jump from 165 (Megabyte Menace) to 175 is immediately felt. The player\'s heart rate goes up with the BPM. The shift should be abrupt -- no gradual transition.'
      },
      {
        type: 'filter_sweep',
        trigger: 'Every 2 patterns',
        description: 'A quick low-to-high filter sweep on the harmony channel (800Hz to 4000Hz over 2 bars) creates a rising siren effect that pairs with the harmonic content. Resets and repeats.'
      },
      {
        type: 'intensity_build',
        trigger: 'Not applicable',
        description: 'This track starts at maximum intensity and STAYS there. There is no build, no breakdown, no quiet moment. It is a 60-second loop of pure pressure. The lack of any release IS the dynamic choice.'
      }
    ],
    compositionNotes: 'This track breaks a fundamental rule of music composition: it has no dynamic contrast. That is intentional. The boss enrage is the climax of the climax -- the player has already heard the normal boss music build and develop. When the enrage hits, the music jumps to a new key, a faster tempo, and maximum everything, and it NEVER lets up. The harmonic minor scale\'s augmented second (Eb to F#) is used as a melodic alarm signal, evoking sirens and emergency. The 2-beat chord changes keep harmonic tension high. Short loop length (1 minute) means the player hears the cycle rapidly, building familiarity that paradoxically increases tension -- they know the loop, they feel each repetition as time running out.'
  },

  // =======================================================================
  // 10. DEATH SCREEN -- Short stinger
  // =======================================================================
  {
    id: 'death',
    title: 'Flatline',
    context: 'Plays when the player dies. Short stinger (5-8 seconds), not looping. Fades to silence. Should contrast sharply with whatever zone music was playing.',
    mood: 'Sudden loss, deflation, but not depressing. A quick somber moment that acknowledges defeat without rubbing it in. The player should feel "oh no" not "I want to stop playing". Quick enough that it does not delay getting back into the action.',
    bpm: 72,
    key: 'Dm',
    scale: 'natural_minor',
    rpb: 4,
    patternLen: 32,
    durationEstimate: '~6 seconds, no loop (use shortEndSeq)',
    instruments: [
      {
        role: 'lead',
        name: 'Last Breath',
        wave: 'sine',
        vol: 0.5,
        adsr: { a: 0.02, d: 0.3, s: 0.3, r: 0.8 },
        notes: 'Pure sine tone with long release. A simple descending phrase: 3 notes falling, each quieter and longer than the last. The sine wave\'s purity contrasts with all the complex waveforms in combat -- everything has been stripped away.'
      },
      {
        role: 'harmony',
        name: 'Fading Echo',
        wave: 'triangle',
        vol: 0.3,
        adsr: { a: 0.05, d: 0.3, s: 0.25, r: 1.0 },
        notes: 'A single sustained chord (Dm) that enters with the first lead note and slowly fades over the full duration. The very long release (1 second) means it lingers after the lead has gone silent. The last sound the player hears is this fading away.'
      },
      {
        role: 'bass',
        name: 'Ground Fall',
        wave: 'triangle',
        vol: 0.6,
        adsr: { a: 0.01, d: 0.2, s: 0.5, r: 0.5 },
        notes: 'A single low D2 on beat 1 that decays slowly. The thud of hitting the ground. Only one note in the entire stinger.'
      },
      {
        role: 'percussion',
        name: 'Heartbeat Stop',
        wave: 'noise',
        vol: 0.25,
        adsr: { a: 0.002, d: 0.15, s: 0, r: 0.1 },
        filter: { type: 'lowpass', freq: 300, q: 2 },
        notes: 'Two low thuds (like a heartbeat) at the start, then nothing. The rhythm stops. The resonant low-pass gives them a body-like quality -- this is the player\'s heartbeat ceasing.'
      }
    ],
    chordProgression: [
      { chord: 'Dm', beats: 16 },
    ],
    melodyOutline: [
      { note: 'A4', beats: 4, dynamic: 'mf' },
      { note: 'F4', beats: 4, dynamic: 'mp' },
      { note: 'D4', beats: 8, dynamic: 'p' },
      // silence until end
    ],
    bassApproach: 'Single note: D2 on beat 1, duration 8 rows. Nothing else. The simplicity is the point.',
    percussionPattern: 'Two hits: row 0 and row 4. Thump-thump. Then silence for the rest. The heartbeat stops.',
    dynamics: [
      {
        type: 'channel_drop',
        trigger: 'After row 12',
        description: 'Everything except the harmony pad has finished playing. The pad continues to decay through its long release envelope, eventually fading to silence by row 24-28. The track ends in silence before the pattern finishes.'
      }
    ],
    compositionNotes: 'This stinger must use shortEndSeq to play once and stop (set shortEndSeq to 1, single pattern). The descending minor triad (A-F-D) is the universal signal for loss. Keeping it to sine and triangle waveforms strips away all the aggressive timbres of combat, creating an immediate sonic contrast that signals "the fight is over." The heartbeat stop (two thuds then silence) is a cliche but an effective one -- it communicates instantly. Total duration around 6 seconds means the player can respawn quickly without the music dragging. This is NOT a grief moment; it is a brief acknowledgment before getting back in.'
  },

];
