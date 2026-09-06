import React, { useMemo } from 'react';
import { CityState } from '../types';
import { AlertTriangle, ZapOff, Droplets, Factory, ShieldAlert } from 'lucide-react';
import type { SupportedLanguage } from '../localization';

interface NotificationToastProps {
  gameState: CityState;
  language?: SupportedLanguage;
}

export interface CityAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  icon: React.ReactNode;
}

export function NotificationToast({ gameState, language = 'id' }: NotificationToastProps) {
  const alerts = useMemo(() => {
    const list: CityAlert[] = [];
    const copy = language === 'en' ? {
      powerTitle: 'Power Grid Overloaded', powerMessage: (value: number) => `${value} MW capacity deficit. Build power plants.`,
      waterTitle: 'Water Supply Shortage', waterMessage: (value: number) => `${value} gal deficit. Construct water pumps.`,
      pollutionTitle: 'High City Pollution', pollutionMessage: (value: number) => `Average AQI is ${value}. Plant parks to filter toxic zones.`,
      unemploymentTitle: 'Unemployment Spike', unemploymentMessage: (value: number) => `${value}% of citizens are seeking work. Zone commercial or industrial areas.`,
      crimeTitle: 'Crime Wave Detected', crimeMessage: (value: number) => `Crime rate at ${value}%. Deploy police stations.`,
    } : {
      powerTitle: 'Jaringan Listrik Kelebihan Beban', powerMessage: (value: number) => `Defisit kapasitas ${value} MW. Bangun pembangkit listrik.`,
      waterTitle: 'Kekurangan Pasokan Air', waterMessage: (value: number) => `Defisit ${value} gal. Bangun pompa air.`,
      pollutionTitle: 'Polusi Kota Tinggi', pollutionMessage: (value: number) => `Rata-rata AQI ${value}. Tanam taman untuk menyaring zona beracun.`,
      unemploymentTitle: 'Lonjakan Pengangguran', unemploymentMessage: (value: number) => `${value}% warga mencari pekerjaan. Zonakan area komersial atau industri.`,
      crimeTitle: 'Gelombang Kejahatan Terdeteksi', crimeMessage: (value: number) => `Tingkat kriminalitas ${value}%. Bangun kantor polisi.`,
    };

    // Check for power shortage
    if (gameState.powerCapacity < gameState.powerDemand && gameState.powerDemand > 0) {
      list.push({
        id: 'power-shortage',
        type: 'error',
        title: copy.powerTitle,
        message: copy.powerMessage(gameState.powerDemand - gameState.powerCapacity),
        icon: <ZapOff size={16} className="text-amber-400" />,
      });
    }

    // Check for water shortage
    if (gameState.waterCapacity < gameState.waterDemand && gameState.waterDemand > 0) {
      list.push({
        id: 'water-shortage',
        type: 'error',
        title: copy.waterTitle,
        message: copy.waterMessage(gameState.waterDemand - gameState.waterCapacity),
        icon: <Droplets size={16} className="text-cyan-400" />,
      });
    }

    // Check high pollution
    if (gameState.pollutionAverage > 30) {
      list.push({
        id: 'high-pollution',
        type: 'warning',
        title: copy.pollutionTitle,
        message: copy.pollutionMessage(gameState.pollutionAverage),
        icon: <Factory size={16} className="text-red-400" />,
      });
    }

    // Check unemployment
    if (gameState.unemploymentRate > 20 && gameState.population > 10) {
      list.push({
        id: 'high-unemployment',
        type: 'warning',
        title: copy.unemploymentTitle,
        message: copy.unemploymentMessage(gameState.unemploymentRate),
        icon: <AlertTriangle size={16} className="text-yellow-400" />,
      });
    }

    // Check high crime rate
    if (gameState.population > 0 && gameState.crimeRate > 25) {
      list.push({
        id: 'high-crime',
        type: 'warning',
        title: copy.crimeTitle,
        message: copy.crimeMessage(gameState.crimeRate),
        icon: <ShieldAlert size={16} className="text-purple-400" />,
      });
    }

    return list.slice(0, 3); // Show top 3 critical issues
  }, [gameState, language]);

  if (alerts.length === 0) return null;

  return (
    <div className="city-alert-stack absolute top-20 right-6 z-30 flex flex-col gap-2 max-w-sm pointer-events-none" aria-live="polite">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-3 rounded-xl border shadow-xl flex items-start gap-3 backdrop-blur transition-all duration-300 ${
            alert.type === 'error'
              ? 'bg-red-950/80 border-red-500/40 text-red-200'
              : 'bg-amber-950/80 border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="p-1.5 rounded-lg bg-black/40 shrink-0">{alert.icon}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono">{alert.title}</h4>
            <p className="text-[10px] opacity-85 leading-tight mt-0.5">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
