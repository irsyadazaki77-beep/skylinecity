/**
 * Keep renderer failure decisions independent from React/Three.  Apart from
 * making the copy accurate, this lets us regression-test the three failure
 * paths in a regular Vitest environment.
 */
export type RendererFallbackKind = 'webgl-unavailable' | 'initialization-failed' | 'runtime-error';

export function getRendererFallbackKind(webglAvailable: boolean, rendererWasReady: boolean): RendererFallbackKind | null {
  if (!webglAvailable) return 'webgl-unavailable';
  return rendererWasReady ? 'runtime-error' : 'initialization-failed';
}
