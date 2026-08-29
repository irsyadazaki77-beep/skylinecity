import React, { useEffect, useState } from 'react';
import { 
  Home, 
  Briefcase, 
  Building2,
  Factory, 
  Zap, 
  Droplet, 
  MousePointer2, 
  Eraser,
  Flame,
  Shield,
  HeartPulse,
  GraduationCap,
  Trash2,
  Trees,
  CarFront,
  Bus,
  TrainFront,
  Route,
  Warehouse,
  Mountain,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Wrench,
  Search,
  Star,
} from 'lucide-react';
import { ActiveTool, BUILD_COSTS, ROAD_BUILD_COSTS, ROAD_REPAIR_COST, RoadClass, TERRAFORM_COST, TileType, TUNNEL_BUILD_COST } from '../types';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../localization';

export type BuildCategory = 'ROADS' | 'ZONING' | 'UTILITIES' | 'SERVICES' | 'TRANSIT' | 'LOGISTICS' | 'TERRAIN';

interface SidebarProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  activeRoadClass?: RoadClass;
  setActiveRoadClass?: (roadClass: RoadClass) => void;
  unlockedUpgrades?: string[];
  language?: SupportedLanguage;
}

export function Sidebar({ activeTool, setActiveTool: applyTool, activeRoadClass = 'LOCAL', setActiveRoadClass, unlockedUpgrades = [], language = 'id' }: SidebarProps) {
  const [category, setCategory] = useState<BuildCategory>('ZONING');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentTools, setRecentTools] = useState<ActiveTool[]>(() => {
    try { return JSON.parse(localStorage.getItem('skyline_recent_tools') ?? '[]') as ActiveTool[]; } catch { return []; }
  });
  const [favoriteTools, setFavoriteTools] = useState<ActiveTool[]>(() => {
    try { return JSON.parse(localStorage.getItem('skyline_favorite_tools') ?? '[]') as ActiveTool[]; } catch { return []; }
  });
  const catalog = createLocalizationCatalog(language);
  useEffect(() => {
    const includesTool = (tools: readonly string[]) => tools.includes(activeTool);
    if (includesTool([TileType.ROAD, 'TUNNEL_ROAD', 'ROAD_REPAIR'])) setCategory('ROADS');
    else if (includesTool([TileType.RESIDENTIAL, 'RESIDENTIAL_MEDIUM', 'RESIDENTIAL_HIGH', TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL])) setCategory('ZONING');
    else if (includesTool([TileType.POWER_PLANT, TileType.WATER_PUMP])) setCategory('UTILITIES');
    else if (includesTool([TileType.FIRE_STATION, TileType.POLICE_STATION, TileType.CLINIC, TileType.SCHOOL, TileType.WASTE_MANAGEMENT])) setCategory('SERVICES');
    else if (includesTool([TileType.BUS_DEPOT, TileType.BUS_STOP, TileType.TRAM_STATION, TileType.TRAM_STOP, 'TRANSIT_LINE'])) setCategory('TRANSIT');
    else if (includesTool([TileType.WAREHOUSE, TileType.CARGO_TERMINAL])) setCategory('LOGISTICS');
    else if (includesTool(['RAISE_TERRAIN', 'LOWER_TERRAIN', 'LEVEL_TERRAIN', 'SMOOTH_TERRAIN'])) setCategory('TERRAIN');
  }, [activeTool]);
  const setActiveTool = (tool: ActiveTool) => {
    applyTool(tool);
    const nextRecent = [tool, ...recentTools.filter((item) => item !== tool)].slice(0, 4);
    setRecentTools(nextRecent);
    try { localStorage.setItem('skyline_recent_tools', JSON.stringify(nextRecent)); } catch { /* optional preference */ }
  };
  const toggleFavorite = (tool: ActiveTool) => {
    const next = favoriteTools.includes(tool) ? favoriteTools.filter((item) => item !== tool) : [...favoriteTools, tool];
    setFavoriteTools(next);
    try { localStorage.setItem('skyline_favorite_tools', JSON.stringify(next)); } catch { /* optional preference */ }
  };
  const searchItems: Array<{ tool: ActiveTool; label: string; icon: React.ReactNode }> = [
    { tool: TileType.ROAD, label: 'Road', icon: <Route size={16} /> },
    { tool: TileType.RESIDENTIAL, label: 'Low Residential', icon: <Home size={16} /> },
    { tool: 'RESIDENTIAL_MEDIUM', label: 'Medium Residential', icon: <Home size={16} /> },
    { tool: 'RESIDENTIAL_HIGH', label: 'High Residential', icon: <Home size={16} /> },
    { tool: TileType.COMMERCIAL, label: 'Commercial', icon: <Briefcase size={16} /> },
    { tool: TileType.OFFICE, label: 'Office', icon: <Building2 size={16} /> },
    { tool: TileType.INDUSTRIAL, label: 'Industrial', icon: <Factory size={16} /> },
    { tool: TileType.POWER_PLANT, label: 'Power Plant', icon: <Zap size={16} /> },
    { tool: TileType.WATER_PUMP, label: 'Water Pump', icon: <Droplet size={16} /> },
    { tool: TileType.PARK, label: 'Park', icon: <Trees size={16} /> },
    { tool: 'BULLDOZER', label: 'Bulldoze', icon: <Eraser size={16} /> },
  ];

  return (
    <aside id="app-sidebar" className="w-36 bg-[#14161A] border-r border-white/5 flex flex-col items-center py-4 gap-2 z-20 overflow-y-auto select-none">
      {/* Category Picker Tabs */}
      <div className="w-full px-2 flex flex-col gap-1 mb-2">
          <label className="relative block" title={translate(catalog, 'tool.search')}>
          <Search size={13} className="pointer-events-none absolute left-2 top-2.5 text-gray-500" />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={translate(catalog, 'tool.search')} aria-label={translate(catalog, 'tool.search')} className="w-full rounded-lg border border-white/10 bg-black/20 py-1.5 pl-7 pr-2 text-[10px] text-white placeholder:text-gray-600 focus:border-cyan-400/50 focus:outline-none" />
        </label>
        <div className="text-[8px] uppercase tracking-widest text-gray-500 font-mono text-center mb-1">
          Build Category
        </div>
        <div className="grid grid-cols-1 gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setCategory('ROADS')}
            aria-pressed={category === 'ROADS'}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'ROADS' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            {translate(catalog, 'nav.roads')}
          </button>
          <button
            onClick={() => setCategory('ZONING')}
            aria-pressed={category === 'ZONING'}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'ZONING' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            {translate(catalog, 'nav.zoning')}
          </button>
          <button
            onClick={() => setCategory('UTILITIES')}
            aria-pressed={category === 'UTILITIES'}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'UTILITIES' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            {translate(catalog, 'nav.utilities')}
          </button>
          <button
            onClick={() => setCategory('SERVICES')}
            aria-pressed={category === 'SERVICES'}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'SERVICES' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            {translate(catalog, 'nav.services')}
          </button>
          <button
            onClick={() => setCategory('TRANSIT')}
            aria-pressed={category === 'TRANSIT'}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'TRANSIT' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            {translate(catalog, 'nav.transit')}
          </button>
          <button
            onClick={() => setCategory('LOGISTICS')}
            aria-pressed={category === 'LOGISTICS'}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'LOGISTICS' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            {translate(catalog, 'nav.logistics')}
          </button>
          <button
            onClick={() => setCategory('TERRAIN')}
            aria-pressed={category === 'TERRAIN'}
            className={`text-[9px] uppercase tracking-wider py-1.5 rounded-lg transition-colors font-mono ${
              category === 'TERRAIN' ? 'bg-[#D4AF37] text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            {translate(catalog, 'nav.terrain')}
          </button>
        </div>
      </div>

      {searchTerm.trim() && (
        <div className="w-full px-2 space-y-1.5 border-b border-white/5 pb-2">
          {searchItems.filter((item) => item.label.toLowerCase().includes(searchTerm.trim().toLowerCase())).map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              <button type="button" onClick={() => setActiveTool(item.tool)} className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-[10px] ${activeTool === item.tool ? 'bg-cyan-500/20 text-cyan-200' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>
                {item.icon}<span className="truncate">{item.label}</span>
              </button>
              <button type="button" aria-label={`${favoriteTools.includes(item.tool) ? 'Hapus' : 'Tambah'} favorit ${item.label}`} onClick={() => toggleFavorite(item.tool)} className="rounded p-1.5 text-amber-300 hover:bg-white/10"><Star size={12} fill={favoriteTools.includes(item.tool) ? 'currentColor' : 'none'} /></button>
            </div>
          ))}
          {searchItems.filter((item) => item.label.toLowerCase().includes(searchTerm.trim().toLowerCase())).length === 0 && <p className="px-2 py-2 text-[10px] text-gray-500">Tool tidak ditemukan.</p>}
        </div>
      )}

      {!searchTerm.trim() && favoriteTools.length > 0 && (
        <div className="w-full px-2 space-y-1 border-b border-white/5 pb-2">
          <div className="flex items-center gap-1 px-1 text-[8px] uppercase tracking-widest text-amber-300"><Star size={10} fill="currentColor" /> Favorit</div>
          {favoriteTools.slice(0, 3).map((tool) => <button key={tool} type="button" onClick={() => setActiveTool(tool)} className="w-full rounded-lg bg-amber-500/10 px-2 py-1.5 text-left text-[10px] text-amber-100 hover:bg-amber-500/20">{searchItems.find((item) => item.tool === tool)?.label ?? tool}</button>)}
        </div>
      )}

      {/* General Tools */}
      <div className="w-full px-2 flex flex-col gap-1.5">
        <ToolButton 
          icon={<MousePointer2 size={18} />} 
          label={translate(catalog, 'tool.select')} 
          active={activeTool === 'POINTER'} 
          onClick={() => setActiveTool('POINTER')} 
        />
        <ToolButton 
          icon={<Eraser size={18} className="text-red-400" />} 
          label={translate(catalog, 'tool.bulldoze')} 
          active={activeTool === 'BULLDOZER'} 
          onClick={() => setActiveTool('BULLDOZER')} 
        />
      </div>

      <div className="w-20 h-px bg-white/5 my-1" />

      {/* Category Specific Tools */}
      <div className="w-full px-2 flex flex-col gap-2">
        {category === 'ROADS' && (
          <>
            <ToolButton
              icon={<div className="w-5 h-5 bg-[#2A2D35] border border-white/40 rounded-sm" />}
              label="Local Road"
              cost={ROAD_BUILD_COSTS.LOCAL}
              active={activeTool === TileType.ROAD && activeRoadClass === 'LOCAL'}
              onClick={() => { setActiveRoadClass?.('LOCAL'); setActiveTool(TileType.ROAD); }}
            />
            <ToolButton
              icon={<div className="w-5 h-5 bg-[#334155] border border-sky-300/50 rounded-sm" />}
              label="Arterial"
              cost={ROAD_BUILD_COSTS.ARTERIAL}
              active={activeTool === TileType.ROAD && activeRoadClass === 'ARTERIAL'}
              onClick={() => { setActiveRoadClass?.('ARTERIAL'); setActiveTool(TileType.ROAD); }}
            />
            <ToolButton
              icon={<div className="w-5 h-5 bg-[#1e293b] border border-amber-300/60 rounded-sm" />}
              label="Highway"
              cost={ROAD_BUILD_COSTS.HIGHWAY}
              active={activeTool === TileType.ROAD && activeRoadClass === 'HIGHWAY'}
              onClick={() => { setActiveRoadClass?.('HIGHWAY'); setActiveTool(TileType.ROAD); }}
            />
            <ToolButton
              icon={<div className="w-5 h-5 bg-[#111827] border border-violet-300/60 rounded-sm" />}
              label="Tunnel"
              cost={TUNNEL_BUILD_COST}
              active={activeTool === 'TUNNEL_ROAD'}
              onClick={() => { setActiveRoadClass?.('HIGHWAY'); setActiveTool('TUNNEL_ROAD'); }}
            />
            <ToolButton
              icon={<Wrench size={18} className="text-amber-300" />}
              label="Road Works"
              cost={ROAD_REPAIR_COST}
              active={activeTool === 'ROAD_REPAIR'}
              onClick={() => setActiveTool('ROAD_REPAIR')}
            />
          </>
        )}

        {category === 'ZONING' && (
          <>
            <ToolButton icon={<Home size={18} className="text-green-400" />} label="Low Residential" cost={BUILD_COSTS[TileType.RESIDENTIAL]} active={activeTool === TileType.RESIDENTIAL} onClick={() => setActiveTool(TileType.RESIDENTIAL)} />
            <ToolButton icon={<Home size={18} className="text-emerald-300" />} label="Medium Residential" cost={BUILD_COSTS[TileType.RESIDENTIAL] + 20} active={activeTool === 'RESIDENTIAL_MEDIUM'} onClick={() => setActiveTool('RESIDENTIAL_MEDIUM')} />
            <ToolButton icon={<Home size={18} className="text-teal-200" />} label="High Residential" cost={BUILD_COSTS[TileType.RESIDENTIAL] + 45} active={activeTool === 'RESIDENTIAL_HIGH'} onClick={() => setActiveTool('RESIDENTIAL_HIGH')} />
            <ToolButton 
              icon={<Briefcase size={18} className="text-blue-400" />} 
              label="Commercial" 
              cost={BUILD_COSTS[TileType.COMMERCIAL]} 
              active={activeTool === TileType.COMMERCIAL} 
              onClick={() => setActiveTool(TileType.COMMERCIAL)} 
            />
            <ToolButton icon={<Building2 size={18} className="text-violet-300" />} label="Office" cost={BUILD_COSTS[TileType.OFFICE]} active={activeTool === TileType.OFFICE} onClick={() => setActiveTool(TileType.OFFICE)} />
            <ToolButton 
              icon={<Factory size={18} className="text-yellow-400" />} 
              label="Industrial" 
              cost={BUILD_COSTS[TileType.INDUSTRIAL]} 
              active={activeTool === TileType.INDUSTRIAL} 
              onClick={() => setActiveTool(TileType.INDUSTRIAL)} 
            />
          </>
        )}

        {category === 'UTILITIES' && (
          <>
            <ToolButton 
              icon={<Zap size={18} className="text-purple-400" />} 
              label="Power Plant" 
              cost={BUILD_COSTS[TileType.POWER_PLANT]} 
              active={activeTool === TileType.POWER_PLANT} 
              onClick={() => setActiveTool(TileType.POWER_PLANT)} 
            />
            <ToolButton 
              icon={<Droplet size={18} className="text-cyan-400" />} 
              label="Water Pump" 
              cost={BUILD_COSTS[TileType.WATER_PUMP]} 
              active={activeTool === TileType.WATER_PUMP} 
              onClick={() => setActiveTool(TileType.WATER_PUMP)} 
            />
          </>
        )}

        {category === 'SERVICES' && (
          <>
            <ToolButton 
              icon={<Flame size={18} className="text-red-400" />} 
              label="Fire Station" 
              cost={BUILD_COSTS[TileType.FIRE_STATION]} 
              active={activeTool === TileType.FIRE_STATION} 
              onClick={() => setActiveTool(TileType.FIRE_STATION)} 
            />
            <ToolButton 
              icon={<Shield size={18} className="text-blue-400" />} 
              label="Police HQ" 
              cost={BUILD_COSTS[TileType.POLICE_STATION]} 
              active={activeTool === TileType.POLICE_STATION} 
              onClick={() => setActiveTool(TileType.POLICE_STATION)} 
            />
            <ToolButton 
              icon={<HeartPulse size={18} className="text-teal-400" />} 
              label="Clinic" 
              cost={BUILD_COSTS[TileType.CLINIC]} 
              active={activeTool === TileType.CLINIC} 
              onClick={() => setActiveTool(TileType.CLINIC)} 
            />
            <ToolButton 
              icon={<GraduationCap size={18} className="text-amber-400" />} 
              label="School" 
              cost={BUILD_COSTS[TileType.SCHOOL]} 
              active={activeTool === TileType.SCHOOL} 
              onClick={() => setActiveTool(TileType.SCHOOL)} 
            />
            <ToolButton 
              icon={<Trash2 size={18} className="text-slate-400" />} 
              label="Waste Plant" 
              cost={BUILD_COSTS[TileType.WASTE_MANAGEMENT]} 
              active={activeTool === TileType.WASTE_MANAGEMENT} 
              onClick={() => setActiveTool(TileType.WASTE_MANAGEMENT)} 
            />
            <ToolButton 
              icon={<Trees size={18} className="text-emerald-400" />} 
              label="Park" 
              cost={BUILD_COSTS[TileType.PARK]} 
              active={activeTool === TileType.PARK} 
              onClick={() => setActiveTool(TileType.PARK)} 
            />
            <ToolButton
              icon={<CarFront size={18} className="text-slate-300" />}
              label="Parking"
              cost={BUILD_COSTS[TileType.PARKING]}
              active={activeTool === TileType.PARKING}
              onClick={() => setActiveTool(TileType.PARKING)}
            />
            <ToolButton
              icon={<Shield size={18} className="text-sky-300" />}
              label="Flood Barrier"
              cost={BUILD_COSTS[TileType.FLOOD_BARRIER]}
              active={activeTool === TileType.FLOOD_BARRIER}
              onClick={() => setActiveTool(TileType.FLOOD_BARRIER)}
            />
            <ToolButton
              icon={<Droplet size={18} className="text-blue-300" />}
              label="Reservoir"
              cost={BUILD_COSTS[TileType.WATER_RESERVOIR]}
              active={activeTool === TileType.WATER_RESERVOIR}
              onClick={() => setActiveTool(TileType.WATER_RESERVOIR)}
            />
          </>
        )}

        {category === 'TRANSIT' && (
          <>
            <ToolButton
              icon={<Bus size={18} className="text-cyan-400" />}
              label="Bus Depot"
              cost={BUILD_COSTS[TileType.BUS_DEPOT]}
              active={activeTool === TileType.BUS_DEPOT}
              onClick={() => setActiveTool(TileType.BUS_DEPOT)}
              disabled={!unlockedUpgrades.includes('bus_network')}
            />
            <ToolButton
              icon={<TrainFront size={18} className="text-violet-400" />}
              label="Tram Station"
              cost={BUILD_COSTS[TileType.TRAM_STATION]}
              active={activeTool === TileType.TRAM_STATION}
              onClick={() => setActiveTool(TileType.TRAM_STATION)}
              disabled={!unlockedUpgrades.includes('tram_system')}
            />
            <ToolButton icon={<Bus size={18} className="text-cyan-300" />} label="Bus Stop" cost={BUILD_COSTS[TileType.BUS_STOP]} active={activeTool === TileType.BUS_STOP} onClick={() => setActiveTool(TileType.BUS_STOP)} disabled={!unlockedUpgrades.includes('bus_network')} />
            <ToolButton icon={<TrainFront size={18} className="text-violet-300" />} label="Tram Stop" cost={BUILD_COSTS[TileType.TRAM_STOP]} active={activeTool === TileType.TRAM_STOP} onClick={() => setActiveTool(TileType.TRAM_STOP)} disabled={!unlockedUpgrades.includes('tram_system')} />
            <ToolButton
              icon={<Route size={18} className="text-emerald-300" />}
              label="Line Planner"
              active={activeTool === 'TRANSIT_LINE'}
              onClick={() => setActiveTool('TRANSIT_LINE')}
              disabled={!unlockedUpgrades.includes('bus_network') && !unlockedUpgrades.includes('tram_system')}
            />
          </>
        )}

        {category === 'LOGISTICS' && (
          <>
            <ToolButton
              icon={<Warehouse size={18} className="text-orange-300" />}
              label="Warehouse"
              cost={BUILD_COSTS[TileType.WAREHOUSE]}
              active={activeTool === TileType.WAREHOUSE}
              onClick={() => setActiveTool(TileType.WAREHOUSE)}
            />
            <ToolButton
              icon={<Warehouse size={18} className="text-cyan-300" />}
              label="Cargo Terminal"
              cost={BUILD_COSTS[TileType.CARGO_TERMINAL]}
              active={activeTool === TileType.CARGO_TERMINAL}
              onClick={() => setActiveTool(TileType.CARGO_TERMINAL)}
            />
          </>
        )}

        {category === 'TERRAIN' && (
          <>
            <ToolButton icon={<Mountain size={18} className="text-emerald-300" />} label="Raise" cost={TERRAFORM_COST} active={activeTool === 'RAISE_TERRAIN'} onClick={() => setActiveTool('RAISE_TERRAIN')} />
            <ToolButton icon={<ArrowDown size={18} className="text-sky-300" />} label="Lower" cost={TERRAFORM_COST} active={activeTool === 'LOWER_TERRAIN'} onClick={() => setActiveTool('LOWER_TERRAIN')} />
            <ToolButton icon={<ArrowUp size={18} className="text-amber-300" />} label="Level" cost={TERRAFORM_COST} active={activeTool === 'LEVEL_TERRAIN'} onClick={() => setActiveTool('LEVEL_TERRAIN')} />
            <ToolButton icon={<SlidersHorizontal size={18} className="text-cyan-300" />} label="Smooth" cost={TERRAFORM_COST} active={activeTool === 'SMOOTH_TERRAIN'} onClick={() => setActiveTool('SMOOTH_TERRAIN')} />
          </>
        )}
      </div>
    </aside>
  );
}

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  cost?: number;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ToolButton({ icon, label, cost, active, onClick, disabled = false }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-disabled={disabled}
      title={`${label} ${cost !== undefined ? `($${cost})` : ''}`}
      className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all border ${
        active 
          ? 'bg-white/10 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
          : 'bg-transparent border-transparent hover:bg-white/5 text-gray-400 hover:text-gray-200'
      } ${disabled ? 'opacity-35 cursor-not-allowed hover:bg-transparent hover:text-gray-400' : ''}`}
    >
      <div className="mb-0.5">{icon}</div>
      <div className="text-[8px] uppercase tracking-wider text-center leading-tight whitespace-normal max-w-full">{label}</div>
      {cost !== undefined && <div className="text-[8px] text-[#D4AF37] font-mono mt-0.5">${cost}</div>}
    </button>
  );
}
