import React, { useState } from 'react';
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

export function CityInformationPanel(props: CityInformationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const catalog = createLocalizationCatalog(props.language ?? 'id');

  if (!props.isOpen) return null;

  const renderTabButton = (tab: TabType, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        activeTab === tab
          ? 'bg-blue-500/20 text-blue-300 font-semibold'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="city-information-panel absolute top-16 left-4 bottom-24 w-88 bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl flex flex-col pointer-events-auto z-40 overflow-hidden animate-in slide-in-from-left-4 duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
        <div>
          <h2 className="text-white font-bold text-lg">{translate(catalog, 'info.title')}</h2>
          <div className="text-[11px] text-slate-400">{translate(catalog, 'info.subtitle')}</div>
        </div>
        <button type="button" aria-label="Tutup informasi kota" onClick={props.onClose} className="text-gray-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-white/10 bg-black/10">
        {renderTabButton('OVERVIEW', <TrendingUp size={16} />, translate(catalog, 'info.overview'))}
        {renderTabButton('POPULATION', <Users size={16} />, translate(catalog, 'info.citizens'))}
        {renderTabButton('ECONOMY', <DollarSign size={16} />, translate(catalog, 'info.economy'))}
        {renderTabButton('SERVICES', <Shield size={16} />, translate(catalog, 'info.services'))}
        {renderTabButton('TRAFFIC', <Car size={16} />, translate(catalog, 'info.traffic'))}
        {renderTabButton('ENVIRONMENT', <Leaf size={16} />, translate(catalog, 'info.environment'))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
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
  return (
    <div className="space-y-6">
      <Section title="City Demands">
        <DemandBar label="Residential" value={props.residentialDemand} color="bg-emerald-500" />
        <DemandBar label="Commercial" value={props.commercialDemand} color="bg-blue-500" />
        <DemandBar label="Industrial" value={props.industrialDemand} color="bg-yellow-500" />
      </Section>
      <Section title="Demand & City Trends">
        <HistoryChart
          history={props.history}
          min={-100}
          max={100}
          series={[
            { key: 'residentialDemand', label: 'Residential', color: '#34d399' },
            { key: 'commercialDemand', label: 'Commercial', color: '#60a5fa' },
            { key: 'officeDemand', label: 'Office', color: '#c084fc' },
            { key: 'industrialDemand', label: 'Industrial', color: '#facc15' },
          ]}
        />
        <HistoryChart
          history={props.history}
          min={0}
          max={100}
          series={[
            { key: 'happiness', label: 'Happiness', color: '#facc15' },
            { key: 'congestionIndex', label: 'Congestion', color: '#fb7185' },
            { key: 'serviceResponseQuality', label: 'Service response', color: '#38bdf8' },
          ]}
        />
      </Section>
      <Section title="Natural Disaster Response">
        <MetricRow label="Active Disasters" value={`${props.activeDisasters ?? 0}`} color={(props.activeDisasters ?? 0) > 0 ? 'text-orange-300' : 'text-emerald-300'} />
        <MetricRow label="Recovery Load" value={`${(props.disasterResponseLoad ?? 0).toFixed(1)}`} color="text-amber-300" />
        <MetricRow label="Road Recovery / Tick" value={`${(props.disasterRecoveryRate ?? 0).toFixed(1)}%`} color="text-cyan-300" />
        <MetricRow label="Resolved This Tick" value={`${props.disastersResolved ?? 0}`} color="text-emerald-300" />
        <MetricRow label="Happiness Penalty" value={`-${(props.disasterHappinessPenalty ?? 0).toFixed(1)}`} color="text-rose-300" />
        {(props.disasters?.length ?? 0) > 0 && (
          <div className="mt-2 space-y-1.5">
            {props.disasters?.slice(0, 4).map((disaster) => (
              <div key={disaster.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
                <span className="text-slate-300">{disaster.type} · ({disaster.centerX},{disaster.centerY})</span>
                <span className="font-mono text-orange-300">S{disaster.severity} · {disaster.remainingDays.toFixed(1)}d</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      
      <Section title="Key Metrics">
        <MetricRow label="Season / Weather" value={`${props.season ?? 'SPRING'} · ${props.weather ?? 'CLEAR'}`} color="text-sky-300" />
        <MetricRow label="Temperature" value={`${(props.temperature ?? 28).toFixed(1)}°C`} color="text-orange-300" />
        <MetricRow label="Precipitation" value={`${(props.precipitation ?? 1).toFixed(2)}×`} color="text-cyan-300" />
        <MetricRow label="Population" value={props.population.toLocaleString()} />
        <MetricRow label="Households" value={props.households.toLocaleString()} />
        <MetricRow label="Happiness" value={`${props.happiness}%`} />
        <MetricRow label="Household Satisfaction" value={`${demo?.householdStats.averageSatisfaction ?? props.happiness}%`} color="text-cyan-400" />
        <MetricRow label="Treasury" value={`$${props.money.toLocaleString()}`} />
        <MetricRow label="Land-use Suitability" value={`${props.suitabilityAverage ?? 0}%`} color="text-cyan-300" />
        <MetricRow label="Persistent Parcels" value={`${props.parcelCount ?? 0}`} color="text-violet-300" />
        <MetricRow label="Developed / Private Lots" value={`${props.developedParcelCount ?? 0} / ${props.privateParcelCount ?? 0}`} color="text-emerald-300" />
        <MetricRow label="Average Lot Size" value={`${(props.averageParcelSize ?? 0).toFixed(2)} tiles`} color="text-amber-300" />
        <MetricRow label="Mixed-use Blocks" value={`${props.mixedUseBlocks ?? 0}`} color="text-fuchsia-300" />
        <MetricRow label="Mixed-use Floors" value={`${props.mixedUseFloorArea ?? 0}`} color="text-violet-300" />
        <MetricRow label="Mixed-use Jobs" value={`${props.mixedUseJobs ?? 0}`} color="text-sky-300" />
        <MetricRow label="Net Income" value={`$${(props.income - props.expenses).toLocaleString()}`} color={(props.income - props.expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <MetricRow label="Municipal Debt" value={`$${(props.municipalDebt ?? 0).toLocaleString()}`} color={(props.municipalDebt ?? 0) > 0 ? 'text-rose-300' : 'text-emerald-300'} />
        <MetricRow label="Active / Background Regions" value={`${props.activeRegionKeys?.length ?? 0} / ${Object.values(props.regions ?? {}).filter((region) => !region.active).length}`} color="text-cyan-300" />
        <MetricRow label="Recovery Projects" value={`${props.recoveryProjects?.filter((project) => project.active).length ?? 0}`} color="text-orange-300" />
        <MetricRow label="Trade Contracts" value={`${props.tradeContracts?.filter((contract) => contract.active).length ?? 0}`} color="text-violet-300" />
        <MetricRow label="Import Capacity" value={`${Math.round(props.tradeImportCapacity ?? 0)}`} color="text-cyan-300" />
        <MetricRow label="Export Capacity" value={`${Math.round(props.tradeExportCapacity ?? 0)}`} color="text-emerald-300" />
        <MetricRow label="Export Revenue" value={`$${Math.round(props.tradeExportRevenue ?? 0)}`} color="text-amber-300" />
        {props.activeScenarioId && <MetricRow label="Scenario" value={`${props.activeScenarioId}${props.scenarioCompleted ? ' · Completed' : ''}`} color={props.scenarioCompleted ? 'text-emerald-300' : 'text-cyan-300'} />}
        <MetricRow label="City Specialization" value={(props.specialization ?? 'BALANCED').replaceAll('_', ' ')} color="text-fuchsia-300" />
      </Section>

      {(props.causalDiagnostics?.length ?? 0) > 0 && (
        <Section title="Why Is the City Struggling?">
          <div className="space-y-2">
            {props.causalDiagnostics?.slice(0, 5).map((diagnostic) => (
              <div key={diagnostic.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-semibold ${diagnostic.severity === 'CRITICAL' ? 'text-rose-300' : diagnostic.severity === 'WARNING' ? 'text-amber-300' : 'text-cyan-300'}`}>{diagnostic.title}</span>
                  <span className="text-[9px] font-mono uppercase text-slate-500">{diagnostic.category}</span>
                </div>
                <div className="mt-1 text-[10px] leading-relaxed text-slate-400">{diagnostic.explanation}</div>
                {diagnostic.location && <div className="mt-1 text-[9px] font-mono text-slate-500">Lokasi: ({diagnostic.location.x}, {diagnostic.location.y})</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {demo && (
        <Section title="Demographic Snapshot">
          <MetricRow label="Employed Workforce" value={`${demo.workforce.employed.toLocaleString()} / ${demo.workforce.employable.toLocaleString()}`} />
          <MetricRow label="Unemployment Rate" value={`${demo.workforce.unemploymentRate.toFixed(1)}%`} color={demo.workforce.unemploymentRate > 10 ? 'text-rose-400' : 'text-emerald-400'} />
          <MetricRow label="Avg Daily Salary" value={`$${demo.workforce.averageSalary}/day`} color="text-amber-300" />
        </Section>
      )}
    </div>
  );
}

function PopulationTab(props: CityInformationPanelProps) {
  const demo = props.demographics;
  return (
    <div className="space-y-5">
      <Section title="Demographics & Workforce">
        <MetricRow label="Total Citizens" value={props.population.toLocaleString()} />
        <MetricRow label="Total Households" value={props.households.toLocaleString()} />
        <MetricRow label="Employable Adults" value={props.workers.toLocaleString()} />
        <MetricRow label="Employed Citizens" value={`${demo?.workforce.employed ?? Math.min(props.workers, props.availableJobs)}`} color="text-emerald-400" />
        <MetricRow label="Unemployment Rate" value={`${props.unemploymentRate.toFixed(1)}%`} color={props.unemploymentRate > 10 ? 'text-rose-400' : 'text-emerald-400'} />
        <MetricRow label="Average Daily Salary" value={`$${demo?.workforce.averageSalary ?? 35}/day`} color="text-amber-300" />
      </Section>

      {demo && (
        <>
          <Section title="Education Distribution">
            <MetricRow label="Uneducated / Primary" value={`${demo.educationDistribution.uneducated} (${props.population ? Math.round((demo.educationDistribution.uneducated / props.population) * 100) : 0}%)`} />
            <MetricRow label="High School Graduate" value={`${demo.educationDistribution.highSchool} (${props.population ? Math.round((demo.educationDistribution.highSchool / props.population) * 100) : 0}%)`} color="text-blue-300" />
            <MetricRow label="University / Higher Ed" value={`${demo.educationDistribution.university} (${props.population ? Math.round((demo.educationDistribution.university / props.population) * 100) : 0}%)`} color="text-emerald-300" />
          </Section>

          <Section title="Age Distribution">
            <MetricRow label="Children (0-17)" value={`${demo.ageDistribution.children}`} />
            <MetricRow label="Students (18-24)" value={`${demo.ageDistribution.students}`} />
            <MetricRow label="Adults (Working Age)" value={`${demo.ageDistribution.adults}`} />
            <MetricRow label="Seniors (65+)" value={`${demo.ageDistribution.seniors}`} />
          </Section>

          <Section title="Household Financials & Satisfaction">
            <MetricRow label="Satisfaction Index" value={`${demo.householdStats.averageSatisfaction}%`} color="text-cyan-300" />
            <MetricRow label="Average Daily Rent" value={`$${demo.householdStats.averageRent}/day`} />
            <MetricRow label="Average Household Savings" value={`$${demo.householdStats.averageSavings}`} color="text-emerald-400" />
          </Section>

          <Section title="Migration Activity">
            <MetricRow label="Daily Immigrants" value={`+${demo.migration.immigrants}`} color="text-emerald-400" />
            <MetricRow label="Daily Emigrants" value={`-${demo.migration.emigrants}`} color="text-rose-400" />
            <MetricRow label="Internal Relocations" value={`${demo.migration.relocations}`} />
            <MetricRow label="Net Migration" value={`${demo.migration.netMigration >= 0 ? '+' : ''}${demo.migration.netMigration}`} color={demo.migration.netMigration >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          </Section>
        </>
      )}
    </div>
  );
}

function EconomyTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-6">
      <Section title="Budget">
        <MetricRow label="Income" value={`$${props.income.toLocaleString()}`} color="text-emerald-400" />
        <MetricRow label="Expenses" value={`$${props.expenses.toLocaleString()}`} color="text-red-400" />
        <div className="h-[1px] bg-white/10 my-2"></div>
        <MetricRow label="Net Profit" value={`$${(props.income - props.expenses).toLocaleString()}`} color={(props.income - props.expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <MetricRow label="Municipal Debt" value={`$${(props.municipalDebt ?? 0).toLocaleString()}`} color={(props.municipalDebt ?? 0) > 0 ? 'text-rose-300' : 'text-emerald-300'} />
      </Section>

      <Section title="Taxation">
        <TaxSlider label="Residential Tax" value={props.residentialTaxRate} onChange={(v) => props.onTaxChange('residential', v)} color="emerald" />
        <TaxSlider label="Commercial Tax" value={props.commercialTaxRate} onChange={(v) => props.onTaxChange('commercial', v)} color="blue" />
        <TaxSlider label="Industrial Tax" value={props.industrialTaxRate} onChange={(v) => props.onTaxChange('industrial', v)} color="yellow" />
      </Section>
      <Section title="Inter-sector Market">
        <MetricRow label="Market Health" value={`${props.marketHealth ?? 0}%`} color={(props.marketHealth ?? 0) >= 70 ? 'text-emerald-400' : 'text-amber-300'} />
        <MetricRow label="Consumer Demand" value={`${(props.consumerDemand ?? 0).toLocaleString()}`} />
        <MetricRow label="Retail Supply" value={`${(props.retailSupply ?? 0).toLocaleString()}`} color="text-blue-300" />
        <MetricRow label="Goods Demand" value={`${(props.goodsDemand ?? 0).toLocaleString()}`} />
        <MetricRow label="Goods Supply" value={`${(props.goodsSupply ?? 0).toLocaleString()}`} color="text-yellow-300" />
        <MetricRow label="Commercial Utilization" value={`${Math.round((props.commercialUtilization ?? 0) * 100)}%`} />
        <MetricRow label="Office Demand" value={`${props.officeDemand ?? 0}`} color="text-violet-300" />
        <MetricRow label="Office Utilization" value={`${Math.round((props.officeUtilization ?? 0) * 100)}%`} color="text-violet-300" />
        <MetricRow label="Industrial Utilization" value={`${Math.round((props.industrialUtilization ?? 0) * 100)}%`} />
      </Section>
      <Section title="Freight & Logistics">
        <MetricRow label="Freight Reliability" value={`${props.freightReliability ?? 0}%`} color={(props.freightReliability ?? 0) >= 70 ? 'text-emerald-400' : 'text-rose-400'} />
        <MetricRow label="Freight Demand" value={`${(props.freightDemand ?? 0).toLocaleString()}`} />
        <MetricRow label="Freight Capacity" value={`${(props.freightCapacity ?? 0).toLocaleString()}`} color="text-cyan-300" />
        <MetricRow label="Industrial Highway Access" value={`${props.industrialAccess ?? 0}%`} />
        <MetricRow label="Production Efficiency" value={`${Math.round((props.productionEfficiency ?? 1) * 100)}%`} color={(props.productionEfficiency ?? 1) >= 0.8 ? 'text-emerald-300' : 'text-amber-300'} />
        <MetricRow label="Production Input Load" value={`${Object.values(props.productionInputDemand ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0).toLocaleString()}`} color="text-amber-300" />
        <MetricRow label="Cargo Terminals" value={`${props.cargoTerminals ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Cargo Throughput" value={`${props.cargoThroughput ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Commercial Stock" value={`${props.commercialStock ?? 0}%`} color="text-blue-300" />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {['FOOD', 'GOODS', 'MATERIALS', 'FUEL'].map((commodity) => (
            <div key={commodity} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px]">
              <div className="text-slate-400">{commodity}</div>
              <div className="font-mono text-cyan-200">{props.commodityStock?.[commodity] ?? 0}% stock</div>
              <div className="text-slate-500">{props.commoditySupply?.[commodity] ?? 0}/{props.commodityDemand?.[commodity] ?? 0}</div>
            </div>
          ))}
        </div>
        <MetricRow label="Connected Industries" value={`${props.connectedIndustries ?? 0}`} />
        <MetricRow label="Active Freight Runs" value={`${props.freightActiveTrips ?? 0}`} color="text-orange-300" />
        <MetricRow label="Warehouses" value={`${props.warehouses ?? 0}`} color="text-orange-300" />
        <MetricRow label="Warehouse Capacity" value={`${props.warehouseCapacity ?? 0}`} />
        <MetricRow label="Warehouse Buffer" value={`${props.warehouseBuffer ?? 0}%`} color={(props.warehouseBuffer ?? 0) >= 35 ? 'text-emerald-300' : 'text-amber-300'} />
      </Section>
    </div>
  );
}

function ServicesTab(props: CityInformationPanelProps) {
  const dispatchLifecycle = deriveIncidentDispatchLifecycle(props.incidents ?? [], props.serviceVehicles ?? [], props.serviceResponseQuality ?? 100);
  const returningVehicles = getReturningServiceVehicles(props.serviceVehicles ?? []);

  return (
    <div className="space-y-4">
      <Section title="Utilities">
        <ProgressBar label="Electricity Usage" value={props.powerDemand} max={props.powerCapacity || 1} format={(v) => `${Math.round(v)} MW`} color={props.powerDemand > props.powerCapacity ? 'bg-red-500' : 'bg-yellow-500'} />
        <ProgressBar label="Water Usage" value={props.waterDemand} max={props.waterCapacity || 1} format={(v) => `${Math.round(v)} kL`} color={props.waterDemand > props.waterCapacity ? 'bg-red-500' : 'bg-cyan-500'} />
        <ProgressBar label="Waste Capacity" value={props.wasteProduction} max={props.wasteCapacity || 1} format={(v) => `${Math.round(v)} T`} color={props.wasteProduction > props.wasteCapacity ? 'bg-red-500' : 'bg-stone-500'} />
      </Section>
      <Section title="City Services">
        <MetricRow label="Healthcare Coverage" value={`${props.healthcareCoverage}%`} />
        <MetricRow label="Healthcare Capacity" value={`${props.healthcareCapacity ?? 0}`} color="text-teal-300" />
        <MetricRow label="Education Coverage" value={`${props.educationCoverage}%`} />
        <MetricRow label="Education Capacity" value={`${props.educationCapacity ?? 0}`} color="text-amber-300" />
        <MetricRow label="Fire Safety" value={`${props.fireSafety}%`} />
        <MetricRow label="Fire Response Capacity" value={`${props.fireServiceCapacity ?? 0}`} color="text-red-300" />
        <MetricRow label="Crime Rate" value={`${props.crimeRate}%`} color={props.crimeRate > 30 ? 'text-red-400' : 'text-gray-300'} />
        <MetricRow label="Police Capacity" value={`${props.policeServiceCapacity ?? 0}`} color="text-blue-300" />
        <MetricRow label="Service Response Quality" value={`${props.serviceResponseQuality ?? 100}%`} color={(props.serviceResponseQuality ?? 100) >= 75 ? 'text-emerald-400' : 'text-amber-300'} />
      </Section>
      <Section title="Incident Dispatch">
        <MetricRow label="Active Incidents" value={`${props.activeIncidents ?? 0}`} color={(props.activeIncidents ?? 0) > 0 ? 'text-rose-300' : 'text-emerald-300'} />
        <MetricRow label="Response Load" value={`${(props.incidentResponseLoad ?? 0).toFixed(1)}`} color="text-amber-300" />
        <MetricRow label="Units Dispatched" value={`${props.incidentDispatchedUnits ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Units Queued" value={`${props.incidentQueuedUnits ?? 0}`} color={(props.incidentQueuedUnits ?? 0) > 0 ? 'text-rose-300' : 'text-emerald-300'} />
        <MetricRow label="Resolved This Tick" value={`${props.incidentsResolved ?? 0}`} color="text-emerald-300" />
        <MetricRow label="Happiness Penalty" value={`-${(props.incidentHappinessPenalty ?? 0).toFixed(1)}`} color="text-rose-300" />
        {(props.incidents?.length ?? 0) > 0 && (
          <div className="mt-2 space-y-1.5">
            {props.incidents?.slice(0, 5).map((incident) => (
              <div key={incident.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
                <span className="text-slate-300">{incident.type} · ({incident.x},{incident.y})</span>
                <span className="font-mono text-amber-300">S{incident.severity} · {incident.dispatchedUnits ?? 0}/{incident.requiredUnits ?? incident.severity}u · {incident.remainingDays.toFixed(1)}d</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Incident Lifecycle">
        {dispatchLifecycle.length === 0 && returningVehicles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-slate-400">
            Tidak ada unit aktif. Dispatch baru akan tampil sebagai antrean, perjalanan, atau on-scene.
          </div>
        ) : (
          <div className="space-y-2">
            {dispatchLifecycle.slice(0, 5).map((lifecycle) => {
              const stageMeta = lifecycle.stage === 'ON_SCENE'
                ? { label: 'ON SCENE', className: 'text-amber-300' }
                : lifecycle.stage === 'DISPATCHING'
                  ? { label: 'DISPATCHING', className: 'text-cyan-300' }
                  : { label: 'QUEUED', className: 'text-rose-300' };
              return (
                <div key={lifecycle.incidentId} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-200">{lifecycle.type} · S{lifecycle.severity}</span>
                    <span className={`font-mono font-bold ${stageMeta.className}`}>{stageMeta.label}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500">
                    <span>Lokasi {lifecycle.location.x},{lifecycle.location.y}</span>
                    <span>Unit {lifecycle.dispatchedUnits}/{lifecycle.requiredUnits}</span>
                    <span>Route {lifecycle.routeTiles} tiles</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40">
                    <div className="h-full rounded-full bg-cyan-400 transition-[width]" style={{ width: `${lifecycle.responseProgress}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-slate-500">
                    <span>Response {Math.round(lifecycle.responseProgress)}% · {lifecycle.dispatchingUnits} en route · {lifecycle.onSceneUnits} on scene</span>
                    <span className="font-mono text-slate-300">{lifecycle.stage === 'ON_SCENE' ? 'stabilizing' : `ETA ${lifecycle.etaMinutes.toFixed(1)}m`}</span>
                  </div>
                </div>
              );
            })}
            {returningVehicles.length > 0 && (
              <div className="rounded-lg border border-violet-300/20 bg-violet-400/[0.06] px-2.5 py-2 text-[10px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-violet-100">RETURNING TO DEPOT</span>
                  <span className="font-mono text-violet-200">{returningVehicles.length} unit</span>
                </div>
                <div className="mt-1 text-slate-400">Unit tetap terlihat satu leg setelah insiden selesai agar siklus dispatch dapat diaudit.</div>
                <div className="mt-1 font-mono text-violet-200">
                  {returningVehicles.slice(0, 3).map((vehicle) => `${vehicle.role} ${(Math.max(0, Math.min(1, 2 - vehicle.routeProgress)) * 100).toFixed(0)}% remaining`).join(' · ')}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>
      <Section title="Dispatch Bands by Agency">
        <div className="space-y-2">
          {(props.serviceDispatchInsights ?? []).map((insight) => (
            <DispatchInsightCard key={insight.agency} insight={insight} />
          ))}
        </div>
      </Section>
      <Section title="Service Fleet">
        <MetricRow label="Total Fleet Units" value={`${props.serviceFleetTotal ?? 0}`} color="text-slate-200" />
        <MetricRow label="Available Units" value={`${props.serviceFleetAvailable ?? 0}`} color={(props.serviceFleetAvailable ?? 0) > 0 ? 'text-emerald-300' : 'text-rose-300'} />
        <MetricRow label="Active Dispatches" value={`${props.serviceFleetActive ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Units On Scene" value={`${props.serviceFleetOnScene ?? 0}`} color="text-amber-300" />
        <MetricRow label="Fleet Condition" value={`${(props.serviceFleetAverageCondition ?? 100).toFixed(1)}%`} color={(props.serviceFleetAverageCondition ?? 100) >= 70 ? 'text-emerald-300' : 'text-rose-300'} />
        <MetricRow label="Depot Maintenance / Day" value={`$${(props.serviceFleetMaintenanceCost ?? 0).toFixed(1)}`} color="text-orange-300" />
        <MetricRow label="Maintenance Work Orders" value={`${props.activeMaintenanceOrders ?? 0}`} color={(props.activeMaintenanceOrders ?? 0) > 0 ? 'text-orange-300' : 'text-slate-300'} />
        <MetricRow label="Station Bay Queue" value={`${Object.values(props.serviceBayQueues ?? {}).reduce((sum, value) => sum + value, 0)}`} color="text-rose-300" />
      </Section>
    </div>
  );
}

function TrafficTab(props: CityInformationPanelProps) {
  const demo = props.demographics;
  return (
    <div className="space-y-4">
      <Section title="Traffic & Commute Flow">
        <MetricRow label="Average Traffic Flow" value={`${Math.max(0, 100 - props.trafficAverage).toFixed(1)}%`} />
        <MetricRow label="Congestion Index" value={`${props.congestionIndex.toFixed(1)}`} />
        <MetricRow label="Average Queue Pressure" value={`${(props.averageQueuePressure ?? 0).toFixed(1)}%`} color={(props.averageQueuePressure ?? 0) > 25 ? 'text-rose-300' : 'text-amber-300'} />
        <MetricRow label="Avg Commute Time" value={`${props.averageCommuteTime.toFixed(1)} min`} />
      </Section>

      <Section title="Parking & Curb Space">
        <MetricRow label="Parking Demand" value={`${(props.parkingDemand ?? 0).toFixed(1)} spaces`} />
        <MetricRow label="Parking Supply" value={`${(props.parkingSupply ?? 0).toLocaleString()} spaces`} color="text-slate-300" />
        <MetricRow label="Nearby Coverage" value={`${Math.round(props.parkingCoverage ?? 0)}%`} color="text-cyan-300" />
        <MetricRow label="Parking Pressure" value={`${(props.parkingPressure ?? 0).toFixed(2)}×`} color={(props.parkingPressure ?? 0) > 1 ? 'text-rose-300' : 'text-emerald-300'} />
      </Section>

      <Section title="Public Transit Network">
        <MetricRow label="City Time" value={`${String(Math.floor(props.timeOfDay ?? 6)).padStart(2, '0')}:00`} color="text-cyan-300" />
        <MetricRow label="Service Coverage" value={`${Math.round(props.transitCoverage ?? 0)}%`} color="text-cyan-400" />
        <MetricRow label="Daily Ridership" value={`${(props.transitRidership ?? 0).toLocaleString()}`} color="text-emerald-400" />
        <MetricRow label="Capacity" value={`${(props.transitCapacity ?? 0).toLocaleString()}`} />
        <MetricRow label="Bus Depots" value={`${props.transitBusDepots ?? 0}`} />
        <MetricRow label="Tram Stations" value={`${props.transitTramStations ?? 0}`} color="text-violet-300" />
        <MetricRow label="Active Lines" value={`${props.transitActiveLines ?? 0}`} color="text-cyan-300" />
        <MetricRow label="Active Vehicles" value={`${props.transitActiveVehicles ?? 0}`} color="text-amber-300" />
        <MetricRow label="Average Wait" value={`${(props.transitAverageWait ?? 0).toFixed(1)} min`} />
        <MetricRow label="Transfer Stops" value={`${props.transitTransferOpportunities ?? 0}`} color="text-violet-300" />
        <MetricRow label="Platform Capacity" value={`${props.transitPlatformCapacity ?? 0}`} color="text-slate-300" />
        <MetricRow label="Average Dwell" value={`${(props.transitAverageDwell ?? 0).toFixed(1)} min`} color="text-violet-300" />
        <MetricRow label="Fare Revenue / Day" value={`$${(props.transitFareRevenue ?? 0).toLocaleString()}`} color="text-emerald-300" />
        <MetricRow label="Operating Cost / Day" value={`$${(props.transitOperatingCost ?? 0).toLocaleString()}`} color="text-rose-300" />
      </Section>

      <Section title="Transit Line Manager">
        {(props.transitLines?.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-slate-400">
            Belum ada line terjadwal. Gunakan Transit → Line Planner untuk membuat rute.
          </div>
        ) : (
          <div className="space-y-2">
            {props.transitLines?.map((line) => (
              <div key={line.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{line.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {line.mode} · {line.stops.length} stop · setiap {line.frequency} menit · peak {line.peakFrequency ?? Math.max(1, Math.round(line.frequency * 0.65))} menit · {line.active ? 'Aktif' : 'Nonaktif'}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => props.onToggleTransitLine?.(line.id)}
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${line.active ? 'border-amber-400/20 text-amber-300 hover:bg-amber-400/10' : 'border-emerald-400/20 text-emerald-300 hover:bg-emerald-400/10'}`}
                    >
                      {line.active ? 'Pause' : 'Aktifkan'}
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
                  {line.stops.map(([x, y]) => `${x},${y}`).join(' → ')}
                </div>
                <TransitVehicleTelemetry line={line} vehicles={props.transitVehicles ?? []} />
                <TransitInsightStrip insight={props.transitLineInsights?.find((insight) => insight.lineId === line.id)} />
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                  <label className="text-slate-500">Start
                    <select value={line.serviceStartHour ?? 5} onChange={(event) => props.onUpdateTransitLine?.(line.id, { serviceStartHour: Number(event.target.value) })} className="mt-0.5 w-full rounded border border-white/10 bg-[#111827] px-1.5 py-1 text-slate-200">
                      {Array.from({ length: 18 }, (_, hour) => hour + 4).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
                    </select>
                  </label>
                  <label className="text-slate-500">End
                    <select value={line.serviceEndHour ?? 24} onChange={(event) => props.onUpdateTransitLine?.(line.id, { serviceEndHour: Number(event.target.value) })} className="mt-0.5 w-full rounded border border-white/10 bg-[#111827] px-1.5 py-1 text-slate-200">
                      {Array.from({ length: 19 }, (_, index) => index + 6).map((hour) => <option key={hour} value={hour}>{hour === 24 ? '24:00' : `${String(hour).padStart(2, '0')}:00`}</option>)}
                    </select>
                  </label>
                  <label className="text-slate-500">Peak min
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
      <Section title="Transit Route Map">
        <TransitRouteMap
          lines={props.transitLines ?? []}
          vehicles={props.transitVehicles ?? []}
          insights={props.transitLineInsights ?? []}
          timeOfDay={props.timeOfDay ?? 6}
          onFocusStop={props.onFocusTransitStop}
        />
      </Section>

      {demo && demo.tripStats && (
        <Section title="Real Commuter Trips & Modal Split">
          <MetricRow label="Total Daily Trips" value={`${demo.tripStats.totalTrips.toLocaleString()}`} />
          <MetricRow label="Car Commuters" value={`${demo.tripStats.carTrips} (${demo.tripStats.totalTrips ? Math.round((demo.tripStats.carTrips / demo.tripStats.totalTrips) * 100) : 0}%)`} color="text-amber-400" />
          <MetricRow label="Public Transit" value={`${demo.tripStats.transitTrips} (${demo.tripStats.totalTrips ? Math.round((demo.tripStats.transitTrips / demo.tripStats.totalTrips) * 100) : 0}%)`} color="text-cyan-400" />
          <MetricRow label="Bicycle Trips" value={`${demo.tripStats.bikeTrips} (${demo.tripStats.totalTrips ? Math.round((demo.tripStats.bikeTrips / demo.tripStats.totalTrips) * 100) : 0}%)`} color="text-emerald-400" />
          <MetricRow label="Pedestrian / Walk" value={`${demo.tripStats.walkTrips} (${demo.tripStats.totalTrips ? Math.round((demo.tripStats.walkTrips / demo.tripStats.totalTrips) * 100) : 0}%)`} color="text-slate-300" />
        </Section>
      )}
    </div>
  );
}

function EnvironmentTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-4">
      <MetricRow label="Average Land Value" value={`$${props.landValueAverage.toFixed(0)} /m²`} color="text-emerald-400" />
      <MetricRow label="Overall Desirability" value={`${props.desirability.toFixed(1)}%`} />
      <MetricRow label="Ground Pollution" value={`${props.pollutionAverage.toFixed(1)}%`} color={props.pollutionAverage > 20 ? 'text-red-400' : 'text-gray-300'} />
      <MetricRow label="Noise Pollution" value={`${props.noiseAverage.toFixed(1)}%`} />
      <MetricRow label="Flooded Tiles" value={`${props.floodedTiles ?? 0}`} color={(props.floodedTiles ?? 0) > 0 ? 'text-blue-300' : 'text-emerald-300'} />
      <MetricRow label="Avg Surface Depth" value={`${(props.averageWaterDepth ?? 0).toFixed(2)} m`} color="text-cyan-300" />
      <MetricRow label="Peak Surface Depth" value={`${(props.peakWaterDepth ?? 0).toFixed(2)} m`} color={(props.peakWaterDepth ?? 0) >= 0.75 ? 'text-blue-300' : 'text-cyan-300'} />
      <MetricRow label="Flowing Water Tiles" value={`${props.flowingWaterTiles ?? 0}`} color="text-sky-300" />
      <MetricRow label="Flood Barriers" value={`${props.floodBarrierCount ?? 0}`} color="text-sky-300" />
      <MetricRow label="Reservoir Storage" value={`${(props.reservoirStorage ?? 0).toFixed(2)} m³`} color="text-blue-300" />
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

function TransitInsightStrip({ insight }: { insight?: TransitLineInsight }) {
  if (!insight) return null;
  const statusClass = insight.status === 'READY' ? 'text-emerald-300' : insight.status === 'CROWDED' ? 'text-rose-300' : insight.status === 'LIMITED' ? 'text-amber-300' : 'text-slate-400';
  return (
    <div className="mt-2 rounded-md border border-cyan-400/15 bg-cyan-500/[0.05] p-2 text-[9px]">
      <div className="flex items-center justify-between gap-2"><span className={`font-semibold ${statusClass}`}>{insight.status}</span><span className="text-slate-400">Catchment {insight.catchmentPopulation} · transfer {insight.transferStops}</span></div>
      <div className="mt-1 grid grid-cols-4 gap-1 text-slate-400"><span>Fleet <b className="font-mono text-slate-200">{insight.vehicles}</b></span><span>Load <b className="font-mono text-slate-200">{Math.round(insight.occupancyPercent)}%</b></span><span>Wait <b className="font-mono text-slate-200">{insight.averageWaitMinutes.toFixed(1)}m</b></span><span>Net <b className={`font-mono ${insight.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>${insight.balance}</b></span></div>
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
}: {
  lines: TransitLine[];
  vehicles: TransitVehicleAgent[];
  insights: TransitLineInsight[];
  timeOfDay: number;
  onFocusStop?: (location: { x: number; y: number }) => void;
}) {
  const routes = deriveTransitRouteGeometry(lines, vehicles, timeOfDay);
  if (routes.length === 0) {
    return <div className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-slate-500">Belum ada rute. Buat minimal dua stop melalui Transit → Line Planner.</div>;
  }
  const bounds = calculateTransitMapBounds(routes);

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-2">
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1.5"><Route size={12} /> Schematic route topology · click stop untuk fokus map</span><span className="shrink-0 text-cyan-300">{routes.filter((route) => route.usesVehiclePath).length}/{routes.length} road path live</span></div>
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
                    <title>{vehicle.id} · stop {(vehicle.nextStopIndex ?? 0) + 1} · ETA {vehicle.etaMinutes?.toFixed(1) ?? '—'}m</title>
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
                <span className="shrink-0 text-slate-500">{line.active ? (operating ? (insight?.status ?? 'READY') : 'OUT OF HOURS') : 'OFFLINE'}</span>
              </div>
              <div className="mt-0.5 text-[9px] text-slate-500">{usesVehiclePath ? 'ROAD PATH LIVE · telemetry kendaraan' : 'STOP PLAN · menunggu telemetry kendaraan'}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {line.stops.map(([x, y], stopIndex) => (
                  <button key={`${line.id}-focus-${stopIndex}`} type="button" onClick={() => onFocusStop?.({ x, y })} className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-400 hover:border-cyan-300/40 hover:text-cyan-200" title={`Fokus stop ${x},${y}`}>
                    <MapPinned size={9} />{stopIndex + 1}: {x},{y}
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

function DispatchInsightCard({ insight }: { insight: ServiceDispatchInsight }) {
  const meta = DISPATCH_BAND_META[insight.band];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-200">{insight.label}</span>
        <span className={`font-mono font-bold ${meta.className}`}>{meta.label}</span>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1 text-slate-500">
        <span>Calls <b className="font-mono text-slate-200">{insight.activeIncidents}</b></span>
        <span>ETA <b className="font-mono text-slate-200">{insight.averageEtaMinutes.toFixed(1)}m</b></span>
        <span>Queue <b className={`font-mono ${insight.queuedUnits + insight.bayQueue > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{insight.queuedUnits + insight.bayQueue}</b></span>
        <span>Ready <b className="font-mono text-slate-200">{insight.availableUnits}</b></span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, Math.max(0, insight.dispatchCompletionPercent))}%` }} /></div>
      <div className="mt-1 text-slate-500">Dispatch {Math.round(insight.dispatchCompletionPercent)}% · route {insight.averageRouteTiles.toFixed(1)} tiles · {insight.recommendations[0]}</div>
    </div>
  );
}

function TransitVehicleTelemetry({ line, vehicles }: { line: TransitLine; vehicles: TransitVehicleAgent[] }) {
  const lineVehicles = vehicles.filter((vehicle) => vehicle.lineId === line.id);
  if (lineVehicles.length === 0) {
    return <div className="mt-1 text-[9px] text-slate-600">Tidak ada vehicle telemetry; line menunggu jam layanan atau koneksi road path.</div>;
  }

  return (
    <div className="mt-1 rounded border border-cyan-300/10 bg-cyan-400/[0.04] px-1.5 py-1 text-[9px] text-cyan-100">
      <div className="font-semibold uppercase tracking-wide text-cyan-300">Live vehicle schedule</div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-slate-400">
        {lineVehicles.slice(0, 4).map((vehicle, index) => (
          <span key={vehicle.id}>
            V{index + 1} → stop {(vehicle.nextStopIndex ?? 0) + 1} · {vehicle.etaMinutes?.toFixed(1) ?? '—'}m · {vehicle.occupancy}/{vehicle.capacity}
          </span>
        ))}
      </div>
    </div>
  );
}
