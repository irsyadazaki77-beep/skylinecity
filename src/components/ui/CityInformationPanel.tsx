import React, { useEffect, useState, useRef } from 'react';
import { 
  X, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Shield, 
  Activity, 
  Car, 
  Leaf, 
  Zap,
  Droplet,
  Trash2,
  GraduationCap,
  HeartPulse,
  MapPinned,
  Route,
} from 'lucide-react';
import { CausalDiagnostic, CityDisaster, CityIncident, CityState, HistoryRecord, RegionState, RecoveryProject, ServiceVehicleAgent, TradeContract, TransitLine } from '../../types';
import { DemographicBreakdown } from '../../citizenSimulation/types';
import type { TransitLineInsight } from '../../transitInsights';
import type { TransitVehicleAgent } from '../../transit';
import type { ServiceDispatchInsight } from '../../serviceDispatchInsights';
import { deriveIncidentDispatchLifecycle, getReturningServiceVehicles } from '../../serviceDispatchLifecycle';
import { calculateTransitMapBounds, deriveTransitRouteGeometry, projectTransitMapPoint } from '../../transitRouteMap';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../../localization';
import { useModalFocus } from './useModalFocus';

interface CityInformationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  language?: SupportedLanguage;
  // Props from engine
  population: number;
  households: number;
  workers: number;
  employment: number;
  unemploymentRate: number;
  availableJobs: number;
  
  money: number;
  income: number;
  expenses: number;
  residentialTaxRate: number;
  commercialTaxRate: number;
  industrialTaxRate: number;
  onTaxChange: (type: 'residential' | 'commercial' | 'industrial', val: number) => void;
  
  powerDemand: number;
  powerCapacity: number;
  waterDemand: number;
  waterCapacity: number;
  wasteProduction: number;
  wasteCapacity: number;
  wasteCoverage: number;
  fireServiceCapacity?: number;
  policeServiceCapacity?: number;
  healthcareCapacity?: number;
  educationCapacity?: number;
  serviceResponseQuality?: number;
  incidents?: CityIncident[];
  serviceVehicles?: ServiceVehicleAgent[];
  activeIncidents?: number;
  incidentResponseLoad?: number;
  incidentsResolved?: number;
  incidentHappinessPenalty?: number;
  incidentDispatchedUnits?: number;
  incidentQueuedUnits?: number;
  serviceFleetTotal?: number;
  serviceFleetActive?: number;
  serviceFleetAvailable?: number;
  serviceFleetOnScene?: number;
  serviceFleetAverageCondition?: number;
  serviceFleetMaintenanceCost?: number;
  activeMaintenanceOrders?: number;
  serviceBayQueues?: Record<string, number>;
  parcelCount?: number;
  developedParcelCount?: number;
  privateParcelCount?: number;
  averageParcelSize?: number;
  mixedUseBlocks?: number;
  mixedUseFloorArea?: number;
  mixedUseJobs?: number;
  disasters?: CityDisaster[];
  activeDisasters?: number;
  disasterResponseLoad?: number;
  disastersResolved?: number;
  disasterHappinessPenalty?: number;
  disasterRecoveryRate?: number;
  
  trafficAverage: number;
  averageCommuteTime: number;
  congestionIndex: number;
  averageQueuePressure?: number;
  transitCapacity?: number;
  transitRidership?: number;
  transitCoverage?: number;
  transitBusDepots?: number;
  transitTramStations?: number;
  transitActiveLines?: number;
  transitActiveVehicles?: number;
  transitAverageWait?: number;
  transitTransferOpportunities?: number;
  transitPlatformCapacity?: number;
  transitAverageDwell?: number;
  transitFareRevenue?: number;
  transitOperatingCost?: number;
  timeOfDay?: number;
  season?: CityState['season'];
  weather?: CityState['weather'];
  temperature?: number;
  precipitation?: number;
  climateFireRisk?: number;
  floodedTiles?: number;
  averageWaterDepth?: number;
  peakWaterDepth?: number;
  flowingWaterTiles?: number;
  reservoirStorage?: number;
  floodBarrierCount?: number;
  parkingDemand?: number;
  parkingSupply?: number;
  parkingCoverage?: number;
  parkingPressure?: number;
  transitLines?: TransitLine[];
  transitVehicles?: TransitVehicleAgent[];
  transitLineInsights?: TransitLineInsight[];
  serviceDispatchInsights?: ServiceDispatchInsight[];
  onFocusTransitStop?: (location: { x: number; y: number }) => void;
  onRemoveTransitLine?: (lineId: string) => void;
  onToggleTransitLine?: (lineId: string) => void;
  onUpdateTransitLine?: (lineId: string, patch: Partial<TransitLine>) => void;
  
  happiness: number;
  crimeRate: number;
  fireSafety: number;
  healthcareCoverage: number;
  educationCoverage: number;
  educationLevel: number;
  healthIndex: number;
  
  landValueAverage: number;
  suitabilityAverage?: number;
  pollutionAverage: number;
  noiseAverage: number;
  desirability: number;
  
  residentialDemand: number;
  commercialDemand: number;
  officeDemand?: number;
  industrialDemand: number;
  consumerDemand?: number;
  retailSupply?: number;
  goodsDemand?: number;
  goodsSupply?: number;
  commercialUtilization?: number;
  officeUtilization?: number;
  industrialUtilization?: number;
  marketHealth?: number;
  freightDemand?: number;
  freightCapacity?: number;
  freightReliability?: number;
  industrialAccess?: number;
  commercialStock?: number;
  commodityDemand?: Record<string, number>;
  commoditySupply?: Record<string, number>;
  commodityStock?: Record<string, number>;
  productionInputDemand?: Record<string, number>;
  productionEfficiency?: number;
  cargoTerminals?: number;
  cargoThroughput?: number;
  connectedIndustries?: number;
  freightActiveTrips?: number;
  warehouses?: number;
  warehouseCapacity?: number;
  warehouseBuffer?: number;
  
  history: HistoryRecord[];
  demographics?: DemographicBreakdown;
  causalDiagnostics?: CausalDiagnostic[];
  regions?: Record<string, RegionState>;
  activeRegionKeys?: string[];
  recoveryProjects?: RecoveryProject[];
  tradeContracts?: TradeContract[];
  tradeImportCapacity?: number;
  tradeExportCapacity?: number;
  tradeExportRevenue?: number;
  municipalDebt?: number;
  activeScenarioId?: string;
  scenarioCompleted?: boolean;
  specialization?: CityState['specialization'];
}

type TabType = 'OVERVIEW' | 'POPULATION' | 'ECONOMY' | 'SERVICES' | 'TRAFFIC' | 'ENVIRONMENT';

function panelCopy(language: SupportedLanguage | undefined, id: string, en: string): string {
  return language === 'en' ? en : id;
}

function transitStatusLabel(status: string, language: SupportedLanguage | undefined): string {
  const labels: Record<string, [string, string]> = {
    READY: ['Siap', 'Ready'],
    CROWDED: ['Padat', 'Crowded'],
    LIMITED: ['Terbatas', 'Limited'],
    OUT_OF_HOURS: ['Di luar jam layanan', 'Out of hours'],
    OFFLINE: ['Nonaktif', 'Offline'],
  };
  const [id, en] = labels[status] ?? [status, status];
  return panelCopy(language, id, en);
}

export function CityInformationPanel(props: CityInformationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const catalog = createLocalizationCatalog(props.language ?? 'id');
  const dialogRef = useModalFocus<HTMLDivElement>(props.isOpen);

  useEffect(() => {
    if (!props.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        props.onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.isOpen, props.onClose]);

  if (!props.isOpen) return null;

  const renderTabButton = (tab: TabType, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === tab}
      onClick={() => setActiveTab(tab)}
      className={`min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
        activeTab === tab
          ? 'bg-[var(--accent-cyan)] text-slate-950 font-bold shadow-md'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div 
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="city-info-title"
      className="city-information-panel fixed sm:absolute top-16 left-3 right-3 sm:right-auto sm:left-4 bottom-20 w-auto sm:w-96 max-w-full bg-[#0d1420]/95 backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col pointer-events-auto z-40 overflow-hidden animate-in slide-in-from-left-4 duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 shrink-0">
        <div>
          <h2 id="city-info-title" className="text-white font-bold text-lg tracking-tight">{translate(catalog, 'info.title')}</h2>
          <div className="text-xs text-slate-400">{translate(catalog, 'info.subtitle')}</div>
        </div>
        <button 
          type="button" 
          aria-label="Tutup informasi kota" 
          onClick={props.onClose} 
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-white/10 bg-black/20 shrink-0" role="tablist">
        {renderTabButton('OVERVIEW', <TrendingUp size={15} aria-hidden="true" />, translate(catalog, 'info.overview'))}
        {renderTabButton('POPULATION', <Users size={15} aria-hidden="true" />, translate(catalog, 'info.citizens'))}
        {renderTabButton('ECONOMY', <DollarSign size={15} aria-hidden="true" />, translate(catalog, 'info.economy'))}
        {renderTabButton('SERVICES', <Shield size={15} aria-hidden="true" />, translate(catalog, 'info.services'))}
        {renderTabButton('TRAFFIC', <Car size={15} aria-hidden="true" />, translate(catalog, 'info.traffic'))}
        {renderTabButton('ENVIRONMENT', <Leaf size={15} aria-hidden="true" />, translate(catalog, 'info.environment'))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar" role="tabpanel">
        {activeTab === 'OVERVIEW' && <OverviewTab {...props} />}
        {activeTab === 'POPULATION' && <PopulationTab {...props} />}
        {activeTab === 'ECONOMY' && <EconomyTab {...props} />}
        {activeTab === 'SERVICES' && <ServicesTab {...props} />}
        {activeTab === 'TRAFFIC' && <TrafficTab {...props} />}
        {activeTab === 'ENVIRONMENT' && <EnvironmentTab {...props} />}
      </div>
    </div>
  );
}

// --- Tab Components ---

function OverviewTab(props: CityInformationPanelProps) {
  const demo = props.demographics;
  const catalog = createLocalizationCatalog(props.language ?? 'id');
  return (
    <div className="space-y-5">
      <Section title="Permintaan Zonasi">
        <DemandBar label="Hunian" value={props.residentialDemand} color="bg-emerald-500" />
        <DemandBar label="Komersial" value={props.commercialDemand} color="bg-[var(--accent-cyan)]" />
        <DemandBar label="Industri" value={props.industrialDemand} color="bg-amber-400" />
      </Section>
      <Section title="Tren Permintaan & Perkembangan Kota">
        <HistoryChart
          history={props.history}
          min={-100}
          max={100}
          series={[
            { key: 'residentialDemand', label: 'Hunian', color: '#34d399' },
            { key: 'commercialDemand', label: 'Komersial', color: '#38bdf8' },
            { key: 'officeDemand', label: 'Perkantoran', color: '#c084fc' },
            { key: 'industrialDemand', label: 'Industri', color: '#facc15' },
          ]}
        />
        <HistoryChart
          history={props.history}
          min={0}
          max={100}
          series={[
            { key: 'happiness', label: 'Kebahagiaan', color: '#facc15' },
            { key: 'congestionIndex', label: translate(catalog, 'traffic.congestionIndex'), color: '#fb7185' },
          ]}
        />
        <MetricRow label="Diselesaikan Hari Ini" value={`${props.disastersResolved ?? 0}`} color="text-emerald-300" />
        <MetricRow label="Penalti Kebahagiaan" value={`-${(props.disasterHappinessPenalty ?? 0).toFixed(1)}`} color="text-rose-300" />
        {(props.disasters?.length ?? 0) > 0 && (
          <div className="mt-2 space-y-1.5">
            {props.disasters?.slice(0, 4).map((disaster) => (
              <div key={disaster.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
                <span className="text-slate-300">{disaster.type} · ({disaster.centerX + 1}, {disaster.centerY + 1})</span>
                <span className="font-mono text-orange-300">S{disaster.severity} · {disaster.remainingDays.toFixed(1)}d</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      
      <Section title="Metrik Utama">
        <MetricRow label="Musim / Cuaca" value={`${props.season ?? 'SPRING'} · ${props.weather ?? 'CLEAR'}`} color="text-sky-300" />
        <MetricRow label="Suhu" value={`${(props.temperature ?? 28).toFixed(1)}°C`} color="text-orange-300" />
        <MetricRow label="Presipitasi" value={`${(props.precipitation ?? 1).toFixed(2)}×`} color="text-cyan-300" />
        <MetricRow label="Populasi" value={props.population.toLocaleString()} />
        <MetricRow label="Rumah Tangga" value={props.households.toLocaleString()} />
        <MetricRow label="Kebahagiaan" value={`${props.happiness}%`} />
        <MetricRow label="Kepuasan Rumah Tangga" value={`${demo?.householdStats.averageSatisfaction ?? props.happiness}%`} color="text-cyan-400" />
        <MetricRow label="Kas Kota" value={`$${props.money.toLocaleString()}`} />
        <MetricRow label="Kesesuaian Tata Ruang" value={`${props.suitabilityAverage ?? 0}%`} color="text-cyan-300" />
        <MetricRow label="Persil Terdaftar" value={`${props.parcelCount ?? 0}`} color="text-violet-300" />
        <MetricRow label="Kavling Terbangun / Privat" value={`${props.developedParcelCount ?? 0} / ${props.privateParcelCount ?? 0}`} color="text-emerald-300" />
        <MetricRow label="Ukuran Rata-rata Kavling" value={`${(props.averageParcelSize ?? 0).toFixed(2)} petak`} color="text-amber-300" />
        <MetricRow label={panelCopy(props.language, 'Blok Campuran', 'Mixed-use Blocks')} value={`${props.mixedUseBlocks ?? 0}`} color="text-fuchsia-300" />
        <MetricRow label={panelCopy(props.language, 'Lantai Campuran', 'Mixed-use Floors')} value={`${props.mixedUseFloorArea ?? 0}`} color="text-violet-300" />
        <MetricRow label={panelCopy(props.language, 'Pekerjaan Campuran', 'Mixed-use Jobs')} value={`${props.mixedUseJobs ?? 0}`} color="text-sky-300" />
        <MetricRow label="Pendapatan Bersih" value={`$${(props.income - props.expenses).toLocaleString()}`} color={(props.income - props.expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <MetricRow label="Utang Kota" value={`$${(props.municipalDebt ?? 0).toLocaleString()}`} color={(props.municipalDebt ?? 0) > 0 ? 'text-rose-300' : 'text-emerald-300'} />
        <MetricRow label="Wilayah Aktif / Latar Belakang" value={`${props.activeRegionKeys?.length ?? 0} / ${Object.values(props.regions ?? {}).filter((region) => !region.active).length}`} color="text-cyan-300" />
        <MetricRow label="Proyek Pemulihan" value={`${props.recoveryProjects?.filter((project) => project.active).length ?? 0}`} color="text-orange-300" />
        <MetricRow label="Kontrak Perdagangan" value={`${props.tradeContracts?.filter((contract) => contract.active).length ?? 0}`} color="text-violet-300" />
        <MetricRow label="Kapasitas Impor" value={`${Math.round(props.tradeImportCapacity ?? 0)}`} color="text-cyan-300" />
        <MetricRow label="Kapasitas Ekspor" value={`${Math.round(props.tradeExportCapacity ?? 0)}`} color="text-emerald-300" />
        <MetricRow label="Pendapatan Ekspor" value={`$${Math.round(props.tradeExportRevenue ?? 0)}`} color="text-amber-300" />
        {props.activeScenarioId && <MetricRow label="Skenario" value={`${props.activeScenarioId}${props.scenarioCompleted ? ' · Selesai' : ''}`} color={props.scenarioCompleted ? 'text-emerald-300' : 'text-cyan-300'} />}
        <MetricRow label="Spesialisasi Kota" value={(props.specialization ?? 'SEIMBANG').replaceAll('_', ' ')} color="text-fuchsia-300" />
      </Section>

      {(props.causalDiagnostics?.length ?? 0) > 0 && (
        <Section title="Diagnosis Masalah Kota">
          <div className="space-y-2">
            {props.causalDiagnostics?.slice(0, 5).map((diagnostic) => (
              <div key={diagnostic.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-semibold ${diagnostic.severity === 'CRITICAL' ? 'text-rose-300' : diagnostic.severity === 'WARNING' ? 'text-amber-300' : 'text-cyan-300'}`}>{diagnostic.title}</span>
                  <span className="text-[9px] font-mono uppercase text-slate-500">{diagnostic.category}</span>
                </div>
                <div className="mt-1 text-[10px] leading-relaxed text-slate-400">{diagnostic.explanation}</div>
                {diagnostic.location && <div className="mt-1 text-[9px] font-mono text-slate-500">Lokasi: Petak (${diagnostic.location.x + 1}, ${diagnostic.location.y + 1})</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {demo && (
        <Section title="Ringkasan Demografi">
          <MetricRow label="Tenaga Kerja Bekerja" value={`${demo.workforce.employed.toLocaleString()} / ${demo.workforce.employable.toLocaleString()}`} />
          <MetricRow label="Tingkat Pengangguran" value={`${demo.workforce.unemploymentRate.toFixed(1)}%`} color={demo.workforce.unemploymentRate > 10 ? 'text-rose-400' : 'text-emerald-400'} />
          <MetricRow label="Gaji Rata-rata Harian" value={`$${demo.workforce.averageSalary}${panelCopy(props.language, '/hari', '/day')}`} color="text-amber-300" />
        </Section>
      )}
    </div>
  );
}

function PopulationTab(props: CityInformationPanelProps) {
  const demo = props.demographics;
  return (
    <div className="space-y-5">
      <Section title="Demografi & Angkatan Kerja">
        <MetricRow label="Total Warga" value={props.population.toLocaleString()} />
        <MetricRow label="Total Rumah Tangga" value={props.households.toLocaleString()} />
        <MetricRow label="Usia Kerja Produktif" value={props.workers.toLocaleString()} />
        <MetricRow label="Warga Bekerja" value={`${demo?.workforce.employed ?? Math.min(props.workers, props.availableJobs)}`} color="text-emerald-400" />
        <MetricRow label={panelCopy(props.language, 'Tingkat Pengangguran', 'Unemployment Rate')} value={`${props.unemploymentRate.toFixed(1)}%`} color={props.unemploymentRate > 10 ? 'text-rose-400' : 'text-emerald-400'} />
        <MetricRow label="Gaji Rata-rata Harian" value={`$${demo?.workforce.averageSalary ?? 35}${panelCopy(props.language, '/hari', '/day')}`} color="text-amber-300" />
      </Section>

      {demo && (
        <>
          <Section title="Distribusi Pendidikan">
            <MetricRow label="Tanpa Ijazah / Dasar" value={`${demo.educationDistribution.uneducated} (${props.population ? Math.round((demo.educationDistribution.uneducated / props.population) * 100) : 0}%)`} />
            <MetricRow label="Lulusan SMA" value={`${demo.educationDistribution.highSchool} (${props.population ? Math.round((demo.educationDistribution.highSchool / props.population) * 100) : 0}%)`} color="text-blue-300" />
            <MetricRow label="Perguruan Tinggi" value={`${demo.educationDistribution.university} (${props.population ? Math.round((demo.educationDistribution.university / props.population) * 100) : 0}%)`} color="text-emerald-300" />
          </Section>

          <Section title="Distribusi Usia">
            <MetricRow label="Anak-anak (0-17)" value={`${demo.ageDistribution.children}`} />
            <MetricRow label="Mahasiswa (18-24)" value={`${demo.ageDistribution.students}`} />
            <MetricRow label="Dewasa (Usia Kerja)" value={`${demo.ageDistribution.adults}`} />
            <MetricRow label="Lansia (65+)" value={`${demo.ageDistribution.seniors}`} />
          </Section>

          <Section title="Finansial & Kepuasan Rumah Tangga">
            <MetricRow label="Indeks Kepuasan" value={`${demo.householdStats.averageSatisfaction}%`} color="text-cyan-300" />
            <MetricRow label="Rata-rata Sewa Harian" value={`$${demo.householdStats.averageRent}${panelCopy(props.language, '/hari', '/day')}`} />
            <MetricRow label="Tabungan Rata-rata" value={`$${demo.householdStats.averageSavings}`} color="text-emerald-400" />
          </Section>

          <Section title="Aktivitas Migrasi">
            <MetricRow label="Imigran Harian" value={`+${demo.migration.immigrants}`} color="text-emerald-400" />
            <MetricRow label="Emigran Harian" value={`-${demo.migration.emigrants}`} color="text-rose-400" />
            <MetricRow label="Relokasi Internal" value={`${demo.migration.relocations}`} />
            <MetricRow label="Migrasi Bersih" value={`${demo.migration.netMigration >= 0 ? '+' : ''}${demo.migration.netMigration}`} color={demo.migration.netMigration >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          </Section>
        </>
      )}
    </div>
  );
}

function EconomyTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-6">
      <Section title="Anggaran">
        <MetricRow label="Pendapatan" value={`$${props.income.toLocaleString()}`} color="text-emerald-400" />
        <MetricRow label="Pengeluaran" value={`$${props.expenses.toLocaleString()}`} color="text-red-400" />
        <div className="h-[1px] bg-white/10 my-2"></div>
        <MetricRow label="Laba Bersih" value={`$${(props.income - props.expenses).toLocaleString()}`} color={(props.income - props.expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <MetricRow label={panelCopy(props.language, 'Utang Daerah', 'Municipal Debt')} value={`$${(props.municipalDebt ?? 0).toLocaleString()}`} color={(props.municipalDebt ?? 0) > 0 ? 'text-rose-300' : 'text-emerald-300'} />
      </Section>

      <Section title="Perpajakan">
        <TaxSlider label="Pajak Pemukiman" value={props.residentialTaxRate} onChange={(v) => props.onTaxChange('residential', v)} color="emerald" />
        <TaxSlider label="Pajak Komersial" value={props.commercialTaxRate} onChange={(v) => props.onTaxChange('commercial', v)} color="blue" />
        <TaxSlider label="Pajak Industri" value={props.industrialTaxRate} onChange={(v) => props.onTaxChange('industrial', v)} color="yellow" />
      </Section>
      <Section title="Pasar Antar-Sektor">
        <MetricRow label="Kesehatan Pasar" value={`${props.marketHealth ?? 0}%`} color={(props.marketHealth ?? 0) >= 70 ? 'text-emerald-400' : 'text-amber-300'} />
        <MetricRow label="Permintaan Konsumen" value={`${(props.consumerDemand ?? 0).toLocaleString()}`} />
        <MetricRow label="Pasokan Ritel" value={`${(props.retailSupply ?? 0).toLocaleString()}`} color="text-blue-300" />
        <MetricRow label="Permintaan Barang" value={`${(props.goodsDemand ?? 0).toLocaleString()}`} />
        <MetricRow label="Pasokan Barang" value={`${(props.goodsSupply ?? 0).toLocaleString()}`} color="text-yellow-300" />
        <MetricRow label="Utilisasi Komersial" value={`${Math.round((props.commercialUtilization ?? 0) * 100)}%`} />
        <MetricRow label="Permintaan Perkantoran" value={`${props.officeDemand ?? 0}`} color="text-violet-300" />
        <MetricRow label="Utilisasi Perkantoran" value={`${Math.round((props.officeUtilization ?? 0) * 100)}%`} color="text-violet-300" />
        <MetricRow label="Utilisasi Industri" value={`${Math.round((props.industrialUtilization ?? 0) * 100)}%`} />
      </Section>
      <Section title="Kargo & Logistik">
        <MetricRow label="Keandalan Kargo" value={`${props.freightReliability ?? 0}%`} color={(props.freightReliability ?? 0) >= 70 ? 'text-emerald-400' : 'text-rose-400'} />
        <MetricRow label="Permintaan Kargo" value={`${(props.freightDemand ?? 0).toLocaleString()}`} />
        <MetricRow label="Kapasitas Kargo" value={`${(props.freightCapacity ?? 0).toLocaleString()}`} color="text-cyan-300" />
        <MetricRow label="Akses Jalan Tol Industri" value={`${props.industrialAccess ?? 0}%`} />
        <MetricRow label="Efisiensi Produksi" value={`${Math.round((props.productionEfficiency ?? 1) * 100)}%`} color={(props.productionEfficiency ?? 1) >= 0.8 ? 'text-emerald-300' : 'text-amber-300'} />
        <MetricRow label="Beban Input Produksi" value={`${Object.values(props.productionInputDemand ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0).toLocaleString()}`} color="text-amber-300" />
        <MetricRow label="Terminal Kargo" value={`${props.cargoTerminals ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Throughput Kargo" value={`${props.cargoThroughput ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Stok Komersial" value={`${props.commercialStock ?? 0}%`} color="text-blue-300" />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {['FOOD', 'GOODS', 'MATERIALS', 'FUEL'].map((commodity) => (
            <div key={commodity} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px]">
              <div className="text-slate-400">{commodity}</div>
              <div className="font-mono text-cyan-200">{props.commodityStock?.[commodity] ?? 0}% {panelCopy(props.language, 'stok', 'stock')}</div>
              <div className="text-slate-500">{props.commoditySupply?.[commodity] ?? 0}/{props.commodityDemand?.[commodity] ?? 0}</div>
            </div>
          ))}
        </div>
        <MetricRow label="Industri Terhubung" value={`${props.connectedIndustries ?? 0}`} />
        <MetricRow label="Pengiriman Kargo Aktif" value={`${props.freightActiveTrips ?? 0}`} color="text-orange-300" />
        <MetricRow label="Gudang" value={`${props.warehouses ?? 0}`} color="text-orange-300" />
        <MetricRow label="Kapasitas Gudang" value={`${props.warehouseCapacity ?? 0}`} />
        <MetricRow label="Buffer Gudang" value={`${props.warehouseBuffer ?? 0}%`} color={(props.warehouseBuffer ?? 0) >= 35 ? 'text-emerald-300' : 'text-amber-300'} />
      </Section>
    </div>
  );
}

function ServicesTab(props: CityInformationPanelProps) {
  const dispatchLifecycle = deriveIncidentDispatchLifecycle(props.incidents ?? [], props.serviceVehicles ?? [], props.serviceResponseQuality ?? 0);
  const returningVehicles = getReturningServiceVehicles(props.serviceVehicles ?? []);

  return (
    <div className="space-y-4">
      <Section title="Utilitas Publik">
        <ProgressBar label="Penggunaan Listrik" value={props.powerDemand} max={props.powerCapacity || 1} format={(v) => `${Math.round(v)} MW`} color={props.powerDemand > props.powerCapacity ? 'bg-red-500' : 'bg-yellow-500'} />
        <ProgressBar label="Penggunaan Air" value={props.waterDemand} max={props.waterCapacity || 1} format={(v) => `${Math.round(v)} kL`} color={props.waterDemand > props.waterCapacity ? 'bg-red-500' : 'bg-cyan-500'} />
        <ProgressBar label="Kapasitas Sampah" value={props.wasteProduction} max={props.wasteCapacity || 1} format={(v) => `${Math.round(v)} T`} color={props.wasteProduction > props.wasteCapacity ? 'bg-red-500' : 'bg-stone-500'} />
      </Section>
      <Section title="Layanan Kota">
        <MetricRow label="Cakupan Kesehatan" value={`${props.healthcareCoverage}%`} />
        <MetricRow label="Kapasitas Kesehatan" value={`${props.healthcareCapacity ?? 0}`} color="text-teal-300" />
        <MetricRow label="Cakupan Pendidikan" value={`${props.educationCoverage}%`} />
        <MetricRow label="Kapasitas Pendidikan" value={`${props.educationCapacity ?? 0}`} color="text-amber-300" />
        <MetricRow label="Keamanan Kebakaran" value={`${props.fireSafety}%`} />
        <MetricRow label="Kapasitas Pemadam" value={`${props.fireServiceCapacity ?? 0}`} color="text-red-300" />
        <MetricRow label="Tingkat Kriminalitas" value={`${props.crimeRate}%`} color={props.crimeRate > 30 ? 'text-red-400' : 'text-gray-300'} />
        <MetricRow label="Kapasitas Polisi" value={`${props.policeServiceCapacity ?? 0}`} color="text-blue-300" />
        <MetricRow label="Kualitas Respons Layanan" value={`${props.serviceResponseQuality ?? 0}%`} color={(props.serviceResponseQuality ?? 0) >= 75 ? 'text-emerald-400' : (props.serviceResponseQuality ?? 0) > 0 ? 'text-amber-300' : 'text-slate-400'} />
      </Section>
      <Section title="Pengiriman Armada Darurat">
        <MetricRow label="Insiden Aktif" value={`${props.activeIncidents ?? 0}`} color={(props.activeIncidents ?? 0) > 0 ? 'text-rose-300' : 'text-emerald-300'} />
        <MetricRow label="Beban Respons" value={`${(props.incidentResponseLoad ?? 0).toFixed(1)}`} color="text-amber-300" />
        <MetricRow label="Unit Dikerahkan" value={`${props.incidentDispatchedUnits ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Unit Menunggu Antrean" value={`${props.incidentQueuedUnits ?? 0}`} color={(props.incidentQueuedUnits ?? 0) > 0 ? 'text-rose-300' : 'text-emerald-300'} />
        <MetricRow label="Diselesaikan Tik Ini" value={`${props.incidentsResolved ?? 0}`} color="text-emerald-300" />
        <MetricRow label="Penalti Kebahagiaan" value={`-${(props.incidentHappinessPenalty ?? 0).toFixed(1)}`} color="text-rose-300" />
        {(props.incidents?.length ?? 0) > 0 && (
          <div className="mt-2 space-y-1.5">
            {props.incidents?.slice(0, 5).map((incident) => (
              <div key={incident.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
                <span className="text-slate-300">{incident.type} · ({incident.x + 1},{incident.y + 1})</span>
                <span className="font-mono text-amber-300">S{incident.severity} · {incident.dispatchedUnits ?? 0}/{incident.requiredUnits ?? incident.severity}u · {incident.remainingDays.toFixed(1)}d</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title={panelCopy(props.language, 'Siklus Respons Insiden', 'Incident Dispatch Lifecycle')}>
        {dispatchLifecycle.length === 0 && returningVehicles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-slate-400">
            {panelCopy(props.language, 'Tidak ada unit aktif. Respons baru akan tampil sebagai antrean, perjalanan, atau di lokasi.', 'No active units. New dispatches will appear as queued, en route, or on scene.')}
          </div>
        ) : (
          <div className="space-y-2">
            {dispatchLifecycle.slice(0, 5).map((lifecycle) => {
              const stageMeta = lifecycle.stage === 'ON_SCENE'
                ? { label: panelCopy(props.language, 'DI LOKASI', 'ON SCENE'), className: 'text-amber-300' }
                : lifecycle.stage === 'DISPATCHING'
                  ? { label: panelCopy(props.language, 'MENUJU LOKASI', 'DISPATCHING'), className: 'text-cyan-300' }
                  : { label: panelCopy(props.language, 'DALAM ANTREAN', 'QUEUED'), className: 'text-rose-300' };
              return (
                <div key={lifecycle.incidentId} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200">{lifecycle.type} · S{lifecycle.severity}</span>
                    <span className={`font-mono font-bold ${stageMeta.className}`}>{stageMeta.label}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500">
                    <span>Lokasi Petak {lifecycle.location.x + 1},{lifecycle.location.y + 1}</span>
                    <span>Unit {lifecycle.dispatchedUnits}/{lifecycle.requiredUnits}</span>
                    <span>Rute {lifecycle.routeTiles} petak</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40">
                    <div className="h-full rounded-full bg-cyan-400 transition-[width]" style={{ width: `${lifecycle.responseProgress}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-slate-500">
                    <span>{panelCopy(props.language, 'Respons', 'Response')} {Math.round(lifecycle.responseProgress)}% · {lifecycle.dispatchingUnits} {panelCopy(props.language, 'menuju lokasi', 'en route')} · {lifecycle.onSceneUnits} {panelCopy(props.language, 'di lokasi', 'on scene')}</span>
                    <span className="font-mono text-slate-300">{lifecycle.stage === 'ON_SCENE' ? panelCopy(props.language, 'menstabilkan', 'stabilizing') : `${panelCopy(props.language, 'ETA', 'ETA')} ${lifecycle.etaMinutes.toFixed(1)}${panelCopy(props.language, ' mnt', 'm')}`}</span>
                  </div>
                </div>
              );
            })}
            {returningVehicles.length > 0 && (
              <div className="rounded-lg border border-violet-300/20 bg-violet-400/[0.06] px-2.5 py-2 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-violet-100">{panelCopy(props.language, 'KEMBALI KE DEPO', 'RETURNING TO DEPOT')}</span>
                  <span className="font-mono text-violet-200">{returningVehicles.length} unit</span>
                </div>
                <div className="mt-1 text-slate-400">Unit tetap terlihat satu leg setelah insiden selesai agar siklus dispatch dapat diaudit.</div>
                <div className="mt-1 font-mono text-violet-200">
                  {returningVehicles.slice(0, 3).map((vehicle) => `${vehicle.role} ${(Math.max(0, Math.min(1, 2 - vehicle.routeProgress)) * 100).toFixed(0)}% ${panelCopy(props.language, 'tersisa', 'remaining')}`).join(' · ')}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>
      <Section title={panelCopy(props.language, 'Rentang Respons Berdasarkan Agensi', 'Dispatch Range by Agency')}>
        <div className="space-y-2">
          {(props.serviceDispatchInsights ?? []).map((insight) => (
            <DispatchInsightCard key={insight.agency} insight={insight} language={props.language} />
          ))}
        </div>
      </Section>
      <Section title="Armada Layanan">
        <MetricRow label="Total Unit Armada" value={`${props.serviceFleetTotal ?? 0}`} color="text-slate-200" />
        <MetricRow label="Unit Tersedia" value={`${props.serviceFleetAvailable ?? 0}`} color={(props.serviceFleetAvailable ?? 0) > 0 ? 'text-emerald-300' : 'text-rose-300'} />
        <MetricRow label="Pengiriman Aktif" value={`${props.serviceFleetActive ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Unit di Lokasi" value={`${props.serviceFleetOnScene ?? 0}`} color="text-amber-300" />
        <MetricRow label="Kondisi Armada" value={`${(props.serviceFleetAverageCondition ?? 100).toFixed(1)}%`} color={(props.serviceFleetAverageCondition ?? 100) >= 70 ? 'text-emerald-300' : 'text-rose-300'} />
        <MetricRow label="Biaya Perawatan Depot / Hari" value={`$${(props.serviceFleetMaintenanceCost ?? 0).toFixed(1)}`} color="text-orange-300" />
        <MetricRow label="Perintah Kerja Pemeliharaan" value={`${props.activeMaintenanceOrders ?? 0}`} color={(props.activeMaintenanceOrders ?? 0) > 0 ? 'text-orange-300' : 'text-slate-300'} />
        <MetricRow label="Antrean Teluk Stasiun" value={`${Object.values(props.serviceBayQueues ?? {}).reduce((sum, value) => sum + value, 0)}`} color="text-rose-300" />
      </Section>
    </div>
  );
}

function TrafficTab(props: CityInformationPanelProps) {
  const demo = props.demographics;
  const catalog = createLocalizationCatalog(props.language ?? 'id');
  return (
    <div className="space-y-4">
      <Section title="Arus Lalu Lintas & Komuter">
        <MetricRow label="Kelancaran Lalu Lintas Rata-Rata" value={`${Math.max(0, 100 - props.trafficAverage).toFixed(1)}%`} />
        <MetricRow label={translate(catalog, 'traffic.congestionIndex')} value={`${props.congestionIndex.toFixed(1)}%`} color={props.congestionIndex > 50 ? "text-rose-400" : props.congestionIndex > 25 ? "text-amber-300" : "text-emerald-400"} />
        <MetricRow label="Tekanan Antrean Rata-Rata" value={`${(props.averageQueuePressure ?? 0).toFixed(1)}%`} color={(props.averageQueuePressure ?? 0) > 25 ? 'text-rose-300' : 'text-amber-300'} />
        <MetricRow label="Waktu Komuter Rata-Rata" value={`${props.averageCommuteTime.toFixed(1)} mnt`} />
      </Section>

      <Section title="Ruang Parkir & Tepi Jalan">
        <MetricRow label="Kebutuhan Parkir" value={`${(props.parkingDemand ?? 0).toFixed(1)} ruang`} />
        <MetricRow label="Kapasitas Parkir" value={`${(props.parkingSupply ?? 0).toLocaleString()} ${panelCopy(props.language, 'ruang', 'spaces')}`} color="text-slate-300" />
        <MetricRow label="Cakupan Sekitar" value={`${Math.round(props.parkingCoverage ?? 0)}%`} color="text-cyan-300" />
        <MetricRow label="Tekanan Parkir" value={`${(props.parkingPressure ?? 0).toFixed(2)}×`} color={(props.parkingPressure ?? 0) > 1 ? 'text-rose-300' : 'text-emerald-300'} />
      </Section>

      <Section title="Jaringan Transit Publik">
        <MetricRow label="Waktu Kota" value={`${String(Math.floor(props.timeOfDay ?? 6)).padStart(2, '0')}:00`} color="text-cyan-300" />
        <MetricRow label="Cakupan Layanan" value={`${Math.round(props.transitCoverage ?? 0)}%`} color="text-cyan-400" />
        <MetricRow label="Penumpang Harian" value={`${(props.transitRidership ?? 0).toLocaleString()}`} color="text-emerald-400" />
        <MetricRow label="Kapasitas" value={`${(props.transitCapacity ?? 0).toLocaleString()}`} />
        <MetricRow label="Depot Bus" value={`${props.transitBusDepots ?? 0}`} />
        <MetricRow label="Stasiun Trem" value={`${props.transitTramStations ?? 0}`} color="text-violet-300" />
        <MetricRow label="Jalur Aktif" value={`${props.transitActiveLines ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Armada Aktif" value={`${props.transitActiveVehicles ?? 0}`} color="text-amber-300" />
        <MetricRow label="Waktu Tunggu Rata-Rata" value={`${(props.transitAverageWait ?? 0).toFixed(1)} mnt`} />
        <MetricRow label="Titik Transfer" value={`${props.transitTransferOpportunities ?? 0}`} color="text-violet-300" />
        <MetricRow label="Kapasitas Peron" value={`${props.transitPlatformCapacity ?? 0}`} color="text-slate-300" />
        <MetricRow label="Waktu Singgah Rata-Rata" value={`${(props.transitAverageDwell ?? 0).toFixed(1)} mnt`} color="text-violet-300" />
        <MetricRow label="Pendapatan Tarif / Hari" value={`$${(props.transitFareRevenue ?? 0).toLocaleString()}`} color="text-emerald-300" />
        <MetricRow label="Biaya Operasional / Hari" value={`$${(props.transitOperatingCost ?? 0).toLocaleString()}`} color="text-rose-300" />
      </Section>

      <Section title={panelCopy(props.language, 'Pengelola Jalur Transit', 'Transit Line Manager')}>
        {(props.transitLines?.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-slate-400">
            {panelCopy(props.language, 'Belum ada jalur terjadwal. Gunakan Transit → Perencana Rute untuk membuat rute.', 'No scheduled lines. Use Transit → Line Planner to create a route.')}
          </div>
        ) : (
          <div className="space-y-2">
            {props.transitLines?.map((line) => (
              <div key={line.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{line.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {line.mode} · {line.stops.length} {panelCopy(props.language, 'pemberhentian', 'stops')} · setiap {line.frequency} {panelCopy(props.language, 'menit', 'minutes')} · {panelCopy(props.language, 'jam puncak', 'peak')} {line.peakFrequency ?? Math.max(1, Math.round(line.frequency * 0.65))} {panelCopy(props.language, 'menit', 'minutes')} · {line.active ? panelCopy(props.language, 'Aktif', 'Active') : panelCopy(props.language, 'Nonaktif', 'Inactive')}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => props.onToggleTransitLine?.(line.id)}
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${line.active ? 'border-amber-400/20 text-amber-300 hover:bg-amber-400/10' : 'border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10'}`}
                    >
                      {line.active ? panelCopy(props.language, 'Jeda', 'Pause') : panelCopy(props.language, 'Aktifkan', 'Activate')}
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onRemoveTransitLine?.(line.id)}
                      className="rounded-md border border-rose-400/20 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-400/10"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {line.stops.map(([x, y]) => `(${x + 1}, ${y + 1})`).join(' → ')}
                </div>
                <TransitVehicleTelemetry line={line} vehicles={props.transitVehicles ?? []} language={props.language} />
                <TransitInsightStrip insight={props.transitLineInsights?.find((insight) => insight.lineId === line.id)} language={props.language} />
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                  <label className="text-slate-500">{panelCopy(props.language, 'Mulai', 'Start')}
                    <select value={line.serviceStartHour ?? 5} onChange={(event) => props.onUpdateTransitLine?.(line.id, { serviceStartHour: Number(event.target.value) })} className="mt-0.5 w-full rounded border border-white/10 bg-[#111827] px-1.5 py-1 text-slate-200">
                      {Array.from({ length: 18 }, (_, hour) => hour + 4).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
                    </select>
                  </label>
                  <label className="text-slate-500">{panelCopy(props.language, 'Selesai', 'End')}
                    <select value={line.serviceEndHour ?? 24} onChange={(event) => props.onUpdateTransitLine?.(line.id, { serviceEndHour: Number(event.target.value) })} className="mt-0.5 w-full rounded border border-white/10 bg-[#111827] px-1.5 py-1 text-slate-200">
                      {Array.from({ length: 19 }, (_, index) => index + 6).map((hour) => <option key={hour} value={hour}>{hour === 24 ? '24:00' : `${String(hour).padStart(2, '0')}:00`}</option>)}
                    </select>
                  </label>
                  <label className="text-slate-500">{panelCopy(props.language, 'Menit jam puncak', 'Peak minutes')}
                    <select value={line.peakFrequency ?? Math.max(1, Math.round(line.frequency * 0.65))} onChange={(event) => props.onUpdateTransitLine?.(line.id, { peakFrequency: Number(event.target.value) })} className="mt-0.5 w-full rounded border border-white/10 bg-[#111827] px-1.5 py-1 text-slate-200">
                      {[3, 4, 5, 6, 8, 10, 12].map((frequency) => <option key={frequency} value={frequency}>{frequency} min</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title={panelCopy(props.language, 'Peta Rute Transit', 'Transit Route Map')}>
        <TransitRouteMap
          lines={props.transitLines ?? []}
          vehicles={props.transitVehicles ?? []}
          insights={props.transitLineInsights ?? []}
          timeOfDay={props.timeOfDay ?? 6}
          onFocusStop={props.onFocusTransitStop}
          language={props.language}
        />
      </Section>

      {demo && demo.tripStats && (
        <Section title="Perjalanan Komuter Nyata & Pilihan Moda">
          <MetricRow label="Total Perjalanan Harian" value={`${demo.tripStats.totalTrips.toLocaleString()}`} />
          <MetricRow label="Komuter Mobil" value={`${demo.tripStats.carTrips} (${demo.tripStats.totalTrips ? Math.round((demo.tripStats.carTrips / demo.tripStats.totalTrips) * 100) : 0}%)`} color="text-amber-400" />
          <MetricRow label="Angkutan Umum" value={`${demo.tripStats.transitTrips} (${demo.tripStats.totalTrips ? Math.round((demo.tripStats.transitTrips / demo.tripStats.totalTrips) * 100) : 0}%)`} color="text-cyan-400" />
          <MetricRow label="Perjalanan Sepeda" value={`${demo.tripStats.bikeTrips} (${demo.tripStats.totalTrips ? Math.round((demo.tripStats.bikeTrips / demo.tripStats.totalTrips) * 100) : 0}%)`} color="text-emerald-400" />
          <MetricRow label="Pejalan Kaki / Jalan" value={`${demo.tripStats.walkTrips} (${demo.tripStats.totalTrips ? Math.round((demo.tripStats.walkTrips / demo.tripStats.totalTrips) * 100) : 0}%)`} color="text-slate-300" />
        </Section>
      )}
    </div>
  );
}

function EnvironmentTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-4">
      <MetricRow label="Nilai Tanah Rata-Rata" value={`$${props.landValueAverage.toFixed(0)} /m²`} color="text-emerald-400" />
      <MetricRow label="Daya Tarik Wilayah" value={`${props.desirability.toFixed(1)}%`} />
      <MetricRow label="Polusi Tanah" value={`${props.pollutionAverage.toFixed(1)}%`} color={props.pollutionAverage > 20 ? 'text-red-400' : 'text-gray-300'} />
      <MetricRow label="Polusi Suara" value={`${props.noiseAverage.toFixed(1)}%`} />
      <MetricRow label="Petak Tergenang" value={`${props.floodedTiles ?? 0}`} color={(props.floodedTiles ?? 0) > 0 ? 'text-blue-300' : 'text-emerald-300'} />
      <MetricRow label="Kedalaman Permukaan Rata-Rata" value={`${(props.averageWaterDepth ?? 0).toFixed(2)} m`} color="text-cyan-300" />
      <MetricRow label="Kedalaman Permukaan Puncak" value={`${(props.peakWaterDepth ?? 0).toFixed(2)} m`} color={(props.peakWaterDepth ?? 0) >= 0.75 ? 'text-blue-300' : 'text-cyan-300'} />
      <MetricRow label="Petak Air Mengalir" value={`${props.flowingWaterTiles ?? 0}`} color="text-sky-300" />
      <MetricRow label="Tanggul Banjir" value={`${props.floodBarrierCount ?? 0}`} color="text-sky-300" />
      <MetricRow label="Penyimpanan Waduk" value={`${(props.reservoirStorage ?? 0).toFixed(2)} m³`} color="text-blue-300" />
    </div>
  );
}

// --- Helper UI Components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MetricRow({ label, value, color = 'text-gray-100' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function DemandBar({ label, value, color }: { label: string; value: number; color: string }) {
  const width = Math.min(100, Math.max(0, value)) + '%';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width }}></div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, max, format, color }: { label: string; value: number; max: number; format: (v: number) => string; color: string }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{format(value)} / {format(max)}</span>
      </div>
      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

function TaxSlider({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'accent-emerald-500',
    blue: 'accent-blue-500',
    yellow: 'accent-yellow-500',
  };
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-300">{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <input 
        type="range" 
        min="1" max="20" 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`w-full ${colorMap[color] || 'accent-white'}`}
      />
    </div>
  );
}

interface HistorySeries {
  key: keyof HistoryRecord;
  label: string;
  color: string;
}

function HistoryChart({ history, series, min, max }: { history: HistoryRecord[]; series: HistorySeries[]; min: number; max: number }) {
  const samples = history.slice(-30);
  const range = Math.max(1, max - min);
  const pointString = (key: keyof HistoryRecord) => samples.map((record, index) => {
    const raw = record[key];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(min, Math.min(max, raw)) : min;
    const x = samples.length > 1 ? 4 + index / (samples.length - 1) * 292 : 150;
    const y = 66 - ((value - min) / range) * 58;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const latest = samples[samples.length - 1];

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
      {samples.length < 2 ? (
        <div className="flex h-16 items-center justify-center text-[10px] text-slate-500">Menunggu minimal dua tick untuk tren.</div>
      ) : (
        <svg viewBox="0 0 300 72" className="h-16 w-full" role="img" aria-label="Grafik tren kota">
          {min < 0 && <line x1="4" x2="296" y1={66 - ((0 - min) / range) * 58} y2={66 - ((0 - min) / range) * 58} stroke="rgba(255,255,255,0.16)" strokeDasharray="3 3" />}
          {series.map((item) => <polyline key={item.key} points={pointString(item.key)} fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />)}
        </svg>
      )}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-400">
        {series.map((item) => <span key={item.key} className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label} {typeof latest?.[item.key] === 'number' ? Math.round(latest[item.key] as number) : '—'}</span>)}
      </div>
    </div>
  );
}

function TransitInsightStrip({ insight, language }: { insight?: TransitLineInsight; language?: SupportedLanguage }) {
  if (!insight) return null;
  const statusClass = insight.status === 'READY' ? 'text-emerald-300' : insight.status === 'CROWDED' ? 'text-rose-300' : insight.status === 'LIMITED' ? 'text-amber-300' : 'text-slate-400';
  return (
    <div className="mt-2 rounded-md border border-cyan-400/15 bg-cyan-500/[0.05] p-2 text-[9px]">
      <div className="flex items-center justify-between gap-2"><span className={`font-semibold ${statusClass}`}>{transitStatusLabel(insight.status, language)}</span><span className="text-slate-400">{panelCopy(language, 'Cakupan', 'Catchment')} {insight.catchmentPopulation} · {panelCopy(language, 'transfer', 'transfer')} {insight.transferStops}</span></div>
      <div className="mt-1 grid grid-cols-4 gap-1 text-slate-400"><span>{panelCopy(language, 'Armada', 'Fleet')} <b className="font-mono text-slate-200">{insight.vehicles}</b></span><span>{panelCopy(language, 'Muatan', 'Load')} <b className="font-mono text-slate-200">{Math.round(insight.occupancyPercent)}%</b></span><span>{panelCopy(language, 'Tunggu', 'Wait')} <b className="font-mono text-slate-200">{insight.averageWaitMinutes.toFixed(1)}{panelCopy(language, ' mnt', 'm')}</b></span><span>{panelCopy(language, 'Bersih', 'Net')} <b className={`font-mono ${insight.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>${insight.balance}</b></span></div>
      <div className="mt-1 text-slate-500">{insight.recommendations[0]}</div>
    </div>
  );
}

const ROUTE_COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#fb7185', '#34d399', '#f97316'];

function TransitRouteMap({
  lines,
  vehicles,
  insights,
  timeOfDay,
  onFocusStop,
  language,
}: {
  lines: TransitLine[];
  vehicles: TransitVehicleAgent[];
  insights: TransitLineInsight[];
  timeOfDay: number;
  onFocusStop?: (location: { x: number; y: number }) => void;
  language?: SupportedLanguage;
}) {
  const routes = deriveTransitRouteGeometry(lines, vehicles, timeOfDay);
  if (routes.length === 0) {
    return <div className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-slate-500">{panelCopy(language, 'Belum ada rute. Buat minimal dua pemberhentian melalui Transit → Perencana Rute.', 'No routes yet. Create at least two stops through Transit → Line Planner.')}</div>;
  }
  const bounds = calculateTransitMapBounds(routes);

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2">
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1.5"><Route size={12} /> {panelCopy(language, 'Topologi rute skematis · klik pemberhentian untuk fokus peta', 'Schematic route topology · click a stop to focus the map')}</span><span className="shrink-0 text-cyan-300">{routes.filter((route) => route.usesVehiclePath).length}/{routes.length} {panelCopy(language, 'jalur jalan aktif', 'road paths live')}</span></div>
      <svg viewBox="0 0 300 140" className="h-32 w-full rounded-md bg-slate-950/70" role="img" aria-label="Peta rute transit">
        <defs>
          <pattern id="transit-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="300" height="140" fill="url(#transit-grid)" />
        {routes.map(({ line, path, operating }, lineIndex) => {
          const color = ROUTE_COLORS[lineIndex % ROUTE_COLORS.length];
          const routeOpacity = operating ? 0.95 : line.active ? 0.6 : 0.45;
          const points = path.map((point) => projectTransitMapPoint(point, bounds)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
          return (
            <g key={line.id}>
              <polyline points={points} fill="none" stroke="rgba(2,6,23,0.9)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={operating ? undefined : '4 4'} opacity={routeOpacity} />
              {line.stops.map((stop, stopIndex) => {
                const [cx, cy] = projectTransitMapPoint(stop, bounds);
                return <circle key={`${line.id}-${stopIndex}`} cx={cx} cy={cy} r="4.2" fill="#0f172a" stroke={color} strokeWidth="2" />;
              })}
              {vehicles.filter((vehicle) => vehicle.lineId === line.id && vehicle.routeProgress !== undefined).map((vehicle) => {
                const [vx, vy] = projectTransitMapPoint(sampleTransitPathPoint(path, vehicle.routeProgress ?? 0), bounds);
                return (
                  <circle key={vehicle.id} cx={vx} cy={vy} r="3" fill={color} stroke="#f8fafc" strokeWidth="1.2">
                    <title>{vehicle.id} · {panelCopy(language, 'pemberhentian', 'stop')} {(vehicle.nextStopIndex ?? 0) + 1} · ETA {vehicle.etaMinutes?.toFixed(1) ?? '—'}{panelCopy(language, ' mnt', 'm')}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="space-y-1.5">
        {routes.map(({ line, operating, usesVehiclePath }, lineIndex) => {
          const insight = insights.find((item) => item.lineId === line.id);
          const color = ROUTE_COLORS[lineIndex % ROUTE_COLORS.length];
          return (
            <div key={line.id} className="rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-slate-200"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />{line.name}</span>
                <span className="shrink-0 text-slate-500">{line.active ? (operating ? transitStatusLabel(insight?.status ?? 'READY', language) : panelCopy(language, 'Di luar jam layanan', 'Out of hours')) : transitStatusLabel('OFFLINE', language)}</span>
              </div>
              <div className="mt-0.5 text-[9px] text-slate-500">{usesVehiclePath ? panelCopy(language, 'JALUR JALAN AKTIF · telemetri kendaraan', 'ROAD PATH LIVE · vehicle telemetry') : panelCopy(language, 'RENCANA PEMBERHENTIAN · menunggu telemetri kendaraan', 'STOP PLAN · waiting for vehicle telemetry')}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {line.stops.map(([x, y], stopIndex) => (
                  <button key={`${line.id}-focus-${stopIndex}`} type="button" onClick={() => onFocusStop?.({ x, y })} className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-400 hover:border-cyan-300/40 hover:text-cyan-200" title={`Fokus pemberhentian (${x + 1}, ${y + 1})`}>
                    <MapPinned size={9} />{stopIndex + 1}: ({x + 1}, {y + 1})
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function sampleTransitPathPoint(path: [number, number][], progress: number): [number, number] {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return path[0];
  const safeProgress = Math.max(0, Math.min(0.9999, progress));
  const exactIndex = safeProgress * (path.length - 1);
  const segmentIndex = Math.min(path.length - 2, Math.floor(exactIndex));
  const segmentProgress = exactIndex - segmentIndex;
  const [x0, y0] = path[segmentIndex];
  const [x1, y1] = path[segmentIndex + 1];
  return [x0 + (x1 - x0) * segmentProgress, y0 + (y1 - y0) * segmentProgress];
}

const DISPATCH_BAND_META: Record<ServiceDispatchInsight['band'], { label: string; className: string }> = {
  CLEAR: { label: 'CLEAR', className: 'text-emerald-300' },
  FAST: { label: 'FAST', className: 'text-emerald-300' },
  NORMAL: { label: 'NORMAL', className: 'text-amber-300' },
  SLOW: { label: 'SLOW', className: 'text-orange-300' },
  CRITICAL: { label: 'CRITICAL', className: 'text-rose-300' },
};

function DispatchInsightCard({ insight, language }: { insight: ServiceDispatchInsight; language?: SupportedLanguage }) {
  const meta = DISPATCH_BAND_META[insight.band];
  const agencyLabel = ({
    FIRE: ['Pemadam & Penyelamatan', 'Fire & Rescue'],
    MEDICAL: ['Respons Medis', 'Medical Response'],
    POLICE: ['Respons Polisi', 'Police Response'],
    TRAFFIC: ['Pengendalian Lalu Lintas', 'Traffic Control'],
  } as Record<ServiceDispatchInsight['agency'], [string, string]>)[insight.agency] ?? [insight.label, insight.label];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-200">{panelCopy(language, agencyLabel[0], agencyLabel[1])}</span>
        <span className={`font-mono font-bold ${meta.className}`}>{panelCopy(language, ({ CLEAR: 'LANCAR', FAST: 'CEPAT', NORMAL: 'NORMAL', SLOW: 'LAMBAT', CRITICAL: 'KRITIS' } as Record<ServiceDispatchInsight['band'], string>)[insight.band], meta.label)}</span>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1 text-slate-500">
        <span>{panelCopy(language, 'Panggilan', 'Calls')} <b className="font-mono text-slate-200">{insight.activeIncidents}</b></span>
        <span>ETA <b className="font-mono text-slate-200">{insight.averageEtaMinutes.toFixed(1)}{panelCopy(language, ' mnt', 'm')}</b></span>
        <span>{panelCopy(language, 'Antrean', 'Queue')} <b className={`font-mono ${insight.queuedUnits + insight.bayQueue > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{insight.queuedUnits + insight.bayQueue}</b></span>
        <span>{panelCopy(language, 'Siap', 'Ready')} <b className="font-mono text-slate-200">{insight.availableUnits}</b></span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, Math.max(0, insight.dispatchCompletionPercent))}%` }} /></div>
      <div className="mt-1 text-slate-500">{panelCopy(language, 'Respons', 'Dispatch')} {Math.round(insight.dispatchCompletionPercent)}% · {panelCopy(language, 'rute', 'route')} {insight.averageRouteTiles.toFixed(1)} {panelCopy(language, 'petak', 'tiles')} · {insight.recommendations[0]}</div>
    </div>
  );
}

function TransitVehicleTelemetry({ line, vehicles, language }: { line: TransitLine; vehicles: TransitVehicleAgent[]; language?: SupportedLanguage }) {
  const lineVehicles = vehicles.filter((vehicle) => vehicle.lineId === line.id);
  if (lineVehicles.length === 0) {
    return <div className="mt-1 text-[9px] text-slate-600">{panelCopy(language, 'Belum ada telemetri kendaraan; jalur menunggu jam layanan atau koneksi jalan.', 'No vehicle telemetry; line is waiting for service hours or a road-path connection.')}</div>;
  }

  return (
    <div className="mt-1 rounded border border-cyan-300/10 bg-cyan-400/[0.04] px-1.5 py-1 text-[9px] text-cyan-100">
      <div className="font-semibold uppercase tracking-wide text-cyan-300">{panelCopy(language, 'Jadwal kendaraan langsung', 'Live vehicle schedule')}</div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-slate-400">
        {lineVehicles.slice(0, 4).map((vehicle, index) => (
          <span key={vehicle.id}>
            V{index + 1} → {panelCopy(language, 'pemberhentian', 'stop')} {(vehicle.nextStopIndex ?? 0) + 1} · {vehicle.etaMinutes?.toFixed(1) ?? '—'}{panelCopy(language, ' mnt', 'm')} · {vehicle.occupancy}/{vehicle.capacity}
          </span>
        ))}
      </div>
    </div>
  );
}
