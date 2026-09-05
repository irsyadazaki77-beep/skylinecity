import React from 'react';
import { X, Bell, Check, Trash, Landmark, Zap, Shield, Flame, HeartPulse, GraduationCap, Trophy, Radio, Car, Users, Milestone } from 'lucide-react';
import type { SupportedLanguage } from '../../localization';

export interface NotificationItem {
  id: string;
  type: 'economy' | 'utilities' | 'traffic' | 'population' | 'crime' | 'fire' | 'health' | 'education' | 'milestone' | 'event' | 'mission';
  title: string;
  message: string;
  timestamp: string; // e.g. "Day 15"
  unread: boolean;
  location?: { x: number; y: number };
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onClearHistory: () => void;
  onSelectLocation?: (location: { x: number; y: number }) => void;
  language?: SupportedLanguage;
}

export function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onClearHistory,
  onSelectLocation,
  language = 'id',
}: NotificationCenterProps) {
  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => n.unread).length;
  const copy = language === 'en'
    ? {
      title: 'Notifications',
      markAllRead: 'Mark all as read',
      clearHistory: 'Clear history',
      quiet: 'Your city is quiet. No notifications yet.',
    }
    : {
      title: 'Notifikasi',
      markAllRead: 'Tandai semua sudah dibaca',
      clearHistory: 'Hapus riwayat',
      quiet: 'Kota sedang tenang. Belum ada notifikasi.',
    };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'economy': return <Landmark className="text-amber-400" size={16} />;
      case 'utilities': return <Zap className="text-cyan-400" size={16} />;
      case 'traffic': return <Car className="text-blue-400" size={16} />;
      case 'population': return <Users className="text-teal-400" size={16} />;
      case 'crime': return <Shield className="text-purple-400" size={16} />;
      case 'fire': return <Flame className="text-red-400" size={16} />;
      case 'health': return <HeartPulse className="text-rose-400" size={16} />;
      case 'education': return <GraduationCap className="text-indigo-400" size={16} />;
      case 'milestone': return <Milestone className="text-emerald-400" size={16} />;
      case 'event': return <Radio className="text-orange-400" size={16} />;
      case 'mission': return <Trophy className="text-yellow-400" size={16} />;
      default: return <Bell className="text-gray-400" size={16} />;
    }
  };

  return (
    <div className="notification-center absolute top-20 right-6 z-40 bg-[#0f172a]/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl w-80 max-w-[calc(100vw-1.5rem)] max-h-[70vh] flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200 text-gray-200" role="region" aria-labelledby="notification-center-title">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-blue-400 animate-pulse" />
          <span id="notification-center-title" className="font-bold text-sm text-white font-mono">{copy.title}</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <button type="button" aria-label="Tutup notifikasi" onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]">
          <X size={16} />
        </button>
      </div>

      {/* Quick Actions */}
      {notifications.length > 0 && (
        <div className="flex justify-between items-center text-[10px] font-semibold text-gray-400">
          <button type="button" onClick={onMarkAllRead} className="min-h-[44px] flex items-center gap-1 px-1 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)] rounded-lg">
            <Check size={12} />
            <span>{copy.markAllRead}</span>
          </button>
          <button type="button" onClick={onClearHistory} className="min-h-[44px] flex items-center gap-1 px-1 text-rose-400 hover:text-rose-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded-lg">
            <Trash size={11} />
            <span>{copy.clearHistory}</span>
          </button>
        </div>
      )}

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <Bell size={28} className="text-gray-600" />
            <p className="text-xs text-gray-400">{copy.quiet}</p>
          </div>
        ) : (
          notifications.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                if (item.location) onSelectLocation?.(item.location);
              }}
              className={`p-2.5 rounded-xl border flex gap-3 transition-all ${
                item.unread
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-black/20 border-white/5 opacity-80'
              } ${item.location ? 'w-full text-left hover:border-cyan-400/40 cursor-pointer' : 'w-full text-left cursor-default'}`}
            >
              <div className="shrink-0 p-1.5 rounded-lg bg-black/40 flex items-center justify-center self-start mt-0.5">
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-1">
                  <h4 className={`text-xs font-bold leading-tight truncate ${item.unread ? 'text-white' : 'text-gray-300'}`}>
                    {item.title}
                  </h4>
                  <span className="text-[9px] font-mono font-medium text-gray-500 shrink-0 mt-0.5">
                    {item.timestamp}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 leading-normal mt-1 break-words">
                  {item.message}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

    </div>
  );
}
