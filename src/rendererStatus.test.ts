import { describe, expect, it } from 'vitest';
import { getRendererFallbackKind } from './rendererStatus';

describe('renderer fallback status', () => {
  it('only reports unsupported WebGL when the capability check fails', () => {
    expect(getRendererFallbackKind(false, false)).toBe('webgl-unavailable');
  });

  it('identifies canvas initialization failures when WebGL is available', () => {
    expect(getRendererFallbackKind(true, false)).toBe('initialization-failed');
  });

  it('identifies a renderer error after a successful canvas creation', () => {
    expect(getRendererFallbackKind(true, true)).toBe('runtime-error');
  });
});
