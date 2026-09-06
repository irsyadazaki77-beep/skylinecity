import { describe, expect, it, vi } from 'vitest';
import { getSoundChannelVolume, playUiSound, UiSound } from './audio';

describe('procedural Web Audio sound system', () => {
  const sounds: UiSound[] = [
    'build',
    'construction',
    'demolish',
    'success',
    'alert',
    'warning',
    'error',
    'click',
    'rain',
    'vehicle',
    'siren',
    'ambience',
  ];

  it('keeps music/ambience volume independent from UI volume', () => {
    expect(getSoundChannelVolume({ volume: 80, musicVolume: 0 }, 'ambience')).toBe(0);
    expect(getSoundChannelVolume({ volume: 80, musicVolume: 25 }, 'ambience')).toBe(25);
    expect(getSoundChannelVolume({ volume: 0, musicVolume: 80 }, 'click')).toBe(0);
  });

  it('no-ops safely without error when volume is zero or negative', () => {
    for (const sound of sounds) {
      expect(() => playUiSound({ volume: 0 }, sound)).not.toThrow();
      expect(() => playUiSound({ volume: -10 }, sound)).not.toThrow();
    }
  });

  it('handles all sound profiles when AudioContext is supported', () => {
    const mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockAudioContext = {
      state: 'running',
      currentTime: 10,
      destination: {},
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGain),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    const originalAudioContext = (globalThis as unknown as { window?: { AudioContext?: unknown } }).window?.AudioContext;
    if (typeof globalThis.window === 'undefined') {
      (globalThis as unknown as { window: unknown }).window = globalThis;
    }
    // @ts-expect-error Mocking window AudioContext
    window.AudioContext = vi.fn(function () {
      return mockAudioContext;
    });

    for (const sound of sounds) {
      expect(() => playUiSound({ volume: 75 }, sound)).not.toThrow();
    }

    // @ts-expect-error Restore
    window.AudioContext = originalAudioContext;
  });
});
