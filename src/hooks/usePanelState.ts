import { useState } from 'react';
import { TileData, OverlayMode } from '../types';
import { NotificationItem } from '../components/ui/NotificationCenter';
import { useCameraControls } from './useCameraControls';

export type PanelType = 'city' | 'treasury' | 'tech' | 'policies' | 'districts' | 'missions' | 'save' | 'settings' | null;

export function isRuntimeAuditScenarioRequested(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get('debug') === '1' || Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  return debugEnabled && params.get('audit') === 'transit-dispatch';
}

export function usePanelState() {
  const camera = useCameraControls();
  const [panel, setPanel] = useState<PanelType>(null);
  const [activeOverlay, setActiveOverlay] = useState<OverlayMode>('NONE');
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null);
  const [rendererMode, setRendererMode] = useState<'3d' | '2d'>('3d');
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererFailure, setRendererFailure] = useState(false);
  const [mapExpansionMode, setMapExpansionMode] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [milestoneCelebration, setMilestoneCelebration] = useState<number | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'welcome',
      type: 'milestone',
      title: 'Selamat Datang di Skyline Simulator 2.0',
      message: 'Kota dimulai dalam status PAUSED. Ikuti panduan walikota di sisi kiri layar.',
      timestamp: 'Hari 1',
      unread: true,
    },
  ]);

  const [showStartScreen, setShowStartScreen] = useState(() => {
    if (isRuntimeAuditScenarioRequested()) return false;
    try {
      return localStorage.getItem('skyline_release_intro_seen') !== 'true';
    } catch {
      return true;
    }
  });

  return {
    panel,
    setPanel,
    activeOverlay,
    setActiveOverlay,
    ...camera,
    selectedTile,
    setSelectedTile,
    rendererMode,
    setRendererMode,
    rendererReady,
    setRendererReady,
    rendererFailure,
    setRendererFailure,
    mapExpansionMode,
    setMapExpansionMode,
    notificationOpen,
    setNotificationOpen,
    notifications,
    setNotifications,
    milestoneCelebration,
    setMilestoneCelebration,
    showStartScreen,
    setShowStartScreen,
  };
}
