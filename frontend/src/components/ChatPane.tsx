import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FeasibilityRow, AllocationResult, ChatMessage, StrategyType, VendorTier } from '../types';
import { ALL_COUNTRIES, getCanonicalCountryName, isValidCountry } from '../data/countries';
import { findBestDbMatches, normalizeLoi, normalizeIr } from '../lib/matching';
import { calculateRowAllocation, deduplicateDbRows } from '../lib/calculator';
import { DEFAULT_VENDORS, DEFAULT_PITCHES } from '../data/defaultData';
import { getCountrySpecsByUniverse, ATTACHED_REFERENCE_SPECS, ALL_DB_COUNTRIES, getDbCountries } from '../data/attachedSpecsData';
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
  onUpdatePitches?: (updated: FeasibilityRow[], preserveHasChecked?: boolean) => void;
  // Lifted state props for continuous history support
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onUpdateStrategy?: (strategy: StrategyType) => void;
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
  onUpdatePitches,
  messages,
  setMessages,
  onUpdateStrategy,
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

  const pitchSpecs = useMemo(() => {
    return getCountrySpecsByUniverse(selectedCountry, selectedUniverse, insertedDatabase || undefined);
  }, [selectedCountry, selectedUniverse, insertedDatabase]);

  const [selectedLoi, setSelectedLoi] = useState<number>(() => {
    return pitchSpecs.loiDropdownOptions[0] || 15;
  });

  const [selectedIr, setSelectedIr] = useState<string>(() => {
    return pitchSpecs.irDropdownOptions[0] || '30%';
  });

  const [selectedQuotas, setSelectedQuotas] = useState<string>(() => {
    return pitchSpecs.quotaDropdownOptions[0] || 'No quotas';
  });

  const [targetedCpi, setTargetedCpi] = useState<string>('');
  const [latestQueryPitch, setLatestQueryPitch] = useState<FeasibilityRow | null>(null);

  const handleCountryChange = (newCountry: string) => {
    const canonical = getCanonicalCountryName(newCountry) || newCountry;
    setSelectedCountry(canonical);
    const specs = getCountrySpecsByUniverse(canonical, undefined, insertedDatabase || undefined);
    const newUni = specs.preExistingUniverses[0] || 'gen pop';
    setSelectedUniverse(newUni);
    const uniSpecs = getCountrySpecsByUniverse(canonical, newUni, insertedDatabase || undefined);
    if (uniSpecs.loiDropdownOptions.length > 0) setSelectedLoi(uniSpecs.loiDropdownOptions[0]);
    if (uniSpecs.irDropdownOptions.length > 0) setSelectedIr(uniSpecs.irDropdownOptions[0]);
    if (uniSpecs.quotaDropdownOptions.length > 0) setSelectedQuotas(uniSpecs.quotaDropdownOptions[0]);
  };

  const handleUniverseChange = (newUni: string) => {
    setSelectedUniverse(newUni);
    const uniSpecs = getCountrySpecsByUniverse(selectedCountry, newUni, insertedDatabase || undefined);
    if (uniSpecs.loiDropdownOptions.length > 0 && !uniSpecs.loiDropdownOptions.includes(Number(selectedLoi))) {
      setSelectedLoi(uniSpecs.loiDropdownOptions[0]);
    }
    if (uniSpecs.irDropdownOptions.length > 0 && !uniSpecs.irDropdownOptions.includes(selectedIr)) {
      setSelectedIr(uniSpecs.irDropdownOptions[0]);
    }
    if (uniSpecs.quotaDropdownOptions.length > 0 && !uniSpecs.quotaDropdownOptions.includes(selectedQuotas)) {
      setSelectedQuotas(uniSpecs.quotaDropdownOptions[0]);
    }
  };

  const handleInstantCheck = () => {
    const numTarget = Number(targetSize) || 1000;
    const numLoi = Number(selectedLoi) || 15;
    const rawIr = selectedIr || '30%';
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
      target: specs.universe || 'gen pop',
      loi: normLoi,
      irPercent: normIr,
      irUniverse: specs.universe || 'gen pop',
      quotas: specs.quotas || 'No quotas',
      waves: 1,
      totalFreshSample: specs.targetSize,
      totalSampleSize: specs.targetSize,
      internal: 0,
      maxInternalPercent: specs.maxInternalPercent !== undefined ? specs.maxInternalPercent : 100,
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
          maxInternalPercent: 100,
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
    const activeVendorsList = vendors && vendors.length > 0 ? vendors : DEFAULT_VENDORS;

    if (matches.length > 0) {
      const deduplicatedMatches = deduplicateDbRows(matches);
      let aggregatedInternal = 0;
      const aggregatedVendors: { [vIdx: number]: number } = {};
      const aggregatedVendorCpis: { [vIdx: number]: number } = {};

      deduplicatedMatches.forEach(mr => {
        // IR reduction factor: if incidence requested is lower by up to -10%,
        // feasibility generated is reduced by this percentage to reflect reality!
        const reductionFactor = mr._matchMetadata?.irReductionFactor ?? 1.0;
        const reducedInternal = Math.round((mr.internal || 0) * reductionFactor);
        if (reducedInternal > aggregatedInternal) {
          aggregatedInternal = reducedInternal;
        }

        for (let idx = 0; idx < activeVendorsList.length; idx++) {
          const vIdx = idx + 1;
          const vendorObj = activeVendorsList[idx];
          const matchNum = vendorObj.name.toLowerCase().match(/\d+/);
          const vendorNumInDb = matchNum ? parseInt(matchNum[0], 10) : vIdx;
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
          const existCap = aggregatedVendors[vIdx] || 0;
          const existCpi = aggregatedVendorCpis[vIdx] || 0;

          if (vendorCap > existCap) {
            aggregatedVendors[vIdx] = vendorCap;
            if (cpiVal > 0) {
              aggregatedVendorCpis[vIdx] = cpiVal;
            }
          } else if (vendorCap === existCap && vendorCap > 0 && cpiVal > 0 && (existCpi === 0 || cpiVal < existCpi)) {
            aggregatedVendorCpis[vIdx] = cpiVal;
          }
        }
      });

      queryRow.internal = aggregatedInternal;
      const matchWithLoiMarkup = deduplicatedMatches.find(mr => mr._matchMetadata?.hasLoiMarkup);
      if (matchWithLoiMarkup) {
        queryRow.hasLoiMarkup = true;
        queryRow.loiDiff = matchWithLoiMarkup._matchMetadata?.loiDiff;
        queryRow.matchedDbLoi = matchWithLoiMarkup._matchMetadata?.matchedDbLoi;
      }

      const matchWithIrReduction = deduplicatedMatches.find(mr => (mr._matchMetadata?.irReductionPct || 0) > 0);
      if (matchWithIrReduction) {
        queryRow.irReductionPct = matchWithIrReduction._matchMetadata?.irReductionPct;
      }

      for (let idx = 0; idx < activeVendorsList.length; idx++) {
        const vIdx = idx + 1;
        (queryRow as any)[`vendor${vIdx}`] = aggregatedVendors[vIdx] || 0;
        (queryRow as any)[`vendor${vIdx}Cpi`] = aggregatedVendorCpis[vIdx] || 0;
      }
    }

    const alloc = calculateRowAllocation(queryRow, activeStrategy as StrategyType, vendors);

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

  // Helper to extract specs if user types in free-form natural language
  const parseSpecsFromPrompt = (text: string) => {
    const lower = text.toLowerCase();
    
    // Country detection
    let detectedCountry = '';
    for (const c of ALL_COUNTRIES) {
      if (lower.includes(c.toLowerCase())) {
        detectedCountry = c;
        break;
      }
    }
    if (!detectedCountry) {
      if (lower.includes('germany') || lower.includes('germania') || lower.includes('de')) detectedCountry = 'Germany';
      else if (lower.includes('france') || lower.includes('franta') || lower.includes('fr')) detectedCountry = 'France';
      else if (lower.includes('spain') || lower.includes('spania') || lower.includes('es')) detectedCountry = 'Spain';
      else if (lower.includes('italy') || lower.includes('italia') || lower.includes('it')) detectedCountry = 'Italy';
      else if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('britain')) detectedCountry = 'United Kingdom';
      else if (lower.includes('united states') || lower.includes('usa') || lower.includes('us')) detectedCountry = 'United States';
      else if (lower.includes('netherlands') || lower.includes('holland') || lower.includes('nl')) detectedCountry = 'Netherlands';
      else if (lower.includes('switzerland') || lower.includes('ch')) detectedCountry = 'Switzerland';
      else if (lower.includes('romania') || lower.includes('ro')) detectedCountry = 'Romania';
      else if (lower.includes('canada') || lower.includes('ca')) detectedCountry = 'Canada';
      else if (lower.includes('australia') || lower.includes('au')) detectedCountry = 'Australia';
      else if (lower.includes('japan') || lower.includes('jp')) detectedCountry = 'Japan';
    }

    // Max internal percent constraint: e.g. "max 50% internal", "max 50% internal sample"
    let detectedMaxInternal: number | undefined = undefined;
    const internalMatch = text.match(/(?:max(?:imum)?\s*(\d+)%\s*internal)|(?:internal\s*(?:max|capped\s*at)?\s*(\d+)%)/i);
    if (internalMatch) {
      detectedMaxInternal = parseInt(internalMatch[1] || internalMatch[2], 10);
    }

    // Max external CPI constraint: e.g. "max external CPI of 3 euros", "max cpi 3"
    let detectedMaxCpi: number | undefined = undefined;
    const cpiMatch = text.match(/(?:max(?:imum)?\s*(?:external\s*)?cpi\s*(?:of|is|:)?\s*(\d+(?:\.\d+)?))|(?:cpi\s*(?:of\s*max|max|capped\s*at|under|up\s*to)\s*(\d+(?:\.\d+)?))/i);
    if (cpiMatch) {
      detectedMaxCpi = parseFloat(cpiMatch[1] || cpiMatch[2]);
    }

    // Target size detection: supports "1000 completes", "1000 target", "1000 interviews", etc.
    let detectedTarget: number = 1000;
    const targetMatch = text.match(/(?:target\s*(?:of|is|:)?\s*(\d+))|(?:(\d+)\s*(?:n\b|target|completes|interviews|sample))/i);
    if (targetMatch) {
      detectedTarget = parseInt(targetMatch[1] || targetMatch[2], 10);
    }

    // LOI detection
    let detectedLoi: number | undefined = undefined;
    const loiMatch = text.match(/(?:loi\s*(?:of|is|:)?\s*(\d+))|(?:(\d+)\s*(?:min|minute|mins\b|m\b))/i);
    if (loiMatch) {
      detectedLoi = parseInt(loiMatch[1] || loiMatch[2], 10);
    } else {
      // Look up LOI in DB for this market
      const dbMatch = DEFAULT_PITCHES.find(p => p.market.toLowerCase() === (detectedCountry || 'france').toLowerCase());
      detectedLoi = dbMatch ? dbMatch.loi : 10;
    }

    // IR detection
    let detectedIr: string | undefined = undefined;
    const irMatch = text.match(/(?:ir\s*(?:of|is|:)?\s*(\d+)%?)|(?:(\d+)\s*%\s*(?:ir|incidence)?)/i);
    if (irMatch) {
      detectedIr = `${irMatch[1] || irMatch[2]}%`;
    }

    // Quotas detection
    let detectedQuotas: string = 'No quotas';
    if (lower.includes('no quota') || lower.includes('no quotas') || lower.includes('none') || lower.includes('without quotas')) {
      detectedQuotas = 'No quotas';
    } else if (lower.includes('agr')) {
      detectedQuotas = 'AGR';
    }

    // Universe / variable detection
    let detectedUniverse: string = 'gen pop 18-65yo';
    if (lower.includes('gen pop 18-65') || lower.includes('gen pop') || lower.includes('general population')) {
      detectedUniverse = 'gen pop 18-65yo';
    } else if (lower.includes('gen pop 25-65')) {
      detectedUniverse = 'gen pop 25-65yo';
    } else if (lower.includes('all 19-64')) {
      detectedUniverse = 'All 19-64yo';
    } else if (lower.includes('18-45')) {
      detectedUniverse = 'Gen pop 18-45yo';
    }

    const isFeasibilityQuery = Boolean(
      detectedCountry && (
        detectedLoi !== undefined || 
        detectedIr !== undefined || 
        detectedMaxInternal !== undefined ||
        detectedMaxCpi !== undefined ||
        lower.includes('calculate') || 
        lower.includes('feasibility') || 
        lower.includes('quote') ||
        lower.includes('completes') ||
        lower.includes('what can be done')
      )
    );

    return {
      isFeasibilityQuery,
      country: detectedCountry || 'France',
      loi: detectedLoi !== undefined ? detectedLoi : 10,
      irRaw: detectedIr || '20%',
      quotas: detectedQuotas,
      universe: detectedUniverse,
      targetSize: detectedTarget,
      maxInternalPercent: detectedMaxInternal,
      maxExternalCpi: detectedMaxCpi
    };
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

    setMessages((prev) => [...prev, userMsg]);

    // Check if the prompt describes country specs to calculate directly
    const parsed = parseSpecsFromPrompt(textToSend);
    if (parsed.isFeasibilityQuery) {
      executeQueryCalculation({
        country: parsed.country,
        universe: parsed.universe,
        loi: parsed.loi,
        irRaw: parsed.irRaw,
        quotas: parsed.quotas,
        targetSize: parsed.targetSize,
        maxInternalPercent: parsed.maxInternalPercent,
        maxExternalCpi: parsed.maxExternalCpi
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, text: m.text })),
          dataState: {
            pitches,
            allocations,
            insertedDatabase: insertedDatabase || [],
            vendors: vendors && vendors.length > 0 ? vendors : [
              { name: 'Vendor 1', tier: 'tier 0' },
              { name: 'Vendor 2', tier: 'tier 1' },
              { name: 'Vendor 3', tier: 'tier 2' },
              { name: 'Vendor 4', tier: 'tier 3' }
            ]
          },
          activeStrategy
        })
      });

      if (!res.ok) {
        throw new Error('Failed to get response from the feasibility chat route.');
      }

      const responseData = await res.json();
      
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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-150 rounded transition cursor-pointer"
            title="Clear conversation history"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Close button for Floating */}
          {isFloating && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-150 rounded transition cursor-pointer"
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

        {/* Form controls in strict requested order: Country -> Target Size -> LOI -> IR% -> IR Universe -> Quotas -> Targeted CPI */}
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
              className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] font-mono font-bold text-slate-850 shadow-xs min-h-[30px]"
            />
          </div>

          {/* 3. LOI */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">3. LOI</label>
            <div className="bg-white border border-slate-200 rounded-md p-1 min-h-[30px] flex items-center shadow-xs hover:border-[#2b6cb0] transition-colors">
              <ComboboxCell
                value={selectedLoi && selectedLoi > 0 ? selectedLoi : ''}
                onSave={(val) => {
                  const num = parseInt(val, 10) || 15;
                  setSelectedLoi(num);
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

          {/* 4. IR% */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">4. IR%</label>
            <div className="bg-white border border-slate-200 rounded-md p-1 min-h-[30px] flex items-center shadow-xs hover:border-[#2b6cb0] transition-colors">
              <ComboboxCell
                value={selectedIr}
                onSave={(val) => setSelectedIr(val)}
                options={pitchSpecs.irDropdownOptions}
                preExistingOptions={pitchSpecs.preExistingIrs}
                specType="ir"
                placeholder="Insert incidence"
                dropdownDirection="down"
                dropdownAlign="left"
                displayValue={selectedIr}
                align="center"
                widthClass="w-full"
                className="w-full justify-between font-mono font-bold text-emerald-950 text-[11px]"
              />
            </div>
          </div>

          {/* 5. IR Universe */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold uppercase text-slate-500 mb-0.5 tracking-tight truncate">5. IR Universe</label>
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
                className="w-full pl-5 pr-1.5 py-1 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] font-mono font-medium text-slate-850 shadow-xs min-h-[30px]"
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
                    : 'bg-white border border-slate-150 text-slate-800 rounded-tl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <span>{msg.text}</span>
                ) : (
                  <div className="space-y-1">
                    {renderMessageText(msg.text)}

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
