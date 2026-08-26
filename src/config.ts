export const GAME_CONFIG = {
  // Financial Defaults
  STARTING_MONEY: 8000,
  LOW_TREASURY_THRESHOLD: 1500,
  
  // RCI Demands Boundaries
  DEMAND_MIN: -100,
  DEMAND_MAX: 100,
  
  // Tax Balancing
  DEFAULT_TAX_RATE: 9,      // Default tax percentage (1% to 20%)
  TAX_OPTIMAL: 9,           // Tax rates below this boost demand, above this hurt demand
  TAX_Friction_MULT: 12,    // Scale factor for high tax demand penalties
  
  // Base Tax Revenue Coefficients (per citizen/job per tick at optimal 9% tax)
  BASE_RES_TAX_COEFF: 1.2,  // Tax earned per citizen
  BASE_COM_TAX_COEFF: 2.2,  // Tax earned per filled commercial job
  BASE_IND_TAX_COEFF: 2.8,  // Tax earned per filled industrial job
  
  // Build and Maintenance Costs
  BUILD_COSTS: {
    EMPTY: 0,
    ROAD: 25,
    BUS_DEPOT: 1500,
    TRAM_STATION: 3500,
    BUS_STOP: 180,
    TRAM_STOP: 320,
    RESIDENTIAL: 60,
    COMMERCIAL: 120,
    OFFICE: 140,
    INDUSTRIAL: 120,
    POWER_PLANT: 800,
    WATER_PUMP: 500,
    FIRE_STATION: 600,
    POLICE_STATION: 550,
    CLINIC: 700,
    SCHOOL: 650,
    WASTE_MANAGEMENT: 800,
    WAREHOUSE: 900,
    CARGO_TERMINAL: 1800,
    PARK: 300,
    PARKING: 220,
    FLOOD_BARRIER: 420,
    WATER_RESERVOIR: 950,
  },
  
  MAINTENANCE_COSTS: {
    EMPTY: 0,
    ROAD: 2,
    BUS_DEPOT: 24,
    TRAM_STATION: 48,
    BUS_STOP: 3,
    TRAM_STOP: 6,
    RESIDENTIAL: 1,
    COMMERCIAL: 1,
    OFFICE: 2,
    INDUSTRIAL: 2,
    POWER_PLANT: 45,
    WATER_PUMP: 30,
    FIRE_STATION: 35,
    POLICE_STATION: 30,
    CLINIC: 40,
    SCHOOL: 35,
    WASTE_MANAGEMENT: 45,
    WAREHOUSE: 30,
    CARGO_TERMINAL: 45,
    PARK: 15,
    PARKING: 8,
    FLOOD_BARRIER: 6,
    WATER_RESERVOIR: 28,
  },

  // Road hierarchy. A road tile remains TileType.ROAD for save and network
  // compatibility; roadClass controls its construction profile.
  ROAD_CLASSES: {
    LOCAL: {
      BUILD_COST: 25,
      MAINTENANCE: 2,
      CAPACITY: 20,
      SPEED_MULTIPLIER: 1.0,
      LANES: 1,
    },
    ARTERIAL: {
      BUILD_COST: 45,
      MAINTENANCE: 4,
      CAPACITY: 38,
      SPEED_MULTIPLIER: 0.82,
      LANES: 2,
    },
    HIGHWAY: {
      BUILD_COST: 80,
      MAINTENANCE: 6,
      CAPACITY: 72,
      SPEED_MULTIPLIER: 0.62,
      LANES: 3,
    },
  },

  // City Services Specifications
  CITY_SERVICES: {
    FIRE_STATION: {
      ROAD_RANGE: 12,     // Max road path distance
      CAPACITY: 150,      // Max citizens/buildings served
      BASE_SAFETY: 90,    // Base safety rating within coverage
    },
    POLICE_STATION: {
      ROAD_RANGE: 12,
      CAPACITY: 160,
      CRIME_REDUCTION: 85,
    },
    CLINIC: {
      ROAD_RANGE: 14,
      CAPACITY: 140,
      HEALTH_BOOST: 85,
    },
    SCHOOL: {
      ROAD_RANGE: 12,
      CAPACITY: 120,
      EDU_BOOST: 90,
    },
    WASTE_MANAGEMENT: {
      ROAD_RANGE: 16,
      CAPACITY: 250,      // Tons of waste processed
      PER_POP_WASTE: 0.8, // Waste units produced per citizen
      PER_IND_WASTE: 1.5, // Waste units produced per industrial job
    },
  },
  
  // Policy & Upgrades Monthly Maintenance Fees
  UPGRADE_MAINTENANCE: {
    // Utilities
    smart_grid: 15,
    adv_turbines: 25,
    high_cap_pipes: 15,
    deep_pumps: 20,
    smart_sensors: 10,
    
    // Services
    asphalt_roads: 10,
    smart_lights: 10,
    bus_network: 35,
    tram_system: 50,
    bike_lanes: 15,
    
    // Policies
    solar_subsidies: 20,
    water_meters: -5,  // reduces cost!
    green_roofs: 15,
    recycling: 25,
    ai_management: 40,
    tourism: 30,
    prop_tax_hike: 0,
    wealth_tax: 0,
    mixed_use: 10,
    small_biz: 10,
    startup_hubs: 25,
    highway_conn: 20,
    corp_subsidies: 40,
    auto_logistics: 35,
    sky_permits: 30,
    high_dens_res: 15,
    high_dens_com: 20,
    high_dens_ind: 20,
    megacity: 50,
  } as Record<string, number>,
  
  // Demographic Constants
  WORKING_AGE_RATIO: 0.65,
  CONSUMPTION_POWER_BASE: 100, // baseline purchasing power index
  
  // Growth Speed Coefficients
  GROWTH_RES_RATE: 0.15,
  GROWTH_COM_RATE: 0.15,
  GROWTH_IND_RATE: 0.15,

  TERRAFORM_COST: 15,
  ROAD_REPAIR_COST: 35,
  ROAD_REPAIR_AMOUNT: 20,
  TERRAIN_MIN_ELEVATION: 0,
  TERRAIN_MAX_ELEVATION: 10,
  BRIDGE_COST_MULTIPLIER: 2.5,
  TUNNEL_COST_MULTIPLIER: 2.2,
  DISASTER_CHANCE: 0.0015,
  DISASTER_REPAIR_RATE: 3,
  DISASTER_IMPACT_DECAY: 0.88,

  // Traffic Engine 2.0 & Road Network Constants
  ROAD_NETWORK: {
    BASE_CAPACITY: 20,              // Base vehicle capacity per road tile
    ASPHALT_CAPACITY_BONUS: 15,     // Capacity boost from asphalt roads upgrade
    ASPHALT_SPEED_MULT: 0.8,        // Travel time multiplier on asphalt roads
    BASE_INTERSECTION_PENALTY: 0.6, // Congestion penalty at 3-way/4-way intersections
    SMART_LIGHTS_PENALTY: 0.12,     // Reduced intersection penalty with smart traffic lights
    UNSIGNALIZED_INTERSECTION_DELAY: 1.35,
    SIGNALIZED_INTERSECTION_DELAY: 1.08,
    SMART_LIGHTS_INTERSECTION_DELAY: 0.92,
    BIKE_LANE_MAX_DIST: 7,          // Max distance where bike lanes absorb commute traffic
    BIKE_LANE_ABSORPTION: 0.35,     // 35% car traffic reduction on short trips with bike lanes
    BUS_NETWORK_REDUCTION: 0.25,    // 25% traffic volume reduction with municipal bus network
    TRAM_SYSTEM_REDUCTION: 0.35,    // 35% traffic volume reduction with light rail / tram network
  },

  // Region Expansion Config
  REGION_BASE_UNLOCK_COST: 2500,
  REGION_GRID_DIM: 3,
  REGION_SIZE: 20,

  // Difficulty Modifiers
  DIFFICULTY_MODIFIERS: {
    easy: {
      moneyMultiplier: 1.25,
      demandMultiplier: 1.15,
      costMultiplier: 0.8,
      eventChance: 0.02,
    },
    normal: {
      moneyMultiplier: 1.0,
      demandMultiplier: 1.0,
      costMultiplier: 1.0,
      eventChance: 0.05,
    },
    hard: {
      moneyMultiplier: 0.8,
      demandMultiplier: 0.85,
      costMultiplier: 1.25,
      eventChance: 0.08,
    },
  },
};
