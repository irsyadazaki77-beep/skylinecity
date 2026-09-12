export type RenderQualityPreset = 'high' | 'balanced' | 'mobile';

export interface RenderQualityConfig {
  preset: RenderQualityPreset;
  nearLodDistance: number;
  farLodDistance: number;
  presentationRadius: number;
  shadowCasters: number;
  maxPedestrians: number;
  waterSheen: boolean;
  steam: boolean;
  postProcessing: boolean;
  fog: boolean;
}

export const RENDER_QUALITY: Record<RenderQualityPreset, RenderQualityConfig> = {
  high: { preset: 'high', nearLodDistance: 42, farLodDistance: 78, presentationRadius: 100, shadowCasters: 180, maxPedestrians: 160, waterSheen: true, steam: true, postProcessing: true, fog: true },
  balanced: { preset: 'balanced', nearLodDistance: 34, farLodDistance: 62, presentationRadius: 76, shadowCasters: 96, maxPedestrians: 96, waterSheen: true, steam: false, postProcessing: false, fog: true },
  mobile: { preset: 'mobile', nearLodDistance: 9, farLodDistance: 24, presentationRadius: 48, shadowCasters: 0, maxPedestrians: 40, waterSheen: false, steam: false, postProcessing: false, fog: false },
};

export function getRenderQuality(qualityTier: 'balanced' | 'reduced', shadowQuality: 'low' | 'medium' | 'high' = 'medium'): RenderQualityConfig {
  if (qualityTier === 'reduced' || shadowQuality === 'low') return RENDER_QUALITY.mobile;
  return shadowQuality === 'high' ? RENDER_QUALITY.high : RENDER_QUALITY.balanced;
}
