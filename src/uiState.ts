import { ActiveTool, OverlayMode, TileType } from './types';

export type UiMode = 'OBSERVE' | 'BUILD' | 'ROAD' | 'ZONE' | 'UTILITY' | 'INSPECT' | 'TUTORIAL' | 'DIAGNOSTICS';

const roadTools: ActiveTool[] = [TileType.ROAD, 'TUNNEL_ROAD', 'ROAD_REPAIR'];
const zoneTools: ActiveTool[] = [TileType.RESIDENTIAL, 'RESIDENTIAL_MEDIUM', 'RESIDENTIAL_HIGH', TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL];
const utilityTools: ActiveTool[] = [TileType.POWER_PLANT, TileType.WATER_PUMP];

export function deriveUiMode({
  activeTool,
  selectedTile,
  panel,
  activeOverlay,
  showStartScreen,
  tutorialActive,
}: {
  activeTool: ActiveTool;
  selectedTile: boolean;
  panel: string | null;
  activeOverlay: OverlayMode;
  showStartScreen: boolean;
  tutorialActive: boolean;
}): UiMode {
  if (showStartScreen || tutorialActive) return 'TUTORIAL';
  if (panel === 'city' || activeOverlay === 'INCIDENTS' || activeOverlay === 'DISASTERS') return 'DIAGNOSTICS';
  if (selectedTile) return 'INSPECT';
  if (roadTools.includes(activeTool)) return 'ROAD';
  if (zoneTools.includes(activeTool)) return 'ZONE';
  if (utilityTools.includes(activeTool)) return 'UTILITY';
  if (activeTool !== 'POINTER') return 'BUILD';
  return 'OBSERVE';
}

export const UI_MODE_COPY: Record<UiMode, { label: string; action: string }> = {
  OBSERVE: { label: 'Observe', action: 'Review city' },
  BUILD: { label: 'Build', action: 'Choose a tool' },
  ROAD: { label: 'Roads', action: 'Place road' },
  ZONE: { label: 'Zones', action: 'Zone land' },
  UTILITY: { label: 'Utilities', action: 'Connect service' },
  INSPECT: { label: 'Inspect', action: 'Review selection' },
  TUTORIAL: { label: 'Onboarding', action: 'Follow the guided step' },
  DIAGNOSTICS: { label: 'Diagnostics', action: 'Resolve city issue' },
};
