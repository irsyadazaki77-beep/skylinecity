import { useState, useEffect, useRef, useCallback } from 'react';
import { CityState, GameSettings } from '../types';
import { saveRepository, saveGameAsync } from '../saveSystem';
import { recordDiagnosticError } from '../releaseReadiness';

interface UseSaveLifecycleOptions {
  settings: GameSettings;
}

export function useSaveLifecycle({ settings }: UseSaveLifecycleOptions) {
  const [hasAutosave, setHasAutosave] = useState(false);
  const lastAutosaveDay = useRef(-1);

  const checkAutosave = useCallback(() => {
    let active = true;
    void saveRepository.load('autosave')
      .then((save) => {
        if (active) setHasAutosave(Boolean(save?.gameState));
      })
      .catch(() => {
        if (active) setHasAutosave(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return checkAutosave();
  }, [checkAutosave]);

  const handleAutosaveOnTick = useCallback((state: CityState) => {
    if (settings.autosave && state.day % 10 === 0 && lastAutosaveDay.current !== state.day) {
      lastAutosaveDay.current = state.day;
      void saveGameAsync('autosave', state, 'Skyline Metropolis').then(() => {
        setHasAutosave(true);
      }).catch((error) => {
        recordDiagnosticError(error, 'AUTOSAVE_WRITE_ERROR');
      });
    }
  }, [settings.autosave]);

  return {
    hasAutosave,
    setHasAutosave,
    checkAutosave,
    handleAutosaveOnTick,
    lastAutosaveDay,
  };
}
