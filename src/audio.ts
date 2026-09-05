import { GameSettings } from './types';

export type UiSound =
  | 'build'
  | 'demolish'
  | 'success'
  | 'alert'
  | 'click'
  | 'warning'
  | 'rain'
  | 'vehicle'
  | 'siren'
  | 'ambience'
  | 'construction'
  | 'error';

let audioContext: AudioContext | null = null;
let ambienceTimer: number | null = null;
let ambienceGainNode: GainNode | null = null;

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
 * Procedural ambient city soundscape.
 * Periodically generates soothing harmonic tones when musicVolume > 0.
 */
export function updateProceduralAmbience(
  settings: Pick<GameSettings, 'volume'> & Partial<Pick<GameSettings, 'musicVolume'>>,
): void {
  const musicVol = Math.max(0, Math.min(100, settings.musicVolume ?? 0));
  if (typeof window === 'undefined') return;

  if (musicVol <= 0) {
    if (ambienceTimer !== null) {
      window.clearInterval(ambienceTimer);
      ambienceTimer = null;
    }
    return;
  }

  const context = getAudioContext();
  if (!context) return;

  if (ambienceTimer === null) {
    const chordProgressions = [
      [220, 277.18, 329.63], // A major
      [196, 246.94, 293.66], // G major
      [174.61, 220, 261.63], // F major
      [164.81, 207.65, 246.94], // E minor
    ];
    let step = 0;

    const playAmbientChord = () => {
      if (context.state === 'suspended') return;
      const notes = chordProgressions[step % chordProgressions.length];
      step += 1;
      const now = context.currentTime;
      const chordGain = Math.min(0.018, 0.018 * (musicVol / 100));

      notes.forEach((freq, idx) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(chordGain, now + idx * 0.15 + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 4.5);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 4.6);
      });
    };

    ambienceTimer = window.setInterval(playAmbientChord, 5000);
    playAmbientChord();
  }
}
