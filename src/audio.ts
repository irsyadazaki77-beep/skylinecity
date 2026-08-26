import { GameSettings } from './types';

export type UiSound = 'build' | 'demolish' | 'success' | 'alert' | 'click';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

/** Small, synthesized UI feedback keeps the game self-contained and avoids loading audio assets. */
export function playUiSound(settings: Pick<GameSettings, 'volume'>, sound: UiSound): void {
  if ((settings.volume ?? 0) <= 0) return;
  const context = getAudioContext();
  if (!context) return;

  const profiles: Record<UiSound, { frequency: number; duration: number; type: OscillatorType; bend?: number }> = {
    build: { frequency: 320, duration: 0.075, type: 'sine', bend: 1.18 },
    demolish: { frequency: 180, duration: 0.1, type: 'triangle', bend: 0.78 },
    success: { frequency: 520, duration: 0.14, type: 'sine', bend: 1.22 },
    alert: { frequency: 240, duration: 0.13, type: 'square', bend: 0.9 },
    click: { frequency: 420, duration: 0.035, type: 'sine', bend: 1 },
  };
  const profile = profiles[sound];
  const startTone = () => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const peak = Math.min(0.055, 0.055 * ((settings.volume ?? 0) / 100));
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, profile.frequency * (profile.bend ?? 1)), now + profile.duration);
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
