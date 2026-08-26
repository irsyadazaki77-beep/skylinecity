import React, { useState } from 'react';
import { OverlayMode } from '../../types';
import { 
  Eye, 
  Map, 
  Car, 
  Zap, 
  Droplet, 
  Trash2, 
  HeartPulse, 
  GraduationCap, 
  Flame, 
  Shield, 
  DollarSign, 
  Leaf, 
  Smile, 
  Activity,
  Bus,
  Route,
  Siren,
  CloudLightning,
  Wrench,
  Timer,
  X,
} from 'lucide-react';

interface InfoViewsToolbarProps {
  activeOverlay: OverlayMode;
  onSelectOverlay: (mode: OverlayMode) => void;
}

export function InfoViewsToolbar({ activeOverlay, onSelectOverlay }: InfoViewsToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <div className="absolute bottom-28 left-4 z-[60]">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2.5 bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-full shadow-lg text-gray-300 hover:text-white transition-all hover:scale-105"
          title="Info Views"
        >
          <Eye size={20} />
        </button>
      </div>
    );
  }

  const renderBtn = (mode: OverlayMode, icon: React.ReactNode, label: string, colorClass: string) => {
    const isActive = activeOverlay === mode;
    return (
      <button
        onClick={() => onSelectOverlay(isActive ? 'NONE' : mode)}
        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
          isActive
            ? `${colorClass} shadow-inner`
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}
        title={label}
      >
        {icon}
      </button>
    );
  };

  return (
    <div className="absolute bottom-28 left-4 z-[60] max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar bg-[#0f172a]/90 backdrop-blur-md border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-col gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
      
      <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-white/10">
        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Info Views</span>
        <button type="button" aria-label="Tutup info views" onClick={() => { setIsOpen(false); onSelectOverlay('NONE'); }} className="text-gray-500 hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {renderBtn('TRAFFIC', <Car size={18} />, 'Traffic', 'bg-red-500/30 text-red-200')}
        {renderBtn('ROAD_CONDITION', <Wrench size={18} />, 'Road Condition', 'bg-amber-500/30 text-amber-200')}
        {renderBtn('ROAD_HIERARCHY', <Route size={18} />, 'Road Hierarchy', 'bg-sky-500/30 text-sky-200')}
        {renderBtn('TRANSIT', <Bus size={18} />, 'Public Transit', 'bg-cyan-500/30 text-cyan-200')}
        {renderBtn('TRANSIT_ROUTES', <Route size={18} />, 'Transit Routes', 'bg-violet-500/30 text-violet-200')}
        {renderBtn('DISPATCH', <Siren size={18} />, 'Emergency Dispatch', 'bg-rose-500/30 text-rose-200')}
        {renderBtn('SERVICE_RESPONSE', <Timer size={18} />, 'Service Response Time', 'bg-orange-500/30 text-orange-200')}
        {renderBtn('POWER', <Zap size={18} />, 'Power', 'bg-yellow-500/30 text-yellow-200')}
        {renderBtn('WATER', <Droplet size={18} />, 'Water', 'bg-cyan-500/30 text-cyan-200')}
        {renderBtn('WASTE', <Trash2 size={18} />, 'Waste', 'bg-stone-500/30 text-stone-200')}
        {renderBtn('HEALTH', <HeartPulse size={18} />, 'Health', 'bg-emerald-500/30 text-emerald-200')}
        {renderBtn('EDUCATION', <GraduationCap size={18} />, 'Education', 'bg-blue-500/30 text-blue-200')}
        {renderBtn('FIRE', <Flame size={18} />, 'Fire Safety', 'bg-orange-500/30 text-orange-200')}
        {renderBtn('POLICE', <Shield size={18} />, 'Police & Crime', 'bg-indigo-500/30 text-indigo-200')}
        {renderBtn('LAND_VALUE', <DollarSign size={18} />, 'Land Value', 'bg-emerald-500/30 text-emerald-200')}
        {renderBtn('POLLUTION', <Leaf size={18} />, 'Pollution', 'bg-purple-500/30 text-purple-200')}
        {renderBtn('NOISE', <Activity size={18} />, 'Noise', 'bg-pink-500/30 text-pink-200')}
        {renderBtn('HAPPINESS', <Smile size={18} />, 'Happiness', 'bg-yellow-500/30 text-yellow-200')}
        {renderBtn('INCIDENTS', <Siren size={18} />, 'Incidents', 'bg-rose-500/30 text-rose-200')}
        {renderBtn('DISASTERS', <CloudLightning size={18} />, 'Natural Disasters', 'bg-orange-500/30 text-orange-200')}
        {renderBtn('NATURAL_RESOURCES', <Map size={18} />, 'Natural Resources', 'bg-lime-500/30 text-lime-200')}
        {renderBtn('HYDROLOGY', <Droplet size={18} />, 'Surface Water & Flooding', 'bg-sky-500/30 text-sky-200')}
        {renderBtn('DISTRICTS', <Map size={18} />, 'District Policies', 'bg-violet-500/30 text-violet-200')}
      </div>

      {activeOverlay === 'NATURAL_RESOURCES' && (
        <div className="mt-2 p-2 bg-[#1e293b]/90 border border-white/10 rounded-lg text-xs space-y-1.5 animate-in fade-in duration-150">
          <div className="font-bold text-gray-300 border-b border-white/5 pb-1 mb-1">Resources Legend</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#84cc16]" />
            <span className="text-gray-300">Fertile Land (Farming)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#15803d]" />
            <span className="text-gray-300">Forest (Timber Industry)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#b45309]" />
            <span className="text-gray-300">Ore Minerals (Mining)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#1e1b4b]" />
            <span className="text-gray-300">Oil Reserves (Drilling)</span>
          </div>
        </div>
      )}

      {activeOverlay === 'SERVICE_RESPONSE' && (
        <div className="mt-2 rounded-lg border border-white/10 bg-[#1e293b]/90 p-2 text-[10px] text-slate-300 space-y-1">
          <div className="font-bold text-slate-200">Response time (menit)</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-emerald-500" /> ≤ 5 · cepat</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-yellow-500" /> 5–10 · normal</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-orange-500" /> 10–20 · lambat</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-red-600" /> &gt; 20 / tanpa layanan</div>
        </div>
      )}

      {activeOverlay === 'TRANSIT_ROUTES' && (
        <div className="mt-2 rounded-lg border border-white/10 bg-[#1e293b]/90 p-2 text-[10px] text-slate-300 space-y-1">
          <div className="font-bold text-slate-200">Transit route network</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-cyan-300" /> Line beroperasi pada jam kota saat ini</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-slate-400 border-dashed" /> Line nonaktif / di luar jam layanan / menunggu armada</div>
          <div className="text-slate-500">Rute mengikuti road path kendaraan setelah simulasi berjalan.</div>
        </div>
      )}

      {activeOverlay === 'DISPATCH' && (
        <div className="mt-2 rounded-lg border border-white/10 bg-[#1e293b]/90 p-2 text-[10px] text-slate-300 space-y-1">
          <div className="font-bold text-slate-200">Emergency dispatch paths</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> Fire</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-400" /> Medical</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-400" /> Police</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" /> Traffic</div>
        </div>
      )}
    </div>
  );
}
