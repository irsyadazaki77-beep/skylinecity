import { useState, useCallback } from 'react';
import { CityState } from '../types';
import { TutorialHighlightType } from '../components/ui/StarterTutorial';
import { NotificationItem } from '../components/ui/NotificationCenter';
import { UiSound } from '../audio';

interface UseTutorialFlowOptions {
  setGameState: React.Dispatch<React.SetStateAction<CityState>>;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  playSound: (sound: UiSound) => void;
}

export function useTutorialFlow({
  setGameState,
  setNotifications,
  playSound,
}: UseTutorialFlowOptions) {
  const [tutorialHighlight, setTutorialHighlight] = useState<TutorialHighlightType>('highway');

  const handleEmergencyGrant = useCallback(() => {
    setGameState((cur) => {
      playSound('success');
      setNotifications((items) => [
        {
          id: `starter-grant-${Date.now()}`,
          type: 'economy' as const,
          title: 'Bantuan Darurat Walikota Diterima',
          message: 'Kas kota menerima hibah pemulihan awal sebesar +$2,500.',
          timestamp: `Hari ${cur.day}`,
          unread: true,
        },
        ...items,
      ].slice(0, 30));
      return { ...cur, money: cur.money + 2500 };
    });
  }, [playSound, setGameState, setNotifications]);

  return {
    tutorialHighlight,
    setTutorialHighlight,
    handleEmergencyGrant,
  };
}
