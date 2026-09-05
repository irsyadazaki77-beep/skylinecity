import { useCallback, useState } from 'react';

export function useCameraControls() {
  const [cameraFocus, setCameraFocus] = useState<[number, number] | null>(null);
  const [cameraViewMode, setCameraViewMode] = useState<'2D' | '3D'>('3D');
  const [cameraZoom, setCameraZoom] = useState(1.25);
  const [cameraRotation, setCameraRotation] = useState(0);

  const resetCamera = useCallback(() => {
    setCameraFocus(null);
    setCameraViewMode('3D');
    setCameraZoom(1.25);
    setCameraRotation(0);
  }, []);

  const cancelFocus = useCallback(() => {
    setCameraFocus(null);
  }, []);

  return {
    cameraFocus,
    setCameraFocus,
    cameraViewMode,
    setCameraViewMode,
    cameraZoom,
    setCameraZoom,
    cameraRotation,
    setCameraRotation,
    resetCamera,
    cancelFocus,
  };
}
