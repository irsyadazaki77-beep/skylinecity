import { CityState, GameSettings } from './types';

export type AudioCategory = 'MASTER' | 'MUSIC' | 'AMBIENT' | 'TRAFFIC' | 'WEATHER' | 'UI' | 'SERVICES';

export type UiSound =
  | 'build'
  | 'construction'
  | 'demolish'
  | 'success'
  | 'alert'
  | 'warning'
  | 'error'
  | 'click'
  | 'rain'
  | 'vehicle'
  | 'siren'
  | 'ambience'
  | 'milestone'
  | 'upgrade'
  | 'disaster';

export type AdaptiveMusicState = 'CALM' | 'GROWTH' | 'BUSY_CITY' | 'CRISIS' | 'DISASTER' | 'METROPOLIS';

let audioContext: AudioContext | null = null;
let ambienceTimer: number | null = null;
let currentMusicState: AdaptiveMusicState = 'CALM';
let activeOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];

export function getSoundChannelVolume(
  settings: Pick<GameSettings, 'volume'> & Partial<Pick<GameSettings, 'musicVolume'>>,
  sound: UiSound,
): number {
  return sound === 'ambience'
    ? Math.max(0, Math.min(100, settings.musicVolume ?? settings.volume ?? 0))
    : Math.max(0, Math.min(100, settings.volume ?? 0));
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

/** Synthesized procedural Web Audio feedback keeps the game self-contained without external audio assets. */
export function playUiSound(
  settings: Pick<GameSettings, 'volume'> & Partial<Pick<GameSettings, 'musicVolume'>>,
  sound: UiSound,
): void {
  const channelVolume = getSoundChannelVolume(settings, sound);
  if (channelVolume <= 0) return;
  const context = getAudioContext();
  if (!context) return;

  const profiles: Record<UiSound, { frequency: number; duration: number; type: OscillatorType; bend?: number }> = {
    build: { frequency: 320, duration: 0.075, type: 'sine', bend: 1.18 },
    construction: { frequency: 310, duration: 0.085, type: 'triangle', bend: 1.25 },
    demolish: { frequency: 180, duration: 0.1, type: 'triangle', bend: 0.78 },
    success: { frequency: 520, duration: 0.14, type: 'sine', bend: 1.22 },
    alert: { frequency: 240, duration: 0.13, type: 'square', bend: 0.9 },
    warning: { frequency: 380, duration: 0.18, type: 'sawtooth', bend: 0.85 },
    error: { frequency: 160, duration: 0.16, type: 'sawtooth', bend: 0.7 },
    click: { frequency: 420, duration: 0.035, type: 'sine', bend: 1 },
    rain: { frequency: 210, duration: 0.3, type: 'sine', bend: 0.9 },
    vehicle: { frequency: 120, duration: 0.15, type: 'triangle', bend: 1.2 },
    siren: { frequency: 650, duration: 0.22, type: 'sine', bend: 1.35 },
    ambience: { frequency: 220, duration: 1.2, type: 'sine', bend: 1.02 },
    milestone: { frequency: 587.33, duration: 0.45, type: 'triangle', bend: 1.5 },
    upgrade: { frequency: 440, duration: 0.18, type: 'sine', bend: 1.33 },
    disaster: { frequency: 110, duration: 0.6, type: 'sawtooth', bend: 0.8 },
  };

  const profile = profiles[sound];
  const startTone = () => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const peak = Math.min(0.055, 0.055 * (channelVolume / 100));
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(60, profile.frequency * (profile.bend ?? 1)),
      now + profile.duration,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + profile.duration + 0.01);
  };

  if (context.state === 'suspended') void context.resume().then(startTone).catch(() => undefined);
  else startTone();
}

/**
 * Derives the active musical mood state from live simulation metrics.
 */
export function deriveAdaptiveMusicState(state: CityState): AdaptiveMusicState {
  if (
    (state.activeDisasters ?? 0) > 0 ||
    Boolean((state as unknown as { activeDisaster?: unknown }).activeDisaster) ||
    (state.disasterHappinessPenalty ?? 0) > 20
  ) {
    return 'DISASTER';
  }
  if ((state.causalDiagnostics?.some((d) => d.severity === 'CRITICAL')) || (state.happiness ?? 50) < 30) return 'CRISIS';
  if (state.population >= 50000) return 'METROPOLIS';
  if (state.population >= 5000 || (state.congestionIndex ?? 0) > 35) return 'BUSY_CITY';
  const legacyDemand = (state as unknown as { demand?: { residential?: number; commercial?: number } }).demand;
  const resDemand = state.residentialDemand ?? legacyDemand?.residential ?? 0;
  const comDemand = state.commercialDemand ?? legacyDemand?.commercial ?? 0;
  if (resDemand > 15 || comDemand > 15) return 'GROWTH';
  return 'CALM';
}

/**
 * Procedural ambient city soundscape.
 * Generates smooth multi-voice harmonic chord pads based on city state.
 */
export function updateProceduralAmbience(
  settings: Pick<GameSettings, 'volume'> & Partial<Pick<GameSettings, 'musicVolume'>>,
  musicState: AdaptiveMusicState = currentMusicState,
): void {
  currentMusicState = musicState;
  const musicVol = Math.max(0, Math.min(100, settings.musicVolume ?? 0));
  if (typeof window === 'undefined') return;

  if (musicVol <= 0) {
    if (ambienceTimer !== null) {
      clearInterval(ambienceTimer);
      ambienceTimer = null;
    }
    // Fade out active voices
    activeOscillators.forEach(({ osc, gain }) => {
      try {
        gain.gain.setValueAtTime(gain.gain.value, 0);
        osc.stop();
      } catch {}
    });
    activeOscillators = [];
    return;
  }

  if (ambienceTimer !== null) return;

  // Harmonious chord progressions per music state
  const chordSets: Record<AdaptiveMusicState, number[][]> = {
    CALM: [
      [261.63, 329.63, 392.00], // C4, E4, G4
      [220.00, 261.63, 329.63], // A3, C4, E4
      [349.23, 440.00, 523.25], // F4, A4, C5
    ],
    GROWTH: [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [293.66, 369.99, 440.00, 523.25], // Ddom7
      [349.23, 440.00, 523.25, 659.25], // Fmaj7
    ],
    BUSY_CITY: [
      [293.66, 369.99, 440.00], // D, F#, A
      [329.63, 392.00, 493.88], // E, G, B
      [392.00, 493.88, 587.33], // G, B, D
    ],
    CRISIS: [
      [220.00, 261.63, 311.13], // A dim
      [207.65, 246.94, 293.66], // G# dim
    ],
    DISASTER: [
      [110.00, 155.56, 196.00], // A2 low tension
      [98.00, 138.59, 174.61],  // G2 low tension
    ],
    METROPOLIS: [
      [261.63, 392.00, 523.25, 659.25], // C4, G4, C5, E5
      [220.00, 329.63, 440.00, 587.33], // A3, E4, A4, D5
      [349.23, 440.00, 523.25, 698.46], // F4, A4, C5, F5
    ],
  };

  let step = 0;
  ambienceTimer = window.setInterval(() => {
    const context = getAudioContext();
    if (!context || context.state !== 'running') return;

    const chords = chordSets[currentMusicState] || chordSets.CALM;
    const chord = chords[step % chords.length];
    step++;

    const now = context.currentTime;
    const voiceGain = (musicVol / 100) * 0.015;

    chord.forEach((freq) => {
      try {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = currentMusicState === 'DISASTER' ? 'sawtooth' : currentMusicState === 'CRISIS' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(voiceGain, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.8);

        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(now);
        osc.stop(now + 4.9);
      } catch {}
    });
  }, 4800);
}

/** Cleanly releases audio resources on shutdown or unmount. */
export function disposeAudio(): void {
  if (ambienceTimer !== null) {
    clearInterval(ambienceTimer);
    ambienceTimer = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    void audioContext.close();
    audioContext = null;
  }
}
