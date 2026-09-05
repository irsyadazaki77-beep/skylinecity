import React, { useEffect, useState, useRef } from 'react';
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
  X,
  ChevronRight,
  Layers,
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
  population?: number;
  milestoneLevel?: number;
}

export function Sidebar({
  activeTool,
  setActiveTool: applyTool,
  activeRoadClass = 'LOCAL',
  setActiveRoadClass,
  unlockedUpgrades = [],
  language = 'id',
  population = 0,
  milestoneLevel = 0,
}: SidebarProps) {
  // Keep the map unobstructed until the player explicitly chooses a build category.
  const [selectedCategory, setSelectedCategory] = useState<BuildCategory | null>(null);
  const [tier, setTier] = useState<'basic' | 'advanced'>('basic');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentTools, setRecentTools] = useState<ActiveTool[]>(() => {
    try { return JSON.parse(localStorage.getItem('skyline_recent_tools') ?? '[]') as ActiveTool[]; } catch { return []; }
  });
  const [favoriteTools, setFavoriteTools] = useState<ActiveTool[]>(() => {
    try { return JSON.parse(localStorage.getItem('skyline_favorite_tools') ?? '[]') as ActiveTool[]; } catch { return []; }
  });

  const drawerRef = useRef<HTMLDivElement>(null);
  const catalog = createLocalizationCatalog(language);
  const showServices = population >= 25 || milestoneLevel >= 1;
  const showTransit = population >= 60 || milestoneLevel >= 2;
  const showLogistics = population >= 120 || milestoneLevel >= 2;
  const allowAdvancedZoning = population >= 50 || milestoneLevel >= 1;

  // Sync category when activeTool changes from outside (e.g. NextAction or shortcut)
  useEffect(() => {
    const includesTool = (tools: readonly string[]) => tools.includes(activeTool);
    if (includesTool([TileType.ROAD, 'TUNNEL_ROAD', 'ROAD_REPAIR'])) setSelectedCategory('ROADS');
    else if (includesTool([TileType.RESIDENTIAL, 'RESIDENTIAL_MEDIUM', 'RESIDENTIAL_HIGH', TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL])) setSelectedCategory('ZONING');
    else if (includesTool([TileType.POWER_PLANT, TileType.WATER_PUMP])) setSelectedCategory('UTILITIES');
    else if (includesTool([TileType.FIRE_STATION, TileType.POLICE_STATION, TileType.CLINIC, TileType.SCHOOL, TileType.WASTE_MANAGEMENT, TileType.PARK, TileType.PARKING, TileType.FLOOD_BARRIER, TileType.WATER_RESERVOIR])) setSelectedCategory('SERVICES');
    else if (includesTool([TileType.BUS_DEPOT, TileType.BUS_STOP, TileType.TRAM_STATION, TileType.TRAM_STOP, 'TRANSIT_LINE'])) setSelectedCategory('TRANSIT');
    else if (includesTool([TileType.WAREHOUSE, TileType.CARGO_TERMINAL])) setSelectedCategory('LOGISTICS');
    else if (includesTool(['RAISE_TERRAIN', 'LOWER_TERRAIN', 'LEVEL_TERRAIN', 'SMOOTH_TERRAIN'])) setSelectedCategory('TERRAIN');
  }, [activeTool]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCategory !== null && activeTool === 'POINTER') {
        setSelectedCategory(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCategory, activeTool]);

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

  const handleCategoryClick = (category: BuildCategory) => {
    if (selectedCategory === category) {
      setSelectedCategory(null); // Toggle closed
    } else {
      setSelectedCategory(category);
    }
  };

  const searchItems: Array<{ tool: ActiveTool; label: string; cost: number; category: BuildCategory; icon: React.ReactNode; desc?: string }> = [
    { tool: TileType.ROAD, label: translate(catalog, 'tool.localRoad'), cost: ROAD_BUILD_COSTS.LOCAL, category: 'ROADS', icon: <Route size={16} />, desc: 'Jalan akses dasar antar kavling' },
    { tool: TileType.ROAD, label: translate(catalog, 'tool.arterial'), cost: ROAD_BUILD_COSTS.ARTERIAL, category: 'ROADS', icon: <Route size={16} />, desc: 'Jalan utama 4 lajur kapasitas tinggi' },
    { tool: TileType.ROAD, label: translate(catalog, 'tool.highway'), cost: ROAD_BUILD_COSTS.HIGHWAY, category: 'ROADS', icon: <Route size={16} />, desc: 'Jalan bebas hambatan regional' },
    { tool: 'TUNNEL_ROAD', label: translate(catalog, 'tool.tunnel'), cost: TUNNEL_BUILD_COST, category: 'ROADS', icon: <Route size={16} />, desc: 'Jalur bawah tanah menembus bukit' },
    { tool: 'ROAD_REPAIR', label: translate(catalog, 'tool.roadWorks'), cost: ROAD_REPAIR_COST, category: 'ROADS', icon: <Wrench size={16} />, desc: 'Perbaikan jalan berlubang/rusak' },
    
    { tool: TileType.RESIDENTIAL, label: translate(catalog, 'tool.lowResidential'), cost: BUILD_COSTS[TileType.RESIDENTIAL], category: 'ZONING', icon: <Home size={16} />, desc: 'Rumah tapak keluarga' },
    { tool: 'RESIDENTIAL_MEDIUM', label: translate(catalog, 'tool.mediumResidential'), cost: BUILD_COSTS[TileType.RESIDENTIAL] + 20, category: 'ZONING', icon: <Home size={16} />, desc: 'Townhouse & apartemen rendah' },
    { tool: 'RESIDENTIAL_HIGH', label: translate(catalog, 'tool.highResidential'), cost: BUILD_COSTS[TileType.RESIDENTIAL] + 45, category: 'ZONING', icon: <Home size={16} />, desc: 'Apartemen bertingkat tinggi' },
    { tool: TileType.COMMERCIAL, label: translate(catalog, 'tool.commercial'), cost: BUILD_COSTS[TileType.COMMERCIAL], category: 'ZONING', icon: <Briefcase size={16} />, desc: 'Toko, pasar & jasa komersial' },
    { tool: TileType.OFFICE, label: translate(catalog, 'tool.office'), cost: BUILD_COSTS[TileType.OFFICE], category: 'ZONING', icon: <Building2 size={16} />, desc: 'Perkantoran modern minim polusi' },
    { tool: TileType.INDUSTRIAL, label: translate(catalog, 'tool.industrial'), cost: BUILD_COSTS[TileType.INDUSTRIAL], category: 'ZONING', icon: <Factory size={16} />, desc: 'Pabrik & manufaktur berat' },
    
    { tool: TileType.POWER_PLANT, label: translate(catalog, 'tool.powerPlant'), cost: BUILD_COSTS[TileType.POWER_PLANT], category: 'UTILITIES', icon: <Zap size={16} />, desc: 'Pembangkit daya listrik kota' },
    { tool: TileType.WATER_PUMP, label: translate(catalog, 'tool.waterPump'), cost: BUILD_COSTS[TileType.WATER_PUMP], category: 'UTILITIES', icon: <Droplet size={16} />, desc: 'Pompa pasokan air bersih' },
    
    { tool: TileType.FIRE_STATION, label: translate(catalog, 'tool.fireStation'), cost: BUILD_COSTS[TileType.FIRE_STATION], category: 'SERVICES', icon: <Flame size={16} />, desc: 'Pos pemadam kebakaran darurat' },
    { tool: TileType.POLICE_STATION, label: translate(catalog, 'tool.policeStation'), cost: BUILD_COSTS[TileType.POLICE_STATION], category: 'SERVICES', icon: <Shield size={16} />, desc: 'Kantor keamanan dan patroli' },
    { tool: TileType.CLINIC, label: translate(catalog, 'tool.clinic'), cost: BUILD_COSTS[TileType.CLINIC], category: 'SERVICES', icon: <HeartPulse size={16} />, desc: 'Puskesmas & layanan kesehatan' },
    { tool: TileType.SCHOOL, label: translate(catalog, 'tool.school'), cost: BUILD_COSTS[TileType.SCHOOL], category: 'SERVICES', icon: <GraduationCap size={16} />, desc: 'Pendidikan dasar warga' },
    { tool: TileType.WASTE_MANAGEMENT, label: translate(catalog, 'tool.wastePlant'), cost: BUILD_COSTS[TileType.WASTE_MANAGEMENT], category: 'SERVICES', icon: <Trash2 size={16} />, desc: 'Pengolahan dan daur ulang limbah' },
    { tool: TileType.PARK, label: translate(catalog, 'tool.park'), cost: BUILD_COSTS[TileType.PARK], category: 'SERVICES', icon: <Trees size={16} />, desc: 'Ruang terbuka hijau & rekreasi' },
    { tool: TileType.PARKING, label: translate(catalog, 'tool.parking'), cost: BUILD_COSTS[TileType.PARKING], category: 'SERVICES', icon: <CarFront size={16} />, desc: 'Gedung parkir komuter' },
    { tool: TileType.FLOOD_BARRIER, label: translate(catalog, 'tool.floodBarrier'), cost: BUILD_COSTS[TileType.FLOOD_BARRIER], category: 'SERVICES', icon: <Shield size={16} />, desc: 'Tanggul penahan luapan air sungai' },
    { tool: TileType.WATER_RESERVOIR, label: translate(catalog, 'tool.reservoir'), cost: BUILD_COSTS[TileType.WATER_RESERVOIR], category: 'SERVICES', icon: <Droplet size={16} />, desc: 'Waduk cadangan air kota' },
    
    { tool: TileType.BUS_DEPOT, label: translate(catalog, 'tool.busDepot'), cost: BUILD_COSTS[TileType.BUS_DEPOT], category: 'TRANSIT', icon: <Bus size={16} />, desc: 'Garasi armada bus umum' },
    { tool: TileType.TRAM_STATION, label: translate(catalog, 'tool.tramStation'), cost: BUILD_COSTS[TileType.TRAM_STATION], category: 'TRANSIT', icon: <TrainFront size={16} />, desc: 'Stasiun terminus trem listrik' },
    { tool: TileType.BUS_STOP, label: translate(catalog, 'tool.busStop'), cost: BUILD_COSTS[TileType.BUS_STOP], category: 'TRANSIT', icon: <Bus size={16} />, desc: 'Halte penjemputan penumpang' },
    { tool: TileType.TRAM_STOP, label: translate(catalog, 'tool.tramStop'), cost: BUILD_COSTS[TileType.TRAM_STOP], category: 'TRANSIT', icon: <TrainFront size={16} />, desc: 'Pemberhentian trem perkotaan' },
    
    { tool: TileType.WAREHOUSE, label: translate(catalog, 'tool.warehouse'), cost: BUILD_COSTS[TileType.WAREHOUSE], category: 'LOGISTICS', icon: <Warehouse size={16} />, desc: 'Gudang penyangga logistik barang' },
    { tool: TileType.CARGO_TERMINAL, label: translate(catalog, 'tool.cargoTerminal'), cost: BUILD_COSTS[TileType.CARGO_TERMINAL], category: 'LOGISTICS', icon: <Warehouse size={16} />, desc: 'Terminal distribusi muatan kargo' },
    
    { tool: 'RAISE_TERRAIN', label: translate(catalog, 'tool.raise'), cost: TERRAFORM_COST, category: 'TERRAIN', icon: <Mountain size={16} />, desc: 'Meninggikan kontur tanah' },
    { tool: 'LOWER_TERRAIN', label: translate(catalog, 'tool.lower'), cost: TERRAFORM_COST, category: 'TERRAIN', icon: <ArrowDown size={16} />, desc: 'Menurunkan kontur tanah' },
    { tool: 'LEVEL_TERRAIN', label: translate(catalog, 'tool.level'), cost: TERRAFORM_COST, category: 'TERRAIN', icon: <ArrowUp size={16} />, desc: 'Meratakan tinggi tanah' },
    { tool: 'SMOOTH_TERRAIN', label: translate(catalog, 'tool.smooth'), cost: TERRAFORM_COST, category: 'TERRAIN', icon: <SlidersHorizontal size={16} />, desc: 'Menghaluskan lereng dan tebing' },
  ];

  const categoryTitles: Record<BuildCategory, string> = {
    ROADS: 'Jalan & Transportasi',
    ZONING: 'Zonasi Wilayah',
    UTILITIES: 'Utilitas Listrik & Air',
    SERVICES: 'Layanan Publik Kota',
    TRANSIT: 'Transit Transportasi Masal',
    LOGISTICS: 'Logistik & Pergudangan',
    TERRAIN: 'Rekayasa Medan Tanah',
  };

  return (
    <div className="tool-rail-container">
      {/* 1. LEFT COMPACT RAIL (68px) */}
      <nav aria-label="Menu Alat Bangun" className="tool-rail">
        {/* Pointer / Select */}
        <RailButton
          icon={<MousePointer2 size={18} />}
          label={translate(catalog, 'tool.select')}
          active={activeTool === 'POINTER'}
          onClick={() => {
            setActiveTool('POINTER');
            setSelectedCategory(null);
          }}
        />

        {/* Bulldozer / Demolish */}
        <RailButton
          icon={<Eraser size={18} className="text-rose-400" />}
          label={translate(catalog, 'tool.bulldoze')}
          active={activeTool === 'BULLDOZER'}
          onClick={() => {
            setActiveTool('BULLDOZER');
            setSelectedCategory(null);
          }}
        />

        <div className="w-8 h-px bg-white/10 my-0.5" />

        {/* Category: Roads */}
        <RailButton
          icon={<Route size={18} className="text-amber-300" />}
          label={translate(catalog, 'nav.roads')}
          active={selectedCategory === 'ROADS'}
          expanded={selectedCategory === 'ROADS'}
          onClick={() => handleCategoryClick('ROADS')}
        />

        {/* Category: Zoning */}
        <RailButton
          icon={<Home size={18} className="text-emerald-400" />}
          label={translate(catalog, 'nav.zoning')}
          active={selectedCategory === 'ZONING'}
          expanded={selectedCategory === 'ZONING'}
          onClick={() => handleCategoryClick('ZONING')}
        />

        {/* Category: Utilities */}
        <RailButton
          icon={<Zap size={18} className="text-cyan-400" />}
          label={translate(catalog, 'nav.utilities')}
          active={selectedCategory === 'UTILITIES'}
          expanded={selectedCategory === 'UTILITIES'}
          onClick={() => handleCategoryClick('UTILITIES')}
        />

        {/* Category: Services */}
        {showServices && (
          <RailButton
            icon={<Shield size={18} className="text-blue-400" />}
            label={translate(catalog, 'nav.services')}
            active={selectedCategory === 'SERVICES'}
            expanded={selectedCategory === 'SERVICES'}
            onClick={() => handleCategoryClick('SERVICES')}
          />
        )}

        {/* Category: Transit */}
        {showTransit && (
          <RailButton
            icon={<Bus size={18} className="text-cyan-300" />}
            label={translate(catalog, 'nav.transit')}
            active={selectedCategory === 'TRANSIT'}
            expanded={selectedCategory === 'TRANSIT'}
            onClick={() => handleCategoryClick('TRANSIT')}
          />
        )}

        {/* Category: Logistics */}
        {showLogistics && (
          <RailButton
            icon={<Warehouse size={18} className="text-amber-300" />}
            label={translate(catalog, 'nav.logistics')}
            active={selectedCategory === 'LOGISTICS'}
            expanded={selectedCategory === 'LOGISTICS'}
            onClick={() => handleCategoryClick('LOGISTICS')}
          />
        )}

        {/* Category: Terrain */}
        <RailButton
          icon={<Mountain size={18} className="text-teal-400" />}
          label={translate(catalog, 'nav.terrain')}
          active={selectedCategory === 'TERRAIN'}
          expanded={selectedCategory === 'TERRAIN'}
          onClick={() => handleCategoryClick('TERRAIN')}
        />
      </nav>

      {/* 2. FLYOUT DRAWER (opens only after a category is chosen) */}
      {selectedCategory !== null && (
        <>
          <button
            type="button"
            className="tool-drawer-backdrop"
            aria-label="Tutup panel alat"
            onClick={() => setSelectedCategory(null)}
          />
          <div
            ref={drawerRef}
            className="tool-drawer"
            role="region"
            aria-label={categoryTitles[selectedCategory]}
          >
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-white tracking-wide truncate">
                {categoryTitles[selectedCategory]}
              </span>
            </div>
            <button
              type="button"
              aria-label="Tutup panel alat"
              onClick={() => setSelectedCategory(null)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search bar inside drawer */}
          <div className="p-3 border-b border-white/10 bg-black/10">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari alat bangun..."
                aria-label="Cari alat bangun"
                className="w-full min-h-[44px] rounded-lg border border-white/10 bg-[#070b14]/80 py-1.5 pl-8 pr-7 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-1 top-1 min-h-[42px] min-w-[42px] flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Subcategory Tier Switch for Roads and Zoning */}
          {!searchTerm.trim() && (selectedCategory === 'ROADS' || selectedCategory === 'ZONING') && (
            <div className="flex px-3 pt-2 pb-1 gap-1">
              <button
                type="button"
                onClick={() => setTier('basic')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                  tier === 'basic'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {translate(catalog, 'sidebar.basic')}
              </button>
              <button
                type="button"
                onClick={() => setTier('advanced')}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                  tier === 'advanced'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {translate(catalog, 'sidebar.advanced')}
              </button>
            </div>
          )}

          {/* Tool Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {searchTerm.trim() ? (
              // Search Results
              searchItems
                .filter((item) => item.label.toLowerCase().includes(searchTerm.trim().toLowerCase()))
                .map((item) => (
                  <DrawerToolCard
                    key={`${item.tool}-${item.label}`}
                    icon={item.icon}
                    label={item.label}
                    cost={item.cost}
                    desc={item.desc}
                    active={activeTool === item.tool}
                    isFavorite={favoriteTools.includes(item.tool)}
                    onToggleFavorite={() => toggleFavorite(item.tool)}
                    onClick={() => {
                      if (item.category === 'ROADS') {
                        if (item.label.includes('Arteri')) setActiveRoadClass?.('ARTERIAL');
                        else if (item.label.includes('Tol')) setActiveRoadClass?.('HIGHWAY');
                        else setActiveRoadClass?.('LOCAL');
                      }
                      setActiveTool(item.tool);
                    }}
                  />
                ))
            ) : (
              // Category Specific List
              <>
                {selectedCategory === 'ROADS' && (
                  tier === 'basic' ? (
                    <>
                      <DrawerToolCard
                        icon={<Route size={18} className="text-amber-300" />}
                        label={translate(catalog, 'tool.localRoad')}
                        cost={ROAD_BUILD_COSTS.LOCAL}
                        desc="Jalan 2 lajur standar penghubung kavling"
                        active={activeTool === TileType.ROAD && activeRoadClass === 'LOCAL'}
                        isFavorite={favoriteTools.includes(TileType.ROAD)}
                        onToggleFavorite={() => toggleFavorite(TileType.ROAD)}
                        onClick={() => { setActiveRoadClass?.('LOCAL'); setActiveTool(TileType.ROAD); }}
                      />
                      <DrawerToolCard
                        icon={<Wrench size={18} className="text-amber-300" />}
                        label={translate(catalog, 'tool.roadWorks')}
                        cost={ROAD_REPAIR_COST}
                        desc="Perbaiki ruas jalan yang rusak dan berlubang"
                        active={activeTool === 'ROAD_REPAIR'}
                        isFavorite={favoriteTools.includes('ROAD_REPAIR')}
                        onToggleFavorite={() => toggleFavorite('ROAD_REPAIR')}
                        onClick={() => setActiveTool('ROAD_REPAIR')}
                      />
                    </>
                  ) : (
                    <>
                      <DrawerToolCard
                        icon={<Route size={18} className="text-sky-300" />}
                        label={translate(catalog, 'tool.arterial')}
                        cost={ROAD_BUILD_COSTS.ARTERIAL}
                        desc="Jalan arteri 4 lajur untuk koridor sibuk"
                        active={activeTool === TileType.ROAD && activeRoadClass === 'ARTERIAL'}
                        isFavorite={favoriteTools.includes(TileType.ROAD)}
                        onToggleFavorite={() => toggleFavorite(TileType.ROAD)}
                        onClick={() => { setActiveRoadClass?.('ARTERIAL'); setActiveTool(TileType.ROAD); }}
                      />
                      <DrawerToolCard
                        icon={<Route size={18} className="text-amber-400" />}
                        label={translate(catalog, 'tool.highway')}
                        cost={ROAD_BUILD_COSTS.HIGHWAY}
                        desc="Jalan tol regional berkecepatan tinggi"
                        active={activeTool === TileType.ROAD && activeRoadClass === 'HIGHWAY'}
                        isFavorite={favoriteTools.includes(TileType.ROAD)}
                        onToggleFavorite={() => toggleFavorite(TileType.ROAD)}
                        onClick={() => { setActiveRoadClass?.('HIGHWAY'); setActiveTool(TileType.ROAD); }}
                      />
                      <DrawerToolCard
                        icon={<Route size={18} className="text-violet-300" />}
                        label={translate(catalog, 'tool.tunnel')}
                        cost={TUNNEL_BUILD_COST}
                        desc="Terowongan jalan bawah tanah"
                        active={activeTool === 'TUNNEL_ROAD'}
                        isFavorite={favoriteTools.includes('TUNNEL_ROAD')}
                        onToggleFavorite={() => toggleFavorite('TUNNEL_ROAD')}
                        onClick={() => { setActiveRoadClass?.('HIGHWAY'); setActiveTool('TUNNEL_ROAD'); }}
                      />
                    </>
                  )
                )}

                {selectedCategory === 'ZONING' && (
                  tier === 'basic' ? (
                    <>
                      <DrawerToolCard
                        icon={<Home size={18} className="text-emerald-400" />}
                        label={translate(catalog, 'tool.lowResidential')}
                        cost={BUILD_COSTS[TileType.RESIDENTIAL]}
                        desc="Kavling rumah tapak dan keluarga"
                        active={activeTool === TileType.RESIDENTIAL}
                        isFavorite={favoriteTools.includes(TileType.RESIDENTIAL)}
                        onToggleFavorite={() => toggleFavorite(TileType.RESIDENTIAL)}
                        onClick={() => setActiveTool(TileType.RESIDENTIAL)}
                      />
                      <DrawerToolCard
                        icon={<Briefcase size={18} className="text-blue-400" />}
                        label={translate(catalog, 'tool.commercial')}
                        cost={BUILD_COSTS[TileType.COMMERCIAL]}
                        desc="Pertokoan, ritel, dan layanan warga"
                        active={activeTool === TileType.COMMERCIAL}
                        isFavorite={favoriteTools.includes(TileType.COMMERCIAL)}
                        onToggleFavorite={() => toggleFavorite(TileType.COMMERCIAL)}
                        onClick={() => setActiveTool(TileType.COMMERCIAL)}
                      />
                      <DrawerToolCard
                        icon={<Factory size={18} className="text-amber-400" />}
                        label={translate(catalog, 'tool.industrial')}
                        cost={BUILD_COSTS[TileType.INDUSTRIAL]}
                        desc="Pabrik manufaktur dan lapangan kerja industri"
                        active={activeTool === TileType.INDUSTRIAL}
                        isFavorite={favoriteTools.includes(TileType.INDUSTRIAL)}
                        onToggleFavorite={() => toggleFavorite(TileType.INDUSTRIAL)}
                        onClick={() => setActiveTool(TileType.INDUSTRIAL)}
                      />
                    </>
                  ) : allowAdvancedZoning ? (
                    <>
                      <DrawerToolCard
                        icon={<Home size={18} className="text-emerald-300" />}
                        label={translate(catalog, 'tool.mediumResidential')}
                        cost={BUILD_COSTS[TileType.RESIDENTIAL] + 20}
                        desc="Apartemen sedang dan rumah susun"
                        active={activeTool === 'RESIDENTIAL_MEDIUM'}
                        isFavorite={favoriteTools.includes('RESIDENTIAL_MEDIUM')}
                        onToggleFavorite={() => toggleFavorite('RESIDENTIAL_MEDIUM')}
                        onClick={() => setActiveTool('RESIDENTIAL_MEDIUM')}
                      />
                      <DrawerToolCard
                        icon={<Home size={18} className="text-teal-200" />}
                        label={translate(catalog, 'tool.highResidential')}
                        cost={BUILD_COSTS[TileType.RESIDENTIAL] + 45}
                        desc="Menara apartemen hunian kepadatan tinggi"
                        active={activeTool === 'RESIDENTIAL_HIGH'}
                        isFavorite={favoriteTools.includes('RESIDENTIAL_HIGH')}
                        onToggleFavorite={() => toggleFavorite('RESIDENTIAL_HIGH')}
                        onClick={() => setActiveTool('RESIDENTIAL_HIGH')}
                      />
                      <DrawerToolCard
                        icon={<Building2 size={18} className="text-violet-300" />}
                        label={translate(catalog, 'tool.office')}
                        cost={BUILD_COSTS[TileType.OFFICE]}
                        desc="Perkantoran profesional bebas polusi berat"
                        active={activeTool === TileType.OFFICE}
                        isFavorite={favoriteTools.includes(TileType.OFFICE)}
                        onToggleFavorite={() => toggleFavorite(TileType.OFFICE)}
                        onClick={() => setActiveTool(TileType.OFFICE)}
                      />
                    </>
                  ) : (
                    <div className="p-4 text-center rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400">
                      Zonasi lanjutan terbuka pada 50+ warga atau milestone Town.
                    </div>
                  )
                )}

                {selectedCategory === 'UTILITIES' && (
                  <>
                    <DrawerToolCard
                      icon={<Zap size={18} className="text-cyan-400" />}
                      label={translate(catalog, 'tool.powerPlant')}
                      cost={BUILD_COSTS[TileType.POWER_PLANT]}
                      desc="Pembangkit listrik (pasang di samping jalan)"
                      active={activeTool === TileType.POWER_PLANT}
                      isFavorite={favoriteTools.includes(TileType.POWER_PLANT)}
                      onToggleFavorite={() => toggleFavorite(TileType.POWER_PLANT)}
                      onClick={() => setActiveTool(TileType.POWER_PLANT)}
                    />
                    <DrawerToolCard
                      icon={<Droplet size={18} className="text-cyan-300" />}
                      label={translate(catalog, 'tool.waterPump')}
                      cost={BUILD_COSTS[TileType.WATER_PUMP]}
                      desc="Pompa air (wajib menyentuh air & jalan)"
                      active={activeTool === TileType.WATER_PUMP}
                      isFavorite={favoriteTools.includes(TileType.WATER_PUMP)}
                      onToggleFavorite={() => toggleFavorite(TileType.WATER_PUMP)}
                      onClick={() => setActiveTool(TileType.WATER_PUMP)}
                    />
                  </>
                )}

                {selectedCategory === 'SERVICES' && (
                  <>
                    <DrawerToolCard
                      icon={<Flame size={18} className="text-rose-400" />}
                      label={translate(catalog, 'tool.fireStation')}
                      cost={BUILD_COSTS[TileType.FIRE_STATION]}
                      desc="Pos pemadam kebakaran proteksi gedung"
                      active={activeTool === TileType.FIRE_STATION}
                      isFavorite={favoriteTools.includes(TileType.FIRE_STATION)}
                      onToggleFavorite={() => toggleFavorite(TileType.FIRE_STATION)}
                      onClick={() => setActiveTool(TileType.FIRE_STATION)}
                    />
                    <DrawerToolCard
                      icon={<Shield size={18} className="text-blue-400" />}
                      label={translate(catalog, 'tool.policeStation')}
                      cost={BUILD_COSTS[TileType.POLICE_STATION]}
                      desc="Kantor polisi penekan angka kriminalitas"
                      active={activeTool === TileType.POLICE_STATION}
                      isFavorite={favoriteTools.includes(TileType.POLICE_STATION)}
                      onToggleFavorite={() => toggleFavorite(TileType.POLICE_STATION)}
                      onClick={() => setActiveTool(TileType.POLICE_STATION)}
                    />
                    <DrawerToolCard
                      icon={<HeartPulse size={18} className="text-teal-400" />}
                      label={translate(catalog, 'tool.clinic')}
                      cost={BUILD_COSTS[TileType.CLINIC]}
                      desc="Klinik kesehatan tingkatkan kepuasan warga"
                      active={activeTool === TileType.CLINIC}
                      isFavorite={favoriteTools.includes(TileType.CLINIC)}
                      onToggleFavorite={() => toggleFavorite(TileType.CLINIC)}
                      onClick={() => setActiveTool(TileType.CLINIC)}
                    />
                    <DrawerToolCard
                      icon={<GraduationCap size={18} className="text-amber-400" />}
                      label={translate(catalog, 'tool.school')}
                      cost={BUILD_COSTS[TileType.SCHOOL]}
                      desc="Sekolah tingkatkan taraf hidup & ekonomi"
                      active={activeTool === TileType.SCHOOL}
                      isFavorite={favoriteTools.includes(TileType.SCHOOL)}
                      onToggleFavorite={() => toggleFavorite(TileType.SCHOOL)}
                      onClick={() => setActiveTool(TileType.SCHOOL)}
                    />
                    <DrawerToolCard
                      icon={<Trash2 size={18} className="text-slate-400" />}
                      label={translate(catalog, 'tool.wastePlant')}
                      cost={BUILD_COSTS[TileType.WASTE_MANAGEMENT]}
                      desc="Tempat pengolahan sampah higienis"
                      active={activeTool === TileType.WASTE_MANAGEMENT}
                      isFavorite={favoriteTools.includes(TileType.WASTE_MANAGEMENT)}
                      onToggleFavorite={() => toggleFavorite(TileType.WASTE_MANAGEMENT)}
                      onClick={() => setActiveTool(TileType.WASTE_MANAGEMENT)}
                    />
                    <DrawerToolCard
                      icon={<Trees size={18} className="text-emerald-400" />}
                      label={translate(catalog, 'tool.park')}
                      cost={BUILD_COSTS[TileType.PARK]}
                      desc="Taman hijau dongkrak nilai tanah & kebahagiaan"
                      active={activeTool === TileType.PARK}
                      isFavorite={favoriteTools.includes(TileType.PARK)}
                      onToggleFavorite={() => toggleFavorite(TileType.PARK)}
                      onClick={() => setActiveTool(TileType.PARK)}
                    />
                    <DrawerToolCard
                      icon={<CarFront size={18} className="text-slate-300" />}
                      label={translate(catalog, 'tool.parking')}
                      cost={BUILD_COSTS[TileType.PARKING]}
                      desc="Lahan parkir mengurangi kemacetan jalan"
                      active={activeTool === TileType.PARKING}
                      isFavorite={favoriteTools.includes(TileType.PARKING)}
                      onToggleFavorite={() => toggleFavorite(TileType.PARKING)}
                      onClick={() => setActiveTool(TileType.PARKING)}
                    />
                    <DrawerToolCard
                      icon={<Shield size={18} className="text-sky-300" />}
                      label={translate(catalog, 'tool.floodBarrier')}
                      cost={BUILD_COSTS[TileType.FLOOD_BARRIER]}
                      desc="Tanggul pelindung banjir sungai"
                      active={activeTool === TileType.FLOOD_BARRIER}
                      isFavorite={favoriteTools.includes(TileType.FLOOD_BARRIER)}
                      onToggleFavorite={() => toggleFavorite(TileType.FLOOD_BARRIER)}
                      onClick={() => setActiveTool(TileType.FLOOD_BARRIER)}
                    />
                    <DrawerToolCard
                      icon={<Droplet size={18} className="text-blue-300" />}
                      label={translate(catalog, 'tool.reservoir')}
                      cost={BUILD_COSTS[TileType.WATER_RESERVOIR]}
                      desc="Waduk retensi penyimpan air tawar"
                      active={activeTool === TileType.WATER_RESERVOIR}
                      isFavorite={favoriteTools.includes(TileType.WATER_RESERVOIR)}
                      onToggleFavorite={() => toggleFavorite(TileType.WATER_RESERVOIR)}
                      onClick={() => setActiveTool(TileType.WATER_RESERVOIR)}
                    />
                  </>
                )}

                {selectedCategory === 'TRANSIT' && (
                  <>
                    <DrawerToolCard
                      icon={<Bus size={18} className="text-cyan-400" />}
                      label={translate(catalog, 'tool.busDepot')}
                      cost={BUILD_COSTS[TileType.BUS_DEPOT]}
                      desc="Depot pusat operasi bus kota"
                      active={activeTool === TileType.BUS_DEPOT}
                      disabled={!unlockedUpgrades.includes('bus_network')}
                      lockReason={!unlockedUpgrades.includes('bus_network') ? 'Perlu riset Pohon Teknologi' : undefined}
                      isFavorite={favoriteTools.includes(TileType.BUS_DEPOT)}
                      onToggleFavorite={() => toggleFavorite(TileType.BUS_DEPOT)}
                      onClick={() => setActiveTool(TileType.BUS_DEPOT)}
                    />
                    <DrawerToolCard
                      icon={<TrainFront size={18} className="text-violet-400" />}
                      label={translate(catalog, 'tool.tramStation')}
                      cost={BUILD_COSTS[TileType.TRAM_STATION]}
                      desc="Stasiun utama jalur rel trem"
                      active={activeTool === TileType.TRAM_STATION}
                      disabled={!unlockedUpgrades.includes('tram_system')}
                      lockReason={!unlockedUpgrades.includes('tram_system') ? 'Perlu riset Pohon Teknologi' : undefined}
                      isFavorite={favoriteTools.includes(TileType.TRAM_STATION)}
                      onToggleFavorite={() => toggleFavorite(TileType.TRAM_STATION)}
                      onClick={() => setActiveTool(TileType.TRAM_STATION)}
                    />
                    <DrawerToolCard
                      icon={<Bus size={18} className="text-cyan-300" />}
                      label={translate(catalog, 'tool.busStop')}
                      cost={BUILD_COSTS[TileType.BUS_STOP]}
                      desc="Halte penjemputan warga"
                      active={activeTool === TileType.BUS_STOP}
                      disabled={!unlockedUpgrades.includes('bus_network')}
                      lockReason={!unlockedUpgrades.includes('bus_network') ? 'Perlu riset Pohon Teknologi' : undefined}
                      isFavorite={favoriteTools.includes(TileType.BUS_STOP)}
                      onToggleFavorite={() => toggleFavorite(TileType.BUS_STOP)}
                      onClick={() => setActiveTool(TileType.BUS_STOP)}
                    />
                    <DrawerToolCard
                      icon={<TrainFront size={18} className="text-violet-300" />}
                      label={translate(catalog, 'tool.tramStop')}
                      cost={BUILD_COSTS[TileType.TRAM_STOP]}
                      desc="Pemberhentian penumpang trem"
                      active={activeTool === TileType.TRAM_STOP}
                      disabled={!unlockedUpgrades.includes('tram_system')}
                      lockReason={!unlockedUpgrades.includes('tram_system') ? 'Perlu riset Pohon Teknologi' : undefined}
                      isFavorite={favoriteTools.includes(TileType.TRAM_STOP)}
                      onToggleFavorite={() => toggleFavorite(TileType.TRAM_STOP)}
                      onClick={() => setActiveTool(TileType.TRAM_STOP)}
                    />
                    <DrawerToolCard
                      icon={<Route size={18} className="text-emerald-300" />}
                      label={translate(catalog, 'tool.linePlanner')}
                      desc="Tarik rute trayek antar perhentian"
                      active={activeTool === 'TRANSIT_LINE'}
                      disabled={!unlockedUpgrades.includes('bus_network') && !unlockedUpgrades.includes('tram_system')}
                      lockReason={!unlockedUpgrades.includes('bus_network') && !unlockedUpgrades.includes('tram_system') ? 'Perlu riset transit' : undefined}
                      isFavorite={favoriteTools.includes('TRANSIT_LINE')}
                      onToggleFavorite={() => toggleFavorite('TRANSIT_LINE')}
                      onClick={() => setActiveTool('TRANSIT_LINE')}
                    />
                  </>
                )}

                {selectedCategory === 'LOGISTICS' && (
                  <>
                    <DrawerToolCard
                      icon={<Warehouse size={18} className="text-orange-300" />}
                      label={translate(catalog, 'tool.warehouse')}
                      cost={BUILD_COSTS[TileType.WAREHOUSE]}
                      desc="Gudang buffer muatan kargo industri"
                      active={activeTool === TileType.WAREHOUSE}
                      isFavorite={favoriteTools.includes(TileType.WAREHOUSE)}
                      onToggleFavorite={() => toggleFavorite(TileType.WAREHOUSE)}
                      onClick={() => setActiveTool(TileType.WAREHOUSE)}
                    />
                    <DrawerToolCard
                      icon={<Warehouse size={18} className="text-cyan-300" />}
                      label={translate(catalog, 'tool.cargoTerminal')}
                      cost={BUILD_COSTS[TileType.CARGO_TERMINAL]}
                      desc="Terminal bongkar muat kargo regional"
                      active={activeTool === TileType.CARGO_TERMINAL}
                      isFavorite={favoriteTools.includes(TileType.CARGO_TERMINAL)}
                      onToggleFavorite={() => toggleFavorite(TileType.CARGO_TERMINAL)}
                      onClick={() => setActiveTool(TileType.CARGO_TERMINAL)}
                    />
                  </>
                )}

                {selectedCategory === 'TERRAIN' && (
                  <>
                    <DrawerToolCard
                      icon={<Mountain size={18} className="text-emerald-300" />}
                      label={translate(catalog, 'tool.raise')}
                      cost={TERRAFORM_COST}
                      desc="Tinggikan elevasi tanah"
                      active={activeTool === 'RAISE_TERRAIN'}
                      isFavorite={favoriteTools.includes('RAISE_TERRAIN')}
                      onToggleFavorite={() => toggleFavorite('RAISE_TERRAIN')}
                      onClick={() => setActiveTool('RAISE_TERRAIN')}
                    />
                    <DrawerToolCard
                      icon={<ArrowDown size={18} className="text-sky-300" />}
                      label={translate(catalog, 'tool.lower')}
                      cost={TERRAFORM_COST}
                      desc="Turunkan elevasi tanah"
                      active={activeTool === 'LOWER_TERRAIN'}
                      isFavorite={favoriteTools.includes('LOWER_TERRAIN')}
                      onToggleFavorite={() => toggleFavorite('LOWER_TERRAIN')}
                      onClick={() => setActiveTool('LOWER_TERRAIN')}
                    />
                    <DrawerToolCard
                      icon={<ArrowUp size={18} className="text-amber-300" />}
                      label={translate(catalog, 'tool.level')}
                      cost={TERRAFORM_COST}
                      desc="Ratakan tanah sesuai titik acuan"
                      active={activeTool === 'LEVEL_TERRAIN'}
                      isFavorite={favoriteTools.includes('LEVEL_TERRAIN')}
                      onToggleFavorite={() => toggleFavorite('LEVEL_TERRAIN')}
                      onClick={() => setActiveTool('LEVEL_TERRAIN')}
                    />
                    <DrawerToolCard
                      icon={<SlidersHorizontal size={18} className="text-cyan-300" />}
                      label={translate(catalog, 'tool.smooth')}
                      cost={TERRAFORM_COST}
                      desc="Haluskan tebing curam menjadi landai"
                      active={activeTool === 'SMOOTH_TERRAIN'}
                      isFavorite={favoriteTools.includes('SMOOTH_TERRAIN')}
                      onToggleFavorite={() => toggleFavorite('SMOOTH_TERRAIN')}
                      onClick={() => setActiveTool('SMOOTH_TERRAIN')}
                    />
                  </>
                )}
              </>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  );
}

interface RailButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  expanded?: boolean;
  onClick: () => void;
}

function RailButton({ icon, label, active, expanded, onClick }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-expanded={expanded}
      className={`min-w-[48px] min-h-[48px] w-12 rounded-xl flex flex-col items-center justify-center transition-all ${
        active
          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
          : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
      title={label}
    >
      <div>{icon}</div>
      <span className="text-[9px] font-medium tracking-tight mt-0.5 max-w-[48px] whitespace-normal leading-tight text-center">
        {label}
      </span>
    </button>
  );
}

interface DrawerToolCardProps {
  icon: React.ReactNode;
  label: string;
  cost?: number;
  desc?: string;
  active: boolean;
  disabled?: boolean;
  lockReason?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClick: () => void;
}

function DrawerToolCard({
  icon,
  label,
  cost,
  desc,
  active,
  disabled = false,
  lockReason,
  isFavorite = false,
  onToggleFavorite,
  onClick,
}: DrawerToolCardProps) {
  return (
    <div
      className={`w-full rounded-xl border p-2.5 transition-all text-left flex items-start justify-between gap-2 ${
        active
          ? 'bg-cyan-500/15 border-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
          : disabled
          ? 'bg-white/[0.02] border-white/5 opacity-40'
          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-white/20'
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-pressed={active}
        className="flex-1 flex items-start gap-2.5 min-w-0"
      >
        <div
          className={`p-2 rounded-lg shrink-0 ${
            active ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/5 text-slate-300'
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-white leading-snug" title={label}>{label}</span>
            {cost !== undefined && (
              <span className="font-mono text-xs font-bold text-amber-300 shrink-0">
                ${cost}
              </span>
            )}
          </div>
          {desc && (
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
              {desc}
            </p>
          )}
          {lockReason && (
            <span className="text-[10px] text-rose-300 font-medium block mt-1">
              🔒 {lockReason}
            </span>
          )}
        </div>
      </button>

      {onToggleFavorite && (
        <button
          type="button"
          aria-label={`${isFavorite ? 'Hapus' : 'Tambah'} favorit ${label}`}
          onClick={onToggleFavorite}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-white/10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)] ${
            isFavorite ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  );
}
