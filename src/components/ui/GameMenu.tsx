import React, { useEffect, useState } from 'react';
import { Menu, Info, DollarSign, Cpu, Landmark, Target, Save, Settings as SettingsIcon, RotateCcw, MapPinned } from 'lucide-react';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../../localization';

interface GameMenuProps {
  onOpenCityInfo: () => void;
  onOpenEconomy: () => void;
  onOpenTech: () => void;
  onOpenPolicies: () => void;
  onOpenDistricts: () => void;
  onOpenObjectives: () => void;
  onOpenSaveLoad: () => void;
  onOpenSettings: () => void;
  onNewGame: () => void;
  language?: SupportedLanguage;
}

export function GameMenu({
  onOpenCityInfo,
  onOpenEconomy,
  onOpenTech,
  onOpenPolicies,
  onOpenDistricts,
  onOpenObjectives,
  onOpenSaveLoad,
  onOpenSettings,
  onNewGame,
  language = 'id',
}: GameMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const catalog = createLocalizationCatalog(language);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAction = (callback: () => void) => {
    callback();
    setIsOpen(false);
  };

  const handleNewCityConfirm = () => {
    const message = language === 'en'
      ? 'Are you sure you want to start a New City? All current progress will be lost.'
      : 'Yakin ingin memulai Kota Baru? Semua progres saat ini akan hilang.';
    if (window.confirm(message)) {
      handleAction(onNewGame);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="min-h-[44px] min-w-[44px] bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all shadow-md active:scale-95 flex items-center justify-center"
        title={translate(catalog, 'menu.title')}
      >
        <Menu size={16} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop overlay to close when clicking outside */}
          <div className="fixed inset-0 z-50" onClick={() => setIsOpen(false)} />
          
          <div role="menu" className="absolute right-0 mt-2 w-56 bg-[#0f172a]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl p-1.5 z-[60] flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150 text-gray-200">
            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-white/5 mb-1 bg-black/15 rounded-t-lg">
              {translate(catalog, 'menu.title')}
            </div>
            
            <MenuOption icon={<Info size={14} className="text-blue-400" />} label={translate(catalog, 'menu.cityInformation')} onClick={() => handleAction(onOpenCityInfo)} />
            <MenuOption icon={<DollarSign size={14} className="text-green-400" />} label={translate(catalog, 'menu.economy')} onClick={() => handleAction(onOpenEconomy)} />
            <MenuOption icon={<Cpu size={14} className="text-cyan-300" />} label={translate(catalog, 'menu.technology')} onClick={() => handleAction(onOpenTech)} />
            <MenuOption icon={<Landmark size={14} className="text-amber-400" />} label={translate(catalog, 'menu.policies')} onClick={() => handleAction(onOpenPolicies)} />
            <MenuOption icon={<MapPinned size={14} className="text-teal-300" />} label={translate(catalog, 'menu.districts')} onClick={() => handleAction(onOpenDistricts)} />
            <MenuOption icon={<Target size={14} className="text-red-400" />} label={translate(catalog, 'menu.objectives')} onClick={() => handleAction(onOpenObjectives)} />
            
            <div className="h-[1px] bg-white/5 my-1" />
            
            <MenuOption icon={<Save size={14} className="text-sky-400" />} label={translate(catalog, 'menu.saveLoad')} onClick={() => handleAction(onOpenSaveLoad)} />
            <MenuOption icon={<SettingsIcon size={14} className="text-emerald-400" />} label={translate(catalog, 'menu.settings')} onClick={() => handleAction(onOpenSettings)} />
            
            <div className="h-[1px] bg-white/5 my-1" />
            
            <button
              role="menuitem"
              onClick={handleNewCityConfirm}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 active:bg-rose-500/20 transition-all text-left"
            >
              <RotateCcw size={14} />
              <span>{translate(catalog, 'menu.quitNewCity')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MenuOption({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition-all text-left"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
