import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FeasibilityRow, AllocationResult, ChatMessage, StrategyType, VendorTier } from '../types';
import { ALL_COUNTRIES, getCanonicalCountryName, isValidCountry } from '../data/countries';
import { findBestDbMatches, normalizeLoi, normalizeIr } from '../lib/matching';
import { calculateRowAllocation, deduplicateDbRows } from '../lib/calculator';
import { DEFAULT_VENDORS } from '../data/defaultData';
import { getCountrySpecsByUniverse, getCountryPreExistingSpecs, ATTACHED_REFERENCE_SPECS, ALL_DB_COUNTRIES, getDbCountries } from '../data/attachedSpecsData';
import { ATTACHED_VENDOR_TIERS, getAuthoritativeVendorConfig } from '../data/vendorTiersData';
import { parseNaturalLanguageSpecs } from '../lib/chatParser';
import { processRuleBasedQuery } from '../lib/ruleEngine';
import ComboboxCell from './ComboboxCell';
import { 
  Bot, 
  Send, 
  RefreshCw, 
  Clock, 
  X, 
  Move, 
  Plus, 
  Check, 
  CheckCircle2,
  Sparkles,
  Play,
  RotateCcw,
  Target
} from 'lucide-react';

interface ChatPaneProps {
  pitches: FeasibilityRow[];
  insertedDatabase?: FeasibilityRow[] | null;
  allocations: AllocationResult[];
  activeStrategy: string;
  vendors?: VendorTier[];
  vendorOverrides?: Record<string, VendorTier>;
  onUpdatePitches?: (updated: FeasibilityRow[], preserveHasChecked?: boolean) => void;
  // Lifted state props for continuous history support
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onUpdateStrategy?: (strategy: StrategyType) => void;
  onRunCheapestWithMode?: (mode: 'reset' | 'keep') => void;
  // Floating support parameters
  isFloating?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function ChatPane({
  pitches,
  insertedDatabase,
  allocations,
  activeStrategy,
  vendors = [],
  vendorOverrides = {},
  onUpdatePitches,
  messages,
  setMessages,
  onUpdateStrategy,
  onRunCheapestWithMode,
  isFloating = false,
  isOpen = true,
  onClose
}: ChatPaneProps) {
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [addedRowNotice, setAddedRowNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Floating positioning state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 440, height: 570 });

  useEffect(() => {
    if (isFloating) {
      // Center-right align initially
      const initX = Math.max(20, window.innerWidth - 450);
      const initY = Math.max(20, window.innerHeight - 560);
      setPosition({ x: initX, y: initY });
    }
  }, [isFloating]);

  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const chatPosRef = useRef({ x: 0, y: 0 });

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (!isFloating) return;
    if (e.button !== 0) return; // Only left click
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    chatPosRef.current = { x: position.x, y: position.y };
    e.preventDefault();
  };

  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0 });
  const chatSizeRef = useRef({ width: 0, height: 0 });

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (!isFloating) return;
    if (e.button !== 0) return;
    resizingRef.current = true;
    resizeStartRef.current = { x: e.clientX, y: e.clientY };
    chatSizeRef.current = { width: size.width, height: size.height };
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current && isFloating) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        // Boundaries checks
        const newX = Math.max(5, Math.min(window.innerWidth - 150, chatPosRef.current.x + deltaX));
        const newY = Math.max(5, Math.min(window.innerHeight - 100, chatPosRef.current.y + deltaY));
        setPosition({ x: newX, y: newY });
      }

      if (resizingRef.current && isFloating) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        
        const newWidth = Math.max(340, Math.min(1000, chatSizeRef.current.width + deltaX));
        const newHeight = Math.max(380, Math.min(900, chatSizeRef.current.height + deltaY));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = false;
      resizingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isFloating]);

  // Auto-scroll to latest chat bubble
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // List of canonical countries present in DB + any inserted database
  const allDbCountries = useMemo(() => {
    return getDbCountries(insertedDatabase);
  }, [insertedDatabase]);

  const [selectedCountry, setSelectedCountry] = useState<string>(() => {
    return allDbCountries.includes('United Kingdom') ? 'United Kingdom' : (allDbCountries[0] || 'United Kingdom');
  });

  const [targetSize, setTargetSize] = useState<number>(1000);

  // Compute country specs based on selectedCountry
  const countrySpecs = useMemo(() => {
    return getCountrySpecsByUniverse(selectedCountry, undefined, insertedDatabase || undefined);
  }, [selectedCountry, insertedDatabase]);

  const [selectedUniverse, setSelectedUniverse] = useState<string>(() => {
    return countrySpecs.preExistingUniverses[0] || 'gen pop';
  });

  const initialUniSpecs = getCountrySpecsByUniverse(selectedCountry, selectedUniverse, insertedDatabase || undefined);
  const initialDefaultIr = initialUniSpecs.preExistingIrs[0] || initialUniSpecs.irDropdownOptions[0] || '30%';

  const [selectedIr, setSelectedIr] = useState<string>(() => initialDefaultIr);

  const [selectedLoi, setSelectedLoi] = useState<number>(() => {
    const firstIrSpecs = getCountrySpecsByUniverse(selectedCountry, selectedUniverse, insertedDatabase || undefined, initialDefaultIr);
    return firstIrSpecs.preExistingLois[0] || firstIrSpecs.loiDropdownOptions[0] || 15;
  });

  const pitchSpecs = useMemo(() => {
    return getCountrySpecsByUniverse(selectedCountry, selectedUniverse, insertedDatabase || undefined, selectedIr, selectedLoi);
  }, [selectedCountry, selectedUniverse, insertedDatabase, selectedIr, selectedLoi]);

  const [selectedQuotas, setSelectedQuotas] = useState<string>(() => {
    return pitchSpecs.preExistingQuotas[0] || pitchSpecs.quotaDropdownOptions[0] || 'No quotas';
  });

  const [targetedCpi, setTargetedCpi] = useState<string>('');
  const [latestQueryPitch, setLatestQueryPitch] = useState<FeasibilityRow | null>(null);

  const handleCountryChange = (newCountry: string) => {
    const canonical = getCanonicalCountryName(newCountry) || newCountry;
    setSelectedCountry(canonical);
    const specs = getCountrySpecsByUniverse(canonical, undefined, insertedDatabase || undefined);
    const newUni = specs.preExistingUniverses[0] || '';
    setSelectedUniverse(newUni);
    const uniSpecs = getCountrySpecsByUniverse(canonical, newUni, insertedDatabase || undefined);
    const nextIr = uniSpecs.preExistingIrs[0] || '';
    setSelectedIr(nextIr);
    const irSpecs = getCountrySpecsByUniverse(canonical, newUni, insertedDatabase || undefined, nextIr);
    const nextLoi = irSpecs.preExistingLois[0] || 0;
    setSelectedLoi(nextLoi);
    const finalSpecs = getCountrySpecsByUniverse(canonical, newUni, insertedDatabase || undefined, nextIr, nextLoi);
    setSelectedQuotas(finalSpecs.preExistingQuotas[0] || 'No quotas');
  };

  const handleUniverseChange = (newUni: string) => {
    const cleanUni = String(newUni || '').toLowerCase().startsWith('insert') ? '' : newUni.trim();
    setSelectedUniverse(cleanUni);
    const uniSpecs = getCountrySpecsByUniverse(selectedCountry, cleanUni, insertedDatabase || undefined);
    const nextIr = uniSpecs.preExistingIrs.length > 0 && uniSpecs.preExistingIrs.includes(selectedIr)
      ? selectedIr
      : (uniSpecs.preExistingIrs[0] || selectedIr);
    if (nextIr !== selectedIr) setSelectedIr(nextIr);
    const irSpecs = getCountrySpecsByUniverse(selectedCountry, cleanUni, insertedDatabase || undefined, nextIr);
    const nextLoi = irSpecs.preExistingLois.length > 0 && irSpecs.preExistingLois.includes(Number(selectedLoi))
      ? Number(selectedLoi)
      : (irSpecs.preExistingLois[0] || Number(selectedLoi));
    if (nextLoi !== selectedLoi) setSelectedLoi(nextLoi);
    const finalSpecs = getCountrySpecsByUniverse(selectedCountry, cleanUni, insertedDatabase || undefined, nextIr, nextLoi);
    if (finalSpecs.preExistingQuotas.length > 0 && !finalSpecs.preExistingQuotas.includes(selectedQuotas)) {
      setSelectedQuotas(finalSpecs.preExistingQuotas[0]);
    }
  };

  const handleInstantCheck = () => {
    const numTarget = Number(targetSize) || 0;
    const numLoi = Number(selectedLoi) || 0;
    const rawIr = selectedIr || '0%';
    const numTargetedCpi = targetedCpi.trim() !== '' ? parseFloat(targetedCpi) : undefined;

    executeQueryCalculation({
      country: selectedCountry,
      universe: selectedUniverse,
      loi: numLoi,
      irRaw: rawIr,
      quotas: selectedQuotas,
      targetSize: numTarget,
      targetedCpi: numTargetedCpi
    });
  };

  // Execute database-backed feasibility calculation for parsed specs
  const executeQueryCalculation = (specs: {
    country: string;
    universe: string;
    loi: number;
    irRaw: string;
    quotas: string;
    targetSize: number;
    targetedCpi?: number;
    maxInternalPercent?: number;
    maxExternalCpi?: number;
  }) => {
    const normLoi = normalizeLoi(specs.loi);
    const normIr = normalizeIr(specs.irRaw);

    const queryRow: FeasibilityRow = {
      id: `row-chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      pitchName: 'Chat Feasibility',
      source: 'Chat Assistant Query',
      option: String(pitches.length + 1),
      market: specs.country,
      target: specs.universe || '',
      loi: normLoi,
      irPercent: normIr,
      irUniverse: specs.universe || '',
      quotas: specs.quotas || 'No quotas',
      waves: 1,
      totalFreshSample: specs.targetSize,
      totalSampleSize: specs.targetSize,
      internal: 0,
      maxInternalPercent: specs.maxInternalPercent !== undefined && specs.maxInternalPercent < 100 ? specs.maxInternalPercent : undefined,
      vendor1: 0,
      vendor1Cpi: 0,
      vendor2: 0,
      vendor2Cpi: 0,
      vendor3: 0,
      vendor3Cpi: 0,
      vendor4: 0,
      vendor4Cpi: 0,
      vendor1Pct: 100,
      vendor2Pct: 100,
      vendor3Pct: 100,
      vendor4Pct: 100,
      pmFee: 150,
      salesCpi: specs.targetedCpi !== undefined && specs.targetedCpi > 0 ? specs.targetedCpi : 7.50,
      targetedCpi: specs.targetedCpi,
      comparability: 'High'
    };

    const dbPool: FeasibilityRow[] = (insertedDatabase && insertedDatabase.length > 0)
      ? insertedDatabase
      : ATTACHED_REFERENCE_SPECS.map((spec, idx) => ({
          id: `ref-db-${idx}`,
          pitchName: `Ref Spec ${idx + 1}`,
          source: 'System DB',
          option: String(idx + 1),
          market: spec.market,
          target: spec.universe,
          loi: spec.loi,
          irPercent: parseFloat(String(spec.irRaw || '0').replace('%', '')) / 100 || 0,
          irUniverse: spec.universe,
          quotas: spec.quotas || 'No quotas',
          waves: 1,
          totalFreshSample: 1000,
          totalSampleSize: 1000,
          internal: 3000,
          vendor1: 2000,
          vendor1Cpi: 4.5,
          vendor2: 1200,
          vendor2Cpi: 6.0,
          vendor3: 800,
          vendor3Cpi: 7.5,
          vendor4: 500,
          vendor4Cpi: 9.0,
          vendor1Pct: 100,
          vendor2Pct: 100,
          vendor3Pct: 100,
          vendor4Pct: 100,
          pmFee: 150,
          salesCpi: 7.50,
          comparability: 'High'
        }));

    const matches = findBestDbMatches(queryRow, deduplicateDbRows(dbPool), new Set<string>());
    const uiVendorsList = vendors && vendors.length > 0 ? vendors : DEFAULT_VENDORS;

    // Build complete backend vendor pool (1..166+) independent of narrowed UI vendor columns,
    // preserving Partner Mapping overrides (including persisted Do not use / Red bans) by vendor name.
    const vendorOverrideMap = new Map<string, VendorTier>();
    Object.entries(vendorOverrides || {}).forEach(([k, v]) => {
      vendorOverrideMap.set(k.toLowerCase().trim(), v);
    });
    (vendors || []).forEach(v => {
      const k = v.name.toLowerCase().trim();
      if (!vendorOverrideMap.has(k)) {
        vendorOverrideMap.set(k, v);
      }
    });
    const maxVendorNumInDb = dbPool.reduce((maxNum, row) => {
      let rowMax = maxNum;
      for (const k of Object.keys(row)) {
        const m = k.match(/^vendor(\d+)$/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > rowMax) rowMax = n;
        }
      }
      return rowMax;
    }, ATTACHED_VENDOR_TIERS.length);

    const isVendorBanned = (v: VendorTier): boolean => {
      const tierLower = String(v.tier || '').toLowerCase();
      const colorLower = String(v.color || '').toLowerCase();
      return tierLower.includes('do not use') || colorLower === 'red';
    };

    const pTierVal = (tierStr: string): number => {
      const t = String(tierStr || '').toLowerCase();
      if (t.includes('do not use')) return 999;
      if (t.includes('0') || t.includes('prime')) return 0;
      if (t.includes('1')) return 1;
      if (t.includes('2')) return 2;
      if (t.includes('3')) return 3;
      return 4;
    };

    const pColorVal = (colorStr: string): number => {
      const c = String(colorStr || '').toLowerCase();
      if (c.includes('red')) return 999;
      if (c.includes('green')) return 1;
      if (c.includes('yellow')) return 2;
      if (c.includes('orange')) return 3;
      if (c.includes('grey') || c.includes('gray')) return 4;
      return 5;
    };

    const fullVendorEntries: { dbNum: number; config: VendorTier }[] = [];
    for (let num = 1; num <= maxVendorNumInDb; num++) {
      const nameKey = `vendor ${num}`;
      const override = vendorOverrideMap.get(nameKey);
      const cfg: VendorTier = override
        ? { ...override, isAddedManually: false }
        : getAuthoritativeVendorConfig(num);
      if (!isVendorBanned(cfg)) {
        fullVendorEntries.push({ dbNum: num, config: cfg });
      }
    }

    fullVendorEntries.sort((a, b) => {
      const tA = pTierVal(a.config.tier);
      const tB = pTierVal(b.config.tier);
      if (tA !== tB) return tA - tB;
      const cA = pColorVal(a.config.color);
      const cB = pColorVal(b.config.color);
      if (cA !== cB) return cA - cB;
      return a.dbNum - b.dbNum;
    });

    const fullVendorsList = fullVendorEntries.map(e => e.config);
    const calcRow: any = { ...queryRow };

    if (matches.length > 0) {
      const deduplicatedMatches = deduplicateDbRows(matches);
      let aggregatedInternal = 0;
      const aggregatedByDbNum: { [dbNum: number]: number } = {};
      const aggregatedCpiByDbNum: { [dbNum: number]: number } = {};

      deduplicatedMatches.forEach(mr => {
        // IR reduction factor: if incidence requested is lower by up to -10%,
        // feasibility generated is reduced by this percentage to reflect reality!
        const reductionFactor = mr._matchMetadata?.irReductionFactor ?? 1.0;
        const reducedInternal = Math.round((mr.internal || 0) * reductionFactor);
        if (reducedInternal > aggregatedInternal) {
          aggregatedInternal = reducedInternal;
        }

        for (const entry of fullVendorEntries) {
          const vendorNumInDb = entry.dbNum;
          const dbCapKey = `vendor${vendorNumInDb}`;
          const dbCpiKey = `vendor${vendorNumInDb}Cpi`;

          const cpiVal = parseFloat((mr as any)[dbCpiKey]);

          // Exclude vendor if rate exceeds user's max external CPI constraint
          if (specs.maxExternalCpi !== undefined && cpiVal > specs.maxExternalCpi) {
            continue;
          }

          const rawCap = Number((mr as any)[dbCapKey]) || 0;
          const vendorCap = Math.round(rawCap * reductionFactor);

          // Across lines, vendors are NOT duplicated: take highest capacity and best CPI
          const existCap = aggregatedByDbNum[vendorNumInDb] || 0;
          const existCpi = aggregatedCpiByDbNum[vendorNumInDb] || 0;

          if (vendorCap > existCap) {
            aggregatedByDbNum[vendorNumInDb] = vendorCap;
            if (cpiVal > 0) {
              aggregatedCpiByDbNum[vendorNumInDb] = cpiVal;
            }
          } else if (vendorCap === existCap && vendorCap > 0 && cpiVal > 0 && (existCpi === 0 || cpiVal < existCpi)) {
            aggregatedCpiByDbNum[vendorNumInDb] = cpiVal;
          }
        }
      });

      queryRow.internal = aggregatedInternal;
      calcRow.internal = aggregatedInternal;

      const matchWithLoiMarkup = deduplicatedMatches.find(mr => mr._matchMetadata?.hasLoiMarkup);
      if (matchWithLoiMarkup) {
        queryRow.hasLoiMarkup = true;
        queryRow.loiDiff = matchWithLoiMarkup._matchMetadata?.loiDiff;
        queryRow.matchedDbLoi = matchWithLoiMarkup._matchMetadata?.matchedDbLoi;
        calcRow.hasLoiMarkup = true;
        calcRow.loiDiff = queryRow.loiDiff;
        calcRow.matchedDbLoi = queryRow.matchedDbLoi;
      }

      const matchWithIrReduction = deduplicatedMatches.find(mr => (mr._matchMetadata?.irReductionPct || 0) > 0);
      if (matchWithIrReduction) {
        queryRow.irReductionPct = matchWithIrReduction._matchMetadata?.irReductionPct;
        calcRow.irReductionPct = queryRow.irReductionPct;
      }

      // Populate calcRow across all 1..166+ non-banned vendors in priority order
      for (let idx = 0; idx < fullVendorEntries.length; idx++) {
        const vIdx = idx + 1;
        const dbNum = fullVendorEntries[idx].dbNum;
        calcRow[`vendor${vIdx}`] = aggregatedByDbNum[dbNum] || 0;
        calcRow[`vendor${vIdx}Cpi`] = aggregatedCpiByDbNum[dbNum] || 0;
        calcRow[`vendor${vIdx}Pct`] = 100;
      }

      // Also populate queryRow slots aligned to current UI vendors (for Add as New Line before re-check)
      for (let idx = 0; idx < uiVendorsList.length; idx++) {
        const vIdx = idx + 1;
        const vendorObj = uiVendorsList[idx];
        if (isVendorBanned(vendorObj)) {
          (queryRow as any)[`vendor${vIdx}`] = 0;
          (queryRow as any)[`vendor${vIdx}Cpi`] = 0;
          continue;
        }
        const matchNum = vendorObj.name.toLowerCase().match(/\d+/);
        const dbNum = matchNum ? parseInt(matchNum[0], 10) : vIdx;
        (queryRow as any)[`vendor${vIdx}`] = aggregatedByDbNum[dbNum] || 0;
        (queryRow as any)[`vendor${vIdx}Cpi`] = aggregatedCpiByDbNum[dbNum] || 0;
      }
    }

    const alloc = calculateRowAllocation(calcRow, activeStrategy as StrategyType, fullVendorsList);

    // Build rich, clear explanations of procurement rules in English
    const loiExplanation = queryRow.hasLoiMarkup
      ? `⚠️ **LOI Assumption (+10% mark-up)**: Requested LOI (${normLoi}m) is higher by +${queryRow.loiDiff}m than database reference (${queryRow.matchedDbLoi}m). Applied a +10% safety mark-up on Weighted CPI.`
      : (queryRow.loiDiff
        ? `✅ **LOI Proximity**: Requested LOI (${normLoi}m) is lower by ${queryRow.loiDiff}m than database reference (${queryRow.matchedDbLoi}m <= 10m difference). Quoted at standard database price without penalty.`
        : `✅ **LOI**: Exact match (${normLoi} min).`);

    const irExplanation = (queryRow.irReductionPct || 0) > 0
      ? `📉 **Incidence Adjustment (-${queryRow.irReductionPct}%)**: Requested incidence (${Math.round(normIr * 100)}%) is lower than database reference (within -10% threshold). Feasibility is adjusted by the ratio (${Math.round(normIr * 100)}% / DB_IR), multiplied by ${(1 - (queryRow.irReductionPct / 100)).toFixed(2)}x (-${queryRow.irReductionPct}% reduction).`
      : `🎯 **Incidence**: ${Math.round(normIr * 100)}% (standard coverage or higher incidence than database -> no reduction factor applied).`;

    const quotaExplanation = String(specs.quotas).toLowerCase() === 'no quotas'
      ? `📋 **Quotas ('No quotas')**: Option without quotas accepts and utilizes any database record for this universe.`
      : `📋 **Quotas**: Selected "${specs.quotas}".`;

    const statusBadge = alloc.status === 'Fully Feasible' 
      ? '🟢 FULLY FEASIBLE (100% Covered)' 
      : (alloc.status === 'Partially Feasible' 
        ? '🟡 PARTIALLY FEASIBLE (Deficit)' 
        : '🔴 UNFEASIBLE (0 Output)');

    const customConstraintsBlock = (specs.maxInternalPercent !== undefined || specs.maxExternalCpi !== undefined) ? `
* **Custom Constraints Applied**:
${specs.maxInternalPercent !== undefined ? `  * **Max Internal Panel Share**: Capped at **${specs.maxInternalPercent}%** (max ${Math.round(specs.targetSize * (specs.maxInternalPercent / 100))} completes from internal panel)\n` : ''}${specs.maxExternalCpi !== undefined ? `  * **Max External CPI Limit**: Filtered to **≤ €${specs.maxExternalCpi.toFixed(2)}** (vendors charging > €${specs.maxExternalCpi.toFixed(2)} excluded)\n` : ''}` : '';

    const responseText = `### 🎯 Feasibility & Quote Assessment: ${specs.country}

* **Evaluated Specifications**:
  * **Country**: ${specs.country}
  * **Target Size (N)**: **${specs.targetSize}** completes
  * **Universe**: ${specs.universe || 'All available variables'}
  * **LOI**: **${normLoi} min**
  * **Incidence (IR%)**: **${Math.round(normIr * 100)}%**
  * **Quotas**: ${specs.quotas}${customConstraintsBlock}

---

### 📊 Calculation & Allocation Summary
* **Status**: **${statusBadge}**
* **Delivered Feasibility**: **${alloc.totalAllocated}** of **${specs.targetSize}** (${specs.targetSize > 0 ? Math.round((alloc.totalAllocated / specs.targetSize) * 100) : 0}% coverage)
* **Missing Completes**: **${alloc.unfilledSample}** (${specs.targetSize > 0 ? Math.round((alloc.unfilledSample / specs.targetSize) * 100) : 0}% missing)
* **Internal Panel**: **${alloc.allocatedInternal}** completes (${alloc.internalSharePct}%)
* **External Vendors**: **${alloc.totalAllocated - alloc.allocatedInternal}** completes (${alloc.externalSharePct}%)
* **Active Vendors Used**: **${alloc.numVendorsUsed}** (${alloc.activeVendorsCsv})
* **Weighted CPI**: **$${alloc.weightedCpi.toFixed(2)}** ${alloc.hasLoiMarkup ? '*(⚠️ includes +10% LOI mark-up)*' : ''}
${specs.targetedCpi !== undefined && specs.targetedCpi > 0 ? `* **Targeted CPI**: **$${specs.targetedCpi.toFixed(2)}** (${alloc.weightedCpi <= specs.targetedCpi ? '✅ Within target CPI' : `⚠️ Exceeds target by +$${(alloc.weightedCpi - specs.targetedCpi).toFixed(2)}`})\n` : `* **Targeted CPI**: **-**\n`}* **PM Fee**: **$${alloc.pmFee}**
* **Total External Spend**: **$${alloc.totalCost.toFixed(2)}** (excl. PM fee: $${alloc.externalCost.toFixed(2)})
* **Operational Profit (OP)**: **${alloc.operationalProfit >= 0 ? '+' : ''}$${alloc.operationalProfit.toFixed(2)}**

---

### ⚖️ Applied Procurement Rules
* ${loiExplanation}
* ${irExplanation}
* ${quotaExplanation}
${matches.length === 0 ? '\n⚠️ *Notice*: No matching database record found for these specifications (or universe/country is not in database).' : ''}`;

    setLatestQueryPitch(queryRow);

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-query`,
      role: 'model',
      text: responseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      queryPitch: queryRow
    };

    setMessages(prev => [...prev, newMsg]);
  };

  const handleCheapestOverrideChoice = (msgId: string, mode: 'reset' | 'keep') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, cheapestPromptResolved: mode } : m))
    );
    if (onRunCheapestWithMode) {
      onRunCheapestWithMode(mode);
    }
    const confirmMsg: ChatMessage = {
      id: `msg-${Date.now()}-cheapest-confirm`,
      role: 'model',
      text:
        mode === 'reset'
          ? "### ✅ Cheapest Version Applied (Overrides Reset)\n\nAll manual overrides have been cleared, the strategy has been switched to **Cost-Optimized (Lowest CPI)**, and feasibility has been recalculated from the database for the lowest total cost."
          : "### ✅ Feasibility Optimized Applied (Overrides Preserved)\n\nYour manual overrides have been preserved, the strategy has been switched to **Cost-Optimized**, and the remaining feasibility has been verified using the **Feasibility Optimized** verification rules.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputVal;
    if (!textToSend.trim() || loading) return;

    if (!customText) {
      setInputVal('');
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Check if user is replying via text to an unresolved cheapest-version override prompt
    const pendingPromptMsg = [...messages].reverse().find(
      (m) => m.role === 'model' && m.cheapestOverridePrompt && !m.cheapestPromptResolved
    );
    if (pendingPromptMsg) {
      const normalizedReply = textToSend
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const hasExplicitKeep = /\b(keep|pastreaza|pastram|pastrez|pastrati|preserve|optimized|optimizat|ramane|raman|restul)\b/.test(normalizedReply);
      const hasExplicitReset = /\b(reset|reseteaza|resetam|clear|remove|anuleaza|anulam|anulez|anulate|sterge|stergem|sterg|elimina|eliminam)\b/.test(normalizedReply);
      const hasNegatedKeep = /\b(nu|dont|don't|do not|fara)\s+(le\s+)?(keep|pastreaza|pastram|pastrez|pastra|preserve)\b/.test(normalizedReply);
      const hasNegatedReset = /\b(nu|dont|don't|do not)\s+(le\s+)?(reset|reseteaza|resetam|reseta|anuleaza|anulam|anula|sterge|stergem|elimina)\b/.test(normalizedReply);

      const wantsReset =
        !hasNegatedReset &&
        (hasExplicitReset ||
          hasNegatedKeep ||
          (/\b(cheapest|ieftin|ieftina|da|yes)\b/.test(normalizedReply) && !hasExplicitKeep && !/\b(nu|no)\b/.test(normalizedReply)));
      const wantsKeep =
        !wantsReset &&
        (hasExplicitKeep || hasNegatedReset || /\b(nu|no)\b/.test(normalizedReply));

      if (wantsReset || wantsKeep) {
        setMessages((prev) => [...prev, userMsg]);
        handleCheapestOverrideChoice(pendingPromptMsg.id, wantsReset ? 'reset' : 'keep');
        return;
      }
    }

    setMessages((prev) => [...prev, userMsg]);

    // Extract specs deterministically with ZERO fabricated defaults / assumptions
    const parsed = parseNaturalLanguageSpecs(textToSend, insertedDatabase || undefined);
    if (parsed.isFeasibilityQuery) {
      if (parsed.missingFields.length > 0) {
        const dbCountrySpecs = parsed.country
          ? getCountryPreExistingSpecs(parsed.country, insertedDatabase || undefined)
          : null;

        const recognizedLines = [
          `* **Country**: ${parsed.country || '*(missing)*'}`,
          `* **Target Size**: ${parsed.targetSize > 0 ? `**${parsed.targetSize}**` : '*(missing)*'}`,
          `* **IR Universe**: ${parsed.universe || '*(missing)*'}`,
          `* **IR%**: ${parsed.irRaw ? `**${parsed.irRaw}**` : '*(missing)*'}`,
          `* **LOI**: ${parsed.loi > 0 ? `**${parsed.loi} min**` : '*(missing)*'}`,
          `* **Quotas**: ${parsed.quotas || 'No quotas *(default when omitted)*'}`
        ].join('\n');

        const dbHintBlock = dbCountrySpecs && (
          dbCountrySpecs.universes.length > 0 ||
          dbCountrySpecs.irs.length > 0 ||
          dbCountrySpecs.lois.length > 0
        )
          ? `\n\n### 🗄️ Available Database Variables for ${parsed.country}\n` +
            `* **IR Universes**: ${dbCountrySpecs.universes.length > 0 ? dbCountrySpecs.universes.join(', ') : 'None in active DB'}\n` +
            `* **IR%**: ${dbCountrySpecs.irs.length > 0 ? dbCountrySpecs.irs.join(', ') : 'None in active DB'}\n` +
            `* **LOI (min)**: ${dbCountrySpecs.lois.length > 0 ? dbCountrySpecs.lois.map(l => `${l}m`).join(', ') : 'None in active DB'}\n` +
            `* **Quotas**: ${dbCountrySpecs.quotas.length > 0 ? dbCountrySpecs.quotas.join(', ') : 'No quotas'}`
          : (parsed.country ? `\n\n⚠️ *Notice*: **${parsed.country}** has no pre-existing records in the active database.` : '');

        const missingMsg: ChatMessage = {
          id: `msg-${Date.now()}-missing`,
          role: 'model',
          text: `### ⚠️ Incomplete Specifications — No Assumptions Applied\n\nTo avoid guessing capabilities, please provide all required parameters:\n* **Missing Fields**: **${parsed.missingFields.join(', ')}**\n\n### 📋 Recognized Input\n${recognizedLines}${dbHintBlock}\n\n💡 You can include the missing parameters in your message or select them directly from the **Predefined Specifications Generator** dropdowns above.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, missingMsg]);
        return;
      }

      executeQueryCalculation({
        country: parsed.country,
        universe: parsed.universe,
        loi: parsed.loi,
        irRaw: parsed.irRaw,
        quotas: parsed.quotas || 'No quotas',
        targetSize: parsed.targetSize,
        targetedCpi: parsed.targetedCpi,
        maxInternalPercent: parsed.maxInternalPercent,
        maxExternalCpi: parsed.maxExternalCpi
      });
      return;
    }

    setLoading(true);

    try {
      // The rule engine of the original /api/chat route runs in the browser (see lib/ruleEngine.ts).
      // Pitches and allocations go through JSON like the old request did, so the engine works on
      // copies; the (large, read-only) database is passed by reference instead of being uploaded.
      let responseData: any;
      try {
        responseData = JSON.parse(JSON.stringify(processRuleBasedQuery(
          JSON.parse(JSON.stringify([...messages, userMsg].map(m => ({ role: m.role, text: m.text })))),
          {
            pitches: JSON.parse(JSON.stringify(pitches)),
            allocations: JSON.parse(JSON.stringify(allocations)),
            insertedDatabase: insertedDatabase || [],
            vendors: vendors && vendors.length > 0 ? JSON.parse(JSON.stringify(vendors)) : [
              { name: 'Vendor 1', tier: 'tier 0' },
              { name: 'Vendor 2', tier: 'tier 1' },
              { name: 'Vendor 3', tier: 'tier 2' },
              { name: 'Vendor 4', tier: 'tier 3' }
            ]
          },
          activeStrategy
        )));
      } catch (engineErr) {
        console.error("Local rule-based engine error:", engineErr);
        responseData = {
          text: "### ⚠️ System Notice\n\nAn unexpected error occurred while processing your request locally.",
          updatedPitches: null
        };
      }
      
      // If server modified the data state, trigger parent update!
      if (responseData.updatedPitches && Array.isArray(responseData.updatedPitches)) {
        if (onUpdatePitches) {
          onUpdatePitches(responseData.updatedPitches);
        }
      }

      // If server updated activeStrategy, trigger parent update!
      if (responseData.updateStrategy && onUpdateStrategy) {
        onUpdateStrategy(responseData.updateStrategy);
      }
      
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-model`,
        role: 'model',
        text: responseData.text || "I was unable to draft an answer. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cheapestOverridePrompt: Boolean(responseData.requiresOverrideChoice)
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-err`,
          role: 'model',
          text: `⚠️ **Connection Error**: ${err.message || "Failed to reach the server."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };



  if (isFloating && !isOpen) {
    return null;
  }

  return (
    <div 
      className={`bg-white rounded-xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all ${
        isFloating ? 'fixed select-none' : 'h-[650px] w-full'
      }`} 
      id="chat-pane-box"
      style={isFloating ? {
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 9999
      } : undefined}
    >
      {/* Header */}
      <div 
        onMouseDown={handleHeaderMouseDown}
        className={`p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 ${
          isFloating ? 'cursor-move select-none' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#ebf8ff] rounded-lg text-[#2b6cb0]">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {isFloating && <Move className="h-3 w-3 text-slate-400 shrink-0" />}
              Procurement & Feasibility Assistant
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                DATABASE CONNECTED
              </span>
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Deterministic feasibility directly from database using LOI & IR rules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Refresh thread */}
          <button
            type="button"
            onClick={() => {
              setMessages([]);
            }}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
            title="Clear conversation history"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Close button for Floating */}
          {isFloating && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded transition cursor-pointer"
              title="Close Assistant"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Added Row Notification Banner */}
      {addedRowNotice && (
        <div className="px-3 py-1.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center gap-1.5 animate-fadeIn">
          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>{addedRowNotice}</span>
        </div>
      )}

      {/* Predefined Specifications Generator Bar (Above Chat) */}
      <div className="bg-slate-50 border-b border-slate-200 p-2.5 space-y-2 shrink-0 shadow-xs relative z-30" id="chat-predefined-specs-bar">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-800">
            <Sparkles className="h-3.5 w-3.5 text-[#2b6cb0]" />
            <span className="text-[11px] font-bold">Predefined Specifications Generator</span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono">
            {countrySpecs.preExistingUniverses.length} DB variables for {selectedCountry}
          </span>
        </div>

        {/* Form controls in strict requested order: Country -> Target Size -> IR Universe -> IR% -> LOI -> Quotas -> Targeted CPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 text-xs">
          {/* 1. Country */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">1. Country</label>
            <div className="bg-white border border-slate-200 rounded-md p-1 min-h-[30px] flex items-center shadow-xs hover:border-[#2b6cb0] transition-colors">
              <ComboboxCell
                value={selectedCountry}
                onSave={handleCountryChange}
                options={ALL_COUNTRIES}
                preExistingOptions={allDbCountries}
                specType="country"
                placeholder="Insert country"
                dropdownDirection="down"
                dropdownAlign="left"
                displayValue={
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={isValidCountry(selectedCountry) ? 'text-slate-900 font-bold truncate text-[11px]' : 'text-slate-400 italic font-normal truncate text-[11px]'}>
                      {getCanonicalCountryName(selectedCountry) || selectedCountry || 'Insert country'}
                    </span>
                    {!isValidCountry(selectedCountry) && selectedCountry && (
                      <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1 py-0.2 rounded border border-rose-200 uppercase tracking-tight shrink-0" title="Unrecognized country: 0 output">
                        0 output
                      </span>
                    )}
                  </div>
                }
                align="left"
                widthClass="w-full"
                className="w-full justify-between"
              />
            </div>
          </div>

          {/* 2. Target Size */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">2. Target Size</label>
            <input
              id="spec-target-size-input"
              type="number"
              min="1"
              step="50"
              value={targetSize}
              onChange={(e) => setTargetSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] font-mono font-bold text-slate-800 shadow-xs min-h-[30px]"
            />
          </div>

          {/* 3. IR Universe */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">3. IR Universe</label>
            <div className="bg-white border border-slate-200 rounded-md p-1 min-h-[30px] flex items-center shadow-xs hover:border-[#2b6cb0] transition-colors" title={selectedUniverse}>
              <ComboboxCell
                value={selectedUniverse}
                onSave={handleUniverseChange}
                options={pitchSpecs.universeDropdownOptions}
                preExistingOptions={pitchSpecs.preExistingUniverses}
                specType="universe"
                placeholder="Insert universe"
                dropdownDirection="down"
                dropdownAlign="auto"
                displayValue={selectedUniverse ? <span className="truncate inline-block align-middle max-w-[110px] text-[11px] font-medium">{selectedUniverse}</span> : undefined}
                align="left"
                widthClass="w-full"
                className="w-full justify-between"
              />
            </div>
          </div>

          {/* 4. IR% */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">4. IR%</label>
            <div className="bg-white border border-slate-200 rounded-md p-1 min-h-[30px] flex items-center shadow-xs hover:border-[#2b6cb0] transition-colors">
              <ComboboxCell
                value={selectedIr}
                onSave={(val) => {
                  const lower = String(val || '').trim().toLowerCase();
                  if (lower.startsWith('insert') || lower === '' || lower === 'none' || lower === '0' || lower === '0%') {
                    setSelectedIr('');
                  } else {
                    setSelectedIr(val);
                  }
                }}
                options={pitchSpecs.irDropdownOptions}
                preExistingOptions={pitchSpecs.preExistingIrs}
                specType="ir"
                placeholder="Insert incidence"
                dropdownDirection="down"
                dropdownAlign="left"
                displayValue={selectedIr || undefined}
                align="center"
                widthClass="w-full"
                className="w-full justify-between font-mono font-bold text-emerald-950 text-[11px]"
              />
            </div>
          </div>

          {/* 5. LOI */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">5. LOI</label>
            <div className="bg-white border border-slate-200 rounded-md p-1 min-h-[30px] flex items-center shadow-xs hover:border-[#2b6cb0] transition-colors">
              <ComboboxCell
                value={selectedLoi && selectedLoi > 0 ? selectedLoi : ''}
                onSave={(val) => {
                  const lower = String(val || '').trim().toLowerCase();
                  if (lower.startsWith('insert') || lower === '' || lower === 'none' || lower === '0') {
                    setSelectedLoi(0);
                  } else {
                    setSelectedLoi(parseInt(val.replace(/[^0-9]/g, ''), 10) || 0);
                  }
                }}
                options={pitchSpecs.loiDropdownOptions}
                preExistingOptions={pitchSpecs.preExistingLois}
                specType="loi"
                placeholder="Insert LOI"
                dropdownDirection="down"
                dropdownAlign="left"
                displayValue={selectedLoi && selectedLoi > 0 ? `${selectedLoi} min` : undefined}
                align="center"
                widthClass="w-full"
                className="w-full justify-between font-mono text-[11px]"
              />
            </div>
          </div>

          {/* 6. Quotas */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">6. Quotas</label>
            <div className="bg-white border border-slate-200 rounded-md p-1 min-h-[30px] flex items-center shadow-xs hover:border-[#2b6cb0] transition-colors" title={selectedQuotas}>
              <ComboboxCell
                value={selectedQuotas || 'No quotas'}
                onSave={(val) => setSelectedQuotas(val)}
                options={pitchSpecs.quotaDropdownOptions}
                preExistingOptions={pitchSpecs.preExistingQuotas}
                specType="quota"
                placeholder="Insert quotas"
                dropdownDirection="down"
                dropdownAlign="right"
                displayValue={selectedQuotas ? <span className="truncate inline-block align-middle max-w-[110px] text-[11px] font-medium">{selectedQuotas}</span> : undefined}
                align="left"
                widthClass="w-full"
                className="w-full justify-between"
              />
            </div>
          </div>

          {/* 7. Targeted CPI */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">7. Targeted CPI ($)</label>
            <div className="relative min-h-[30px] flex items-center">
              <span className="absolute left-2 text-[11px] text-slate-400 font-bold">$</span>
              <input
                id="spec-targeted-cpi-input"
                type="number"
                step="0.10"
                min="0"
                placeholder="Target CPI"
                value={targetedCpi}
                onChange={(e) => setTargetedCpi(e.target.value)}
                className="w-full pl-5 pr-1.5 py-1 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] font-mono font-medium text-slate-800 shadow-xs min-h-[30px]"
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-0.5 gap-2 flex-wrap">
          <div className="text-[9.5px] text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
            <span>Select specs to evaluate instantly against database &amp; vendors</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="instant-check-specs-btn"
              onClick={handleInstantCheck}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1 bg-[#2b6cb0] hover:bg-[#205080] text-white text-[11px] font-bold rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Play className="h-3 w-3 fill-white" />
              <span>Check Feasibility</span>
            </button>

            {latestQueryPitch && onUpdatePitches && (
              <button
                type="button"
                id="instant-add-specs-btn"
                onClick={() => {
                  onUpdatePitches([...pitches, latestQueryPitch]);
                  setAddedRowNotice(`Added new line for ${latestQueryPitch.market} to Scenarios!`);
                  setTimeout(() => setAddedRowNotice(null), 3500);
                }}
                className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-md shadow-xs transition cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Add as New Line</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/20" id="chat-messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 max-w-full ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`p-1.5 rounded-full h-6 w-6 shrink-0 flex items-center justify-center text-[9px] font-bold leading-none ${msg.role === 'user' ? 'bg-[#2b6cb0] text-white' : 'bg-slate-200 text-slate-800'}`}>
              {msg.role === 'user' ? 'ME' : 'AST'}
            </div>

            {/* Bubble */}
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
              <div 
                className={`p-3 rounded-xl text-[11px] font-normal leading-relaxed overflow-x-auto shadow-sm whitespace-pre-line ${
                  msg.role === 'user' 
                    ? 'bg-[#2b6cb0] text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <span>{msg.text}</span>
                ) : (
                  <div className="space-y-1">
                    {renderMessageText(msg.text)}

                    {/* Cheapest version manual overrides decision buttons */}
                    {msg.cheapestOverridePrompt && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                        {!msg.cheapestPromptResolved ? (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCheapestOverrideChoice(msg.id, 'reset')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer transition active:scale-95"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset Overrides &amp; Check Cheapest
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCheapestOverrideChoice(msg.id, 'keep')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer transition active:scale-95"
                            >
                              <Target className="h-3 w-3" />
                              Keep Overrides &amp; Check Remaining (Optimized)
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 inline-flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            {msg.cheapestPromptResolved === 'reset'
                              ? 'Applied: Reset overrides & checked cheapest'
                              : 'Applied: Kept overrides & ran Feasibility Optimized'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Direct action button */}
                    {msg.queryPitch && onUpdatePitches && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-medium">Quick Action:</span>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdatePitches([...pitches, msg.queryPitch!]);
                            setAddedRowNotice(`Row for ${msg.queryPitch!.market} added to Scenarios!`);
                            setTimeout(() => setAddedRowNotice(null), 3500);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer transition active:scale-95"
                        >
                          <Plus className="h-3 w-3" />
                          Add as New Line
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono px-1">
                <Clock className="h-2 w-2" />
                <span>{msg.timestamp}</span>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 max-w-full">
            <div className="p-1.5 rounded-full h-6 w-6 bg-slate-200 text-slate-800 shrink-0 flex items-center justify-center text-[9px] font-bold animate-pulse">
              AST
            </div>
            <div className="bg-white border border-slate-100 shadow-sm rounded-xl rounded-tl-none p-2.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form in English */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-1.5 border-t border-slate-100 flex items-center gap-1.5 bg-white shrink-0"
      >
        <input
          id="chat-input"
          type="text"
          placeholder="Ask a question or enter specs (e.g. France, 15 min, 20% IR, gen pop, no quotas, target 1000)..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          disabled={loading}
          className="flex-1 px-2.5 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] text-slate-800"
        />
        <button
          id="send-chat-btn"
          type="submit"
          disabled={loading || !inputVal.trim()}
          className="p-1.5 bg-[#2b6cb0] hover:bg-[#205080] text-white rounded-lg transition cursor-pointer shrink-0 disabled:opacity-40"
          title="Send message"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>

      {/* Resize corner handle */}
      {isFloating && (
        <div 
          onMouseDown={handleResizeMouseDown}
          className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize flex items-end justify-end pb-0.5 pr-0.5 text-slate-300 hover:text-slate-500 bg-transparent transition active:text-[#2b6cb0]"
          title="Drag bottom-right corner to resize window"
          style={{ zIndex: 60 }}
        >
          <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
            <path d="M6,0 L6,6 L0,6 Z" className="text-slate-400 opacity-60" />
          </svg>
        </div>
      )}
    </div>
  );
}

function renderMessageText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    
    // Check if it's a heading
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={idx} className="text-[11px] font-bold text-slate-800 mt-[10px] mb-[3px] first:mt-0 font-sans tracking-tight border-b border-indigo-100 pb-0.5 flex items-center gap-1">
          {parseInlineMarkdown(trimmed.substring(4))}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={idx} className="text-[12px] font-extrabold text-[#205080] mt-[12px] mb-[4px] first:mt-0 font-sans tracking-tight">
          {parseInlineMarkdown(trimmed.substring(3))}
        </h3>
      );
    }
    if (trimmed.startsWith('---')) {
      return <hr key={idx} className="my-1.5 border-slate-200" />;
    }
    
    // Check if list item
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || (trimmed.match(/^\d+\.\s/) && !trimmed.includes('1.000'))) {
      const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
      const content = isBullet ? trimmed.substring(2) : trimmed.replace(/^\d+\.\s/, '');
      const prefixNode = isBullet ? (
        <span className="text-[#2b6cb0] mr-1 font-bold select-none">•</span>
      ) : (
        <span className="text-[#2b6cb0] font-bold mr-1 select-none">{trimmed.match(/^\d+\./)?.[0]}</span>
      );
      
      return (
        <div key={idx} className="flex items-start my-0.5 ml-0.5 pl-0.5 leading-relaxed text-[10.5px] text-slate-700">
          {prefixNode}
          <div className="flex-1">{parseInlineMarkdown(content)}</div>
        </div>
      );
    }

    // Default line
    return (
      <p key={idx} className="min-h-[1.1rem] leading-relaxed my-0.5 text-slate-700 font-normal">
        {parseInlineMarkdown(line)}
      </p>
    );
  });
}

function parseInlineMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  
  const regex = /(\*\*|==|\*)(.*?)\1/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    const type = match[1];
    const innerText = match[2];
    
    if (matchIndex > currentIndex) {
      parts.push(text.substring(currentIndex, matchIndex));
    }
    
    if (type === '**') {
      parts.push(<strong key={matchIndex} className="font-bold text-slate-900 mx-0.5">{innerText}</strong>);
    } else if (type === '==') {
      parts.push(<mark key={matchIndex} className="bg-yellow-100 text-yellow-900 px-1 py-0.5 rounded font-medium">{innerText}</mark>);
    } else if (type === '*') {
      parts.push(<em key={matchIndex} className="italic text-slate-800 font-medium">{innerText}</em>);
    }
    
    currentIndex = regex.lastIndex;
  }
  
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }
  
  return parts.length > 0 ? parts : text;
}
