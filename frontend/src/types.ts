export interface VendorTier {
  name: string;
  tier: string;
  color: 'Green' | 'Grey' | 'Red' | 'green' | 'yellow' | 'orange' | 'grey' | 'red' | string;
  countries?: string[];
  isAddedManually?: boolean;
}

export interface FeasibilityRow {
  id: string; // unique identifier
  pitchName: string; // A
  source: string; // B
  option: string; // C
  market: string; // D
  target: string; // E
  loi: number; // F
  irPercent: number; // G
  irUniverse: string; // H
  quotas: string; // I
  waves: number; // J
  totalFreshSample: number; // K
  totalSampleSize: number; // L
  internal: number; // M
  maxInternalPercent?: number; // Optional custom internal allocation ceiling percentage (0-100)
  
  // Custom manual percentage sliders/modifiers to adjust vendor capacities (0-100%)
  vendor1Pct?: number;
  vendor2Pct?: number;
  vendor3Pct?: number;
  vendor4Pct?: number;
  vendor5Pct?: number;
  vendor6Pct?: number;
  vendor7Pct?: number;
  vendor8Pct?: number;
  vendor9Pct?: number;

  vendor1PctOverride?: number;
  vendor2PctOverride?: number;
  vendor3PctOverride?: number;
  vendor4PctOverride?: number;
  vendor5PctOverride?: number;
  vendor6PctOverride?: number;
  vendor7PctOverride?: number;
  vendor8PctOverride?: number;
  vendor9PctOverride?: number;
  internalPctOverride?: number;

  vendor1: number; // N
  vendor1Cpi: number; // O
  vendor2: number; // P
  vendor2Cpi: number; // Q
  vendor3: number; // R
  vendor3Cpi: number; // S
  vendor4: number; // T
  vendor4Cpi: number; // U
  
  vendor5?: number;
  vendor5Cpi?: number;
  vendor6?: number;
  vendor6Cpi?: number;
  vendor7?: number;
  vendor7Cpi?: number;
  vendor8?: number;
  vendor8Cpi?: number;
  vendor9?: number;
  vendor9Cpi?: number;

  // Advanced metadata fields (PM fee, Comparability state, sales quote price)
  pmFee?: number;
  comparability?: string;
  salesCpi?: number;
  targetedCpi?: number; // Targeted CPI budget override
  overlapVariable?: number; // Manually assigned overlap percentage (0, 20, 25, 30, 35, 40, 50)
  isLocked?: boolean;
  lockedAllocation?: AllocationResult;
  hasLoiMarkup?: boolean;
  loiDiff?: number;
  matchedDbLoi?: number;
  irReductionPct?: number;
  _matchMetadata?: any;
}

export interface AllocationResult {
  rowId: string;
  allocatedInternal: number;
  allocatedVendor1: number;
  allocatedVendor2: number;
  allocatedVendor3: number;
  allocatedVendor4: number;
  allocatedVendor5?: number;
  allocatedVendor6?: number;
  allocatedVendor7?: number;
  allocatedVendor8?: number;
  allocatedVendor9?: number;
  [key: string]: any;
  totalAllocated: number;
  unfilledSample: number;
  
  // Costs
  externalCost: number; // Paid vendors cost only
  internalCostRef: number; // Internal cost reference ($2/res)
  totalCost: number; // Total overall cost
  weightedCpi: number; // Real weighted average CPI of utilized vendors
  hasLoiMarkup?: boolean; // Whether +10% LOI markup assumption was applied
  loiMarkupNote?: string; // Informative note for hover
  irReductionPct?: number; // IR reduction percentage applied
  
  // Overlap
  overlapPenaltyPct: number; // Overlap penalty percentage applied (0-50%)
  numPanelsUsed: number; // Count of panels used (including internal if > 0)
  numVendorsUsed: number; // Count of active external vendors (> 0)
  
  // Overview output support
  maxPotential: number; // Sum of all capacities based on specs
  internalSharePct: number;
  externalSharePct: number;
  activeVendorsCsv: string; // Used vendor list (e.g., "Vendor 1, Vendor 3")
  operationalProfit: number; // Revenue minus costs
  salesCpi: number;
  pmFee: number;
  comparability: string;
  
  status: 'Fully Feasible' | 'Partially Feasible' | 'Unfeasible' | 'Oversample';
}

export type StrategyType = 'cost' | 'tier' | 'no-internal-cost';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  queryPitch?: FeasibilityRow;
}
