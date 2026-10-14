import { FeasibilityRow, AllocationResult, StrategyType, VendorTier } from '../types';

export function calculateRowAllocation(
  row: FeasibilityRow,
  strategy: StrategyType,
  vendors?: VendorTier[],
  isOptimizedChecking: boolean = false
): AllocationResult {
  if (row.isLocked && row.lockedAllocation) {
    return row.lockedAllocation;
  }
  const target = row.totalSampleSize;
  const numVendors = vendors ? vendors.length : 4;

  // Custom manual percentage configurations (default to 100%)
  const vendorPcts = Array.from({ length: numVendors }, (_, i) => {
    const vIdx = i + 1;
    const key = `vendor${vIdx}Pct` as keyof FeasibilityRow;
    return row[key] !== undefined ? (row[key] as number) : 100;
  });

  // Raw base capacities adjusted for manual percentage modifiers
  const baseInternalCap = row.internal;
  const baseVendorCaps = Array.from({ length: numVendors }, (_, i) => {
    const vIdx = i + 1;
    const capKey = `vendor${vIdx}` as keyof FeasibilityRow;
    const rawVal = (row[capKey] as number) || 0;
    return Math.round(rawVal * (vendorPcts[i] / 100));
  });

  let currentPenaltyPct = row.overlapVariable !== undefined ? row.overlapVariable : 0;
  let lastUsedPanelsCount = -1;

  let allocatedInternal = 0;
  let allocatedVendors = Array(numVendors).fill(0);

  const defaultSlots: VendorTier[] = [
    { name: 'Vendor 1', tier: 'tier 0', color: 'green' },
    { name: 'Vendor 2', tier: 'tier 1', color: 'green' },
    { name: 'Vendor 3', tier: 'tier 2', color: 'yellow' },
    { name: 'Vendor 4', tier: 'tier 3', color: 'orange' }
  ];

  const getSlotConfig = (slotIndex: number) => {
    if (vendors && vendors[slotIndex]) return vendors[slotIndex];
    return defaultSlots[slotIndex] || { name: `Vendor ${slotIndex + 1}`, tier: 'tier 3', color: 'orange' };
  };

  const pTier = (tierStr: string): number => {
    const t = String(tierStr || '').toLowerCase();
    if (t.includes('0')) return 0; // prime/special level 0
    if (t.includes('1')) return 1;
    if (t.includes('2')) return 2;
    if (t.includes('3')) return 3;
    return 4; // 'no tier' is mapped lowest (4) so it falls below Tier 3 (3)
  };

  const pColor = (colorStr: string): number => {
    const c = String(colorStr || '').toLowerCase();
    if (c.includes('green')) return 1;
    if (c.includes('yellow')) return 2;
    if (c.includes('orange')) return 3;
    return 4; // unknown / unassigned color gets lowest priority
  };

  // Loop to find the stable overlap penalty since the penalty reduces capacity
  for (let iter = 0; iter < 10; iter++) {
    // 1. Assign manual overrides when they are defined
    allocatedVendors = Array.from({ length: numVendors }, (_, i) => {
      const vIdx = i + 1;
      const overrideKey = `vendor${vIdx}PctOverride` as keyof FeasibilityRow;
      const overrideVal = row[overrideKey] as number | undefined;
      return overrideVal !== undefined ? Math.round(target * (overrideVal / 100)) : 0;
    });

    const totalManual = allocatedVendors.reduce((acc, val) => acc + val, 0);
    
    // Assign manual internal panel override if defined
    if (row.internalPctOverride !== undefined) {
      allocatedInternal = Math.round(target * (row.internalPctOverride / 100));
    } else {
      allocatedInternal = 0;
    }

    let remaining = Math.max(0, target - totalManual - allocatedInternal);
    const penaltyMultiplier = 1 - currentPenaltyPct / 100;

    // 2. Internal Panel allocation - prioritized and maximized first (only if NOT manually overridden)
    if (row.internalPctOverride === undefined && strategy !== 'no-internal-cost' && remaining > 0) {
      const maxInternalPct = row.maxInternalPercent !== undefined ? row.maxInternalPercent : 100;
      const internalAllocationLimit = Math.round(row.totalSampleSize * (maxInternalPct / 100));
      
      const effectiveInternalCap = Math.round(baseInternalCap * penaltyMultiplier);
      
      // RULE: Prioritize internal capabilities; if internal capabilities are on the limit (meaning
      // they can cover the target but only do up to 10% more than target, e.g. effectiveInternalCap >= target && effectiveInternalCap <= target * 1.1),
      // then we can add external capabilities (limiting internal allocation to 90% of target, so we add external to top up).
      // Otherwise, we maximize internal (so if it is under the need, we use its full capacity, and if it is well over, we cover the full target).
      let internalCapCeiling = effectiveInternalCap;
      if (effectiveInternalCap > target && effectiveInternalCap <= target * 1.1) {
        internalCapCeiling = Math.round(target * 0.90);
      }

      const takeInternal = Math.min(internalCapCeiling, remaining, internalAllocationLimit);
      allocatedInternal = takeInternal;
      remaining -= takeInternal;
    }

    // 3. Paid Vendor allocation (only for vendors WITHOUT manual override)
    if (remaining > 0) {
      const vendorPool = [];
      for (let i = 0; i < numVendors; i++) {
        const vIdx = i + 1;
        const overrideKey = `vendor${vIdx}PctOverride` as keyof FeasibilityRow;
        if (row[overrideKey] === undefined) {
          const slot = getSlotConfig(i);
          if (slot.isAddedManually) {
            continue;
          }
          const effectiveCap = Math.round(baseVendorCaps[i] * penaltyMultiplier);
          const cpiKey = `vendor${vIdx}Cpi` as keyof FeasibilityRow;
          const cpi = (row[cpiKey] as number) || 0;

          // Exclude vendor if its CPI exceeds our targeted CPI cap (if set and > 0)
          if (row.targetedCpi !== undefined && row.targetedCpi > 0 && cpi > row.targetedCpi) {
            continue;
          }

          vendorPool.push({
            idx: i,
            vIdx: vIdx,
            capacity: effectiveCap,
            cpi: cpi,
            name: getSlotConfig(i).name,
            tier: getSlotConfig(i).tier,
            color: getSlotConfig(i).color
          });
        }
      }

      let sortedPool = [...vendorPool];

      if (strategy === 'cost' || strategy === 'no-internal-cost') {
        sortedPool.sort((a, b) => {
          const aCpi = a.cpi <= 0 ? Infinity : a.cpi;
          const bCpi = b.cpi <= 0 ? Infinity : b.cpi;
          
          if (Math.abs(aCpi - bCpi) < 0.001) {
            // similar costs: prioritize capabilities (capacity) descending
            if (b.capacity !== a.capacity) {
              return b.capacity - a.capacity;
            }
            // then prioritize tier ascending (tier 1 is better than tier 2, etc.)
            const tA = pTier(a.tier);
            const tB = pTier(b.tier);
            if (tA !== tB) return tA - tB;

            // then color
            const cA = pColor(a.color || 'green');
            const cB = pColor(b.color || 'green');
            return cA - cB;
          }
          return aCpi - bCpi;
        });
      } else if (strategy === 'tier') {
        sortedPool.sort((a, b) => {
          const tA = pTier(a.tier);
          const tB = pTier(b.tier);
          if (tA !== tB) return tA - tB;

          const cA = pColor(a.color || 'green');
          const cB = pColor(b.color || 'green');
          if (cA !== cB) return cA - cB;

          const aCpi = a.cpi <= 0 ? Infinity : a.cpi;
          const bCpi = b.cpi <= 0 ? Infinity : b.cpi;
          if (Math.abs(aCpi - bCpi) < 0.001) {
            // similar costs: prioritize capabilities (capacity) descending
            return b.capacity - a.capacity;
          }
          return aCpi - bCpi;
        });
      }

      // Prioritize adding one vendor at a time to satisfy requirement
      const singleCoveringVendor = sortedPool.find(v => v.capacity >= remaining && v.cpi > 0 && v.capacity > 0);

      if (singleCoveringVendor) {
        const take = remaining;
        remaining = 0;
        allocatedVendors[singleCoveringVendor.idx] = take;
      } else {
        // Fallback to adding vendors one at a time from sorted pool
        for (const vendor of sortedPool) {
          if (remaining <= 0) break;
          if (vendor.capacity <= 0 || vendor.cpi <= 0) continue;

          const take = Math.min(vendor.capacity, remaining);
          remaining -= take;
          allocatedVendors[vendor.idx] = take;
        }
      }
    }

    // Determine how many panels are used in total
    let activePanels = 0;
    if (allocatedInternal > 0) activePanels++;
    allocatedVendors.forEach(val => {
      if (val > 0) activePanels++;
    });

    // RULE: Overlap percentages applied to drop feasibility
    let nextPenaltyPct = 0;
    if (row.overlapVariable !== undefined) {
      nextPenaltyPct = row.overlapVariable;
    } else {
      if (activePanels <= 1) {
        nextPenaltyPct = 0;
      } else if (activePanels === 2) {
        nextPenaltyPct = 20;
      } else if (activePanels === 3) {
        nextPenaltyPct = 25;
      } else if (activePanels === 4) {
        nextPenaltyPct = 30;
      } else if (activePanels === 5) {
        nextPenaltyPct = 35;
      } else if (activePanels === 6) {
        nextPenaltyPct = 40;
      } else {
        nextPenaltyPct = 50;
      }
    }

    if (nextPenaltyPct === currentPenaltyPct && activePanels === lastUsedPanelsCount) {
      break; 
    }

    currentPenaltyPct = nextPenaltyPct;
    lastUsedPanelsCount = activePanels;
  }

  const totalAllocated = allocatedInternal + allocatedVendors.reduce((acc, val) => acc + val, 0);
  const unfilledSample = target - totalAllocated;

  // External cost of vendors
  const externalCost = allocatedVendors.reduce((acc, val, i) => {
    const vIdx = i + 1;
    const cpiKey = `vendor${vIdx}Cpi` as keyof FeasibilityRow;
    const cpi = (row[cpiKey] as number) || 0;
    return acc + (val * cpi);
  }, 0);

  // Fixed internal panel cost for reference/internal calculation is 2 euros per respondent
  const internalCostRef = allocatedInternal * 2;

  // PM Fee & Comparability defaults
  const pmFee = row.pmFee !== undefined ? row.pmFee : 150;
  const comparability = row.comparability || 'High';

  // Sales CPI charged to the client
  const salesCpi = row.salesCpi !== undefined ? row.salesCpi : 7.50;

  const totalCost = externalCost + pmFee;

  // RULE: The weighted CPI always excludes the internal part.
  const totalVendorSample = allocatedVendors.reduce((acc, val) => acc + val, 0);
  const weightedCpi = totalVendorSample > 0 ? externalCost / totalVendorSample : 0;

  // Determine active vendors names list
  const activeVendorsList: string[] = [];
  allocatedVendors.forEach((val, i) => {
    if (val > 0) {
      activeVendorsList.push(getSlotConfig(i).name);
    }
  });
  const activeVendorsCsv = activeVendorsList.length > 0 ? activeVendorsList.join(', ') : 'None';

  const numVendorsUsed = activeVendorsList.length;
  const numPanelsUsed = (allocatedInternal > 0 ? 1 : 0) + numVendorsUsed;

  // Max Potential column represents the total (potentially penalized/un-penalized) specs potential
  let sumVendorCaps = 0;
  let potentialPanels = 0;
  if (row.internal > 0) potentialPanels++;

  for (let i = 0; i < numVendors; i++) {
    const vIdx = i + 1;
    const capKey = `vendor${vIdx}` as keyof FeasibilityRow;
    const cap = (row[capKey] as number) || 0;
    sumVendorCaps += cap;
    if (cap > 0) {
      potentialPanels++;
    }
  }

  let potentialPenaltyPct = 0;
  if (row.overlapVariable !== undefined) {
    potentialPenaltyPct = row.overlapVariable;
  } else {
    if (potentialPanels <= 1) {
      potentialPenaltyPct = 0;
    } else if (potentialPanels === 2) {
      potentialPenaltyPct = 20;
    } else if (potentialPanels === 3) {
      potentialPenaltyPct = 25;
    } else if (potentialPanels === 4) {
      potentialPenaltyPct = 30;
    } else if (potentialPanels === 5) {
      potentialPenaltyPct = 35;
    } else if (potentialPanels === 6) {
      potentialPenaltyPct = 40;
    } else {
      potentialPenaltyPct = 50;
    }
  }

  const maxPotential = Math.round((row.internal + sumVendorCaps) * (1 - potentialPenaltyPct / 100));

  // Share %
  const internalSharePct = totalAllocated > 0 ? Math.round((allocatedInternal / totalAllocated) * 100) : 0;
  const externalSharePct = totalAllocated > 0 ? Math.round((totalVendorSample / totalAllocated) * 100) : 0;

  // Operational Profit (OP)
  const totalRevenue = totalAllocated * salesCpi;
  const operationalProfit = totalRevenue - (externalCost + internalCostRef + pmFee);

  let status: 'Fully Feasible' | 'Partially Feasible' | 'Unfeasible' | 'Oversample' = 'Fully Feasible';
  if (totalAllocated > target) {
    status = 'Oversample';
  } else if (unfilledSample > 0) {
    if (totalAllocated > 0) {
      status = 'Partially Feasible';
    } else {
      status = 'Unfeasible';
    }
  }

  const result: any = {
    rowId: row.id,
    allocatedInternal,
    allocatedVendor1: allocatedVendors[0] || 0,
    allocatedVendor2: allocatedVendors[1] || 0,
    allocatedVendor3: allocatedVendors[2] || 0,
    allocatedVendor4: allocatedVendors[3] || 0,
    totalAllocated,
    unfilledSample,
    externalCost,
    internalCostRef,
    totalCost,
    weightedCpi,
    overlapPenaltyPct: currentPenaltyPct,
    numPanelsUsed,
    numVendorsUsed,
    maxPotential,
    internalSharePct,
    externalSharePct,
    activeVendorsCsv,
    operationalProfit,
    salesCpi,
    pmFee,
    comparability,
    status
  };

  for (let i = 4; i < numVendors; i++) {
    result[`allocatedVendor${i+1}`] = allocatedVendors[i] || 0;
  }

  return result as AllocationResult;
}

export function calculateAllRows(
  rows: FeasibilityRow[],
  strategy: StrategyType,
  vendors?: VendorTier[],
  allowSameLineTwice: boolean = false
): AllocationResult[] {
  return rows.map((row) => calculateRowAllocation(row, strategy, vendors));
}

export function calculateOptimizedAllocations(
  rows: FeasibilityRow[],
  strategy: StrategyType,
  vendors?: VendorTier[],
  targetedBudget?: number,
  allowSameLineTwice: boolean = false
): AllocationResult[] {
  const results = rows.map(r => calculateRowAllocation(r, strategy, vendors, true));

  // Second, check total targeted budget constraint if defined
  if (targetedBudget !== undefined && targetedBudget > 0) {
    const totalCost = results.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    if (totalCost > targetedBudget) {
      const rowComparisons = rows.map((row, idx) => {
        const opt = results[idx];
        const standardRow = { 
          ...row, 
          maxInternalPercent: 100
        };
        const numVendors = vendors ? vendors.length : 4;
        delete standardRow.targetedCpi;
        for (let i = 1; i <= numVendors; i++) {
          delete (standardRow as any)[`vendor${i}PctOverride`];
          (standardRow as any)[`vendor${i}Pct`] = 100;
        }

        const std = calculateRowAllocation(standardRow, 'cost', vendors, false);
        const diffCost = (opt.totalCost || 0) - (std.totalCost || 0);
        return { row, idx, opt, std, diffCost };
      });

      const candidates = rowComparisons.filter(c => c.diffCost > 0);
      candidates.sort((a, b) => b.diffCost - a.diffCost);

      let currentTotalCost = totalCost;
      for (const item of candidates) {
        if (currentTotalCost <= targetedBudget) break;
        results[item.idx] = item.std;
        currentTotalCost -= item.diffCost;
      }
    }
  }

  return results;
}

/**
 * Deduplicates matched database rows that represent the same specifications.
 * This prevents double-counting of capabilities (both internal and vendor capacities)
 * when multiple identical or redundant entries match a single specifications line.
 */
export function deduplicateDbRows(rows: any[]): any[] {
  const seenSpecs = new Map<string, any>();

  const cleanPercent = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    if (str.includes('%')) {
      const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
      return isNaN(num) ? 0 : num / 100;
    }
    const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) return 0;
    return num > 1 ? num / 100 : num;
  };

  const cleanLoi = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  for (const r of rows) {
    if (!r) continue;
    const market = String(r.market || r.Country || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const loi = cleanLoi(r.loi !== undefined ? r.loi : r.LOI);
    
    const irVal = r.irPercent !== undefined ? r.irPercent : (r['ir%'] !== undefined ? r['ir%'] : (r.irPercentDecimal !== undefined ? r.irPercentDecimal : 0));
    const ir = cleanPercent(irVal);

    // Identify duplicates strictly by Country/Market, LOI, and IR%
    const specKey = `${market}|${loi}|${ir.toFixed(4)}`;

    if (seenSpecs.has(specKey)) {
      const existing = seenSpecs.get(specKey)!;
      const existingInternal = Number(existing.internal || 0);
      const currentInternal = Number(r.internal || 0);
      
      // Keep the one with the higher internal capability to ensure accurate max limits
      if (currentInternal > existingInternal) {
        seenSpecs.set(specKey, r);
      }
    } else {
      seenSpecs.set(specKey, r);
    }
  }

  return Array.from(seenSpecs.values());
}

