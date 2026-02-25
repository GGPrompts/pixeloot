/**
 * MusicPlayer -- Singleton wrapper around ChipPlayer for game music management.
 * Handles track loading, crossfading, volume control, mute toggle, and
 * auto-resuming AudioContext on user interaction.
 */

import { ChipPlayer, SongData } from './ChipPlayer';

// Import song data
import menuSong from './tracks/menu.json';
import townSong from './tracks/town.json';
import combatSong from './tracks/combat.json';
import bossSong from './tracks/boss.json';
import victorySong from './tracks/victory.json';
import gridSong from './tracks/grid.json';
import neonWastesSong from './tracks/neon_wastes.json';
import reactorCoreSong from './tracks/reactor_core.json';
import frozenArraySong from './tracks/frozen_array.json';
import overgrowthSong from './tracks/overgrowth.json';
import stormNetworkSong from './tracks/storm_network.json';
import theAbyssSong from './tracks/the_abyss.json';
import chromaticRiftSong from './tracks/chromatic_rift.json';
import bossEnrageSong from './tracks/boss_enrage.json';
import deathSong from './tracks/death.json';

const TRACKS: Record<string, SongData> = {
  menu: menuSong as unknown as SongData,
  town: townSong as unknown as SongData,
  combat: combatSong as unknown as SongData,
  boss: bossSong as unknown as SongData,
  victory: victorySong as unknown as SongData,
  // Zone-specific combat tracks
  grid: gridSong as unknown as SongData,
  neon_wastes: neonWastesSong as unknown as SongData,
  reactor_core: reactorCoreSong as unknown as SongData,
  frozen_array: frozenArraySong as unknown as SongData,
  overgrowth: overgrowthSong as unknown as SongData,
  storm_network: stormNetworkSong as unknown as SongData,
  the_abyss: theAbyssSong as unknown as SongData,
  chromatic_rift: chromaticRiftSong as unknown as SongData,
  // Contextual stingers / overlays
  enrage: bossEnrageSong as unknown as SongData,
  death: deathSong as unknown as SongData,
};

/**
 * Map zone theme keys to their music track names.
 * Zones without a dedicated track fall back to 'combat'.
 */
const ZONE_TRACK_MAP: Record<string, string> = {
  the_grid: 'grid',
  neon_wastes: 'neon_wastes',
  reactor_core: 'reactor_core',
  frozen_array: 'frozen_array',
  overgrowth: 'overgrowth',
  storm_network: 'storm_network',
  the_abyss: 'the_abyss',
  chromatic_rift: 'chromatic_rift',
};

/** Resolve a zone theme key to a playable track name, falling back to 'combat'. */
export function getZoneTrack(zoneKey: string): string {
  const trackName = ZONE_TRACK_MAP[zoneKey];
  if (trackName && TRACKS[trackName]) return trackName;
  return 'combat';
}

class MusicPlayer {
  private currentPlayer: ChipPlayer | null = null;
  private fadingPlayer: ChipPlayer | null = null;
  private currentTrack: string | null = null;
  private masterVolume = 0.5;
  private muted = false;
  private contextResumed = false;
  private crossfadeTimer: ReturnType<typeof setInterval> | null = null;

  private pendingTrack: string | null = null;

  constructor() {
    // Defer music playback until first user interaction (browser autoplay policy)
    const resumeHandler = () => {
      this.contextResumed = true;
      if (this.currentPlayer) {
        const ctx = this.currentPlayer.getContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume();
        }
      }
      // If play() was called before user gesture, start it now
      if (this.pendingTrack && !this.currentPlayer) {
        this.play(this.pendingTrack);
        this.pendingTrack = null;
      }
      document.removeEventListener('click', resumeHandler);
      document.removeEventListener('keydown', resumeHandler);
      document.removeEventListener('pointerdown', resumeHandler);
    };
    document.addEventListener('click', resumeHandler);
    document.addEventListener('keydown', resumeHandler);
    document.addEventListener('pointerdown', resumeHandler);
  }

  /** Play a track by name. If the same track is already playing, do nothing. */
  play(trackName: string): void {
    const resolved = this.resolveTrack(trackName);
    if (!resolved) return;
    const { songData, resolvedName } = resolved;

    if (this.currentTrack === resolvedName && this.currentPlayer?.isPlaying()) {
      return;
    }

    // Defer playback until user has interacted (browser autoplay policy)
    if (!this.contextResumed) {
      this.pendingTrack = resolvedName;
      this.currentTrack = resolvedName;
      return;
    }

    // Stop current player
    if (this.currentPlayer) {
      this.currentPlayer.stop();
    }
    this.clearCrossfade();

    // Create new player
    const player = new ChipPlayer();
    player.init();
    player.load(songData);
    player.setVolume(this.muted ? 0 : this.masterVolume);

    // For victory track, use short mode and stop after it ends
    if (resolvedName === 'victory') {
      player.setShortMode(true);
      player.onEnd(() => {
        // After victory fanfare, go back to combat music
        this.currentTrack = null;
        this.play('combat');
      });
    }

    player.play();

    this.currentPlayer = player;
    this.currentTrack = resolvedName;
  }

  /** Stop all music. */
  stop(): void {
    this.clearCrossfade();
    if (this.currentPlayer) {
      this.currentPlayer.stop();
      this.currentPlayer = null;
    }
    if (this.fadingPlayer) {
      this.fadingPlayer.stop();
      this.fadingPlayer = null;
    }
    this.currentTrack = null;
  }

  /**
   * Crossfade from current track to a new track over durationMs milliseconds.
   * The old track fades out while the new one fades in.
   */
  crossfade(trackName: string, durationMs: number = 1000): void {
    const resolved = this.resolveTrack(trackName);
    if (!resolved) return;
    const { songData, resolvedName } = resolved;

    if (this.currentTrack === resolvedName && this.currentPlayer?.isPlaying()) {
      return;
    }

    // Defer until user has interacted
    if (!this.contextResumed) {
      this.pendingTrack = resolvedName;
      this.currentTrack = resolvedName;
      return;
    }

    this.clearCrossfade();

    // Move current player to fading slot
    this.fadingPlayer = this.currentPlayer;

    // Create new player
    const newPlayer = new ChipPlayer();
    newPlayer.init();
    newPlayer.load(songData);
    newPlayer.setVolume(0); // Start silent
    newPlayer.play();

    this.currentPlayer = newPlayer;
    this.currentTrack = resolvedName;

    // Crossfade
    const steps = 20;
    const stepMs = durationMs / steps;
    let step = 0;
    const targetVol = this.muted ? 0 : this.masterVolume;

    this.crossfadeTimer = setInterval(() => {
      step++;
      const progress = step / steps;

      // Fade in new player
      if (this.currentPlayer) {
        this.currentPlayer.setVolume(targetVol * progress);
      }

      // Fade out old player
      if (this.fadingPlayer) {
        this.fadingPlayer.setVolume(targetVol * (1 - progress));
      }

      if (step >= steps) {
        this.clearCrossfade();
        // Ensure final volumes are correct
        if (this.currentPlayer) {
          this.currentPlayer.setVolume(targetVol);
        }
      }
    }, stepMs);
  }

  /** Set master volume (0-1). */
  setVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (!this.muted && this.currentPlayer) {
      this.currentPlayer.setVolume(this.masterVolume);
    }
  }

  /** Get master volume (0-1). */
  getMasterVolume(): number {
    return this.masterVolume;
  }

  /** Toggle mute on/off. Returns the new muted state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.currentPlayer) {
      this.currentPlayer.setVolume(this.muted ? 0 : this.masterVolume);
    }
    return this.muted;
  }

  /** Check if currently muted. */
  isMuted(): boolean {
    return this.muted;
  }

  /** Get the currently playing track name, or null. */
  getCurrentTrack(): string | null {
    return this.currentTrack;
  }

  /** Returns 0-1 audio energy from the current player's analyser. */
  getEnergy(): number {
    if (!this.currentPlayer) return 0;
    return this.currentPlayer.getEnergy();
  }

  /**
   * Resolve a track name to valid song data.
   * If the requested track has no song data (null placeholder), fall back:
   *   - 'enrage' falls back to 'boss'
   *   - 'death' falls back to nothing (returns null to skip)
   *   - zone tracks fall back to 'combat'
   */
  private resolveTrack(trackName: string): { songData: SongData; resolvedName: string } | null {
    // Direct lookup
    if (trackName in TRACKS && TRACKS[trackName]) {
      return { songData: TRACKS[trackName], resolvedName: trackName };
    }

    // Fallback for known placeholder tracks
    const FALLBACKS: Record<string, string | null> = {
      enrage: 'boss',
      death: null, // no fallback -- skip silently
    };
    const fallback = trackName in FALLBACKS ? FALLBACKS[trackName] : 'combat';
    if (fallback && TRACKS[fallback]) {
      return { songData: TRACKS[fallback], resolvedName: fallback };
    }

    // Truly unknown track
    if (!(trackName in TRACKS)) {
      console.warn(`MusicPlayer: unknown track "${trackName}"`);
    }
    return null;
  }

  private clearCrossfade(): void {
    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    if (this.fadingPlayer) {
      this.fadingPlayer.stop();
      this.fadingPlayer = null;
    }
  }
}

/** Singleton music player instance */
export const musicPlayer = new MusicPlayer();
