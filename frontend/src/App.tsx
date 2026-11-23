import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FeasibilityRow, VendorTier, StrategyType, ChatMessage } from './types';
import { DEFAULT_PITCHES, DEFAULT_VENDORS, VENDOR_DATABASE_POOL } from './data/defaultData';
import { safeStorage } from './lib/storage';
import { api, SavedOption } from './lib/api';
import { parseCSVToPitches } from './lib/csvParser';
import { ATTACHED_VENDOR_TIERS, getAuthoritativeVendorConfig } from './data/vendorTiersData';
import { calculateRowAllocation, calculateAllRows, calculateOptimizedAllocations, deduplicateDbRows } from './lib/calculator';
import { findBestDbMatches, evaluateDbMatch, isValidCountry } from './lib/matching';

// Import newly created modular components
import DatabaseGrid from './components/DatabaseGrid';
import SpecsCalculator from './components/SpecsCalculator';
import ChatPane from './components/ChatPane';
import VendorManager from './components/VendorManager';

import { downloadComprehensiveRulesManual } from './lib/docxGenerator';
import { ATTACHED_REFERENCE_SPECS } from './data/attachedSpecsData';

import {
  Compass,
  Database,
  MessageSquare,
  ShieldCheck,
  Clock,
  FileSpreadsheet,
  Lightbulb,
  CheckCircle2,
  Info,
  AlertCircle,
  Layers,
  ChevronRight,
  TrendingDown,
  LineChart,
  FolderHeart,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileText,
  FileDown,
  Settings,
  Settings2,
  Presentation,
  Sliders,
  RotateCcw,
  X
} from 'lucide-react';

const getActiveVendorsForPitches = (
  pitchList: FeasibilityRow[],
  overrides: Record<string, VendorTier>
): VendorTier[] => {
  let maxUsedSlot = 0;
  for (const p of pitchList) {
    for (const key of Object.keys(p)) {
      const m = key.match(/^vendor(\d+)$/i);
      if (m && Number((p as any)[key]) > 0) {
        const idx = parseInt(m[1], 10);
        if (idx > maxUsedSlot) maxUsedSlot = idx;
      }
    }
  }
  const count = maxUsedSlot > 0 ? maxUsedSlot : 4;
  const list: VendorTier[] = [];
  for (let num = 1; num <= count; num++) {
    const nameKey = `vendor ${num}`;
    const customOverride = overrides[nameKey];
    list.push(customOverride ? { ...customOverride } : getAuthoritativeVendorConfig(num));
  }
  return list;
};

export default function App() {
  // Persisted Partner Mapping overrides (including "Do not use" / "Red" bans)
  const [vendorOverrides, setVendorOverrides] = useState<Record<string, VendorTier>>(() => {
    const saved = safeStorage.getItem('procurement_vendor_overrides');
    try {
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Primary state holding our entire active workflow
  const [pitches, setPitches] = useState<FeasibilityRow[]>(DEFAULT_PITCHES);
  const [vendors, setVendors] = useState<VendorTier[]>(() => {
    const saved = safeStorage.getItem('procurement_vendor_overrides');
    let initialOverrides: Record<string, VendorTier> = {};
    try {
      initialOverrides = saved ? JSON.parse(saved) : {};
    } catch {
      initialOverrides = {};
    }
    return getActiveVendorsForPitches(DEFAULT_PITCHES, initialOverrides);
  });
  const [activeStrategy, setActiveStrategy] = useState<StrategyType>('cost');
  const [activeTab, setActiveTab] = useState<'calculator' | 'scenarios' | 'chat' | 'vendors'>('calculator');

  // Feasibility Overview Grid font size delta in points (-1, 0, 1)
  const [feasibilityFontSizeDelta, setFeasibilityFontSizeDelta] = useState<number>(() => {
    const saved = safeStorage.getItem('feasibility_font_size_delta');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [tempFontSizeDelta, setTempFontSizeDelta] = useState<number>(feasibilityFontSizeDelta);

  useEffect(() => {
    setTempFontSizeDelta(feasibilityFontSizeDelta);
  }, [feasibilityFontSizeDelta]);

  const handleUpdateFontSizeDelta = (val: number) => {
    setFeasibilityFontSizeDelta(val);
    safeStorage.setItem('feasibility_font_size_delta', String(val));
  };

  // Timezone clock states
  const [selectedCityTz, setSelectedCityTz] = useState<string>(() => {
    return safeStorage.getItem('procurement_selected_tz') || 'UTC';
  });
  const [showTzDropdown, setShowTzDropdown] = useState(false);

  const isSystemUpdatingRef = useRef(false);
  const [toastNotification, setToastState] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setToastNotification = (val: { message: string; type: 'success' | 'error' | 'info' } | null) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastState(val);
    if (val) {
      toastTimerRef.current = setTimeout(() => {
        setToastState(null);
      }, 4500);
    }
  };

  // Feasibility strategy change handler
  const handleChangeStrategy = (newStrategy: StrategyType) => {
    if (activeStrategy === newStrategy) return;
    setActiveStrategy(newStrategy);
    safeStorage.setItem('procurement_active_strategy', newStrategy);
  };

  // Floating Chat toggle and message history states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = safeStorage.getItem('procurement_continuous_chat');
    try {
      return saved ? JSON.parse(saved) : [
        {
          id: 'msg-welcome',
          role: 'model',
          text: "Hello! I am your **Feasibility & Procurement Assistant**.\n\nI have scanned your active specifications and any uploaded spreadsheet DB/specs.\n\nTell me what you'd like to analyze. I can also look up feasibility capacity from your uploaded specs sheets or modify parameters directly! Here are some fast things we can check:\n\n* **Database Check**: Search and cross-reference records from your uploaded database file.\n* **Cost Efficiency**: Where can we save the most budget?\n* **Deficits**: Which country targets are showing sample shortages under the active strategy?\n\nHow can I support your project today?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    safeStorage.setItem('procurement_continuous_chat', JSON.stringify(chatMessages));
  }, [chatMessages]);

  const handleNewSpecsFileAttached = () => {
    safeStorage.removeItem('procurement_continuous_chat');
    const resetMsg: ChatMessage = {
      id: `msg-welcome-reset-${Date.now()}`,
      role: 'model',
      text: "A new specs file has been attached! I have refreshed my analysis context.\n\nHow can I help you adjust or analyze this new data? Ask me to 'create the cheapest version' or 'add a new line'!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages([resetMsg]);
    if (!liveFeasibility) {
      setVendors(getActiveVendorsForPitches([], vendorOverrides));
      setHasChecked(false);
    }
  };

  // Capability lookup database (shared by all users, stored in SQLite on the server)
  const [insertedDatabase, setInsertedDatabase] = useState<FeasibilityRow[] | null>(null);
  const dbFileInputRef = useRef<HTMLInputElement>(null);

  // Targeted budget state with persistence
  const [targetedBudget, setTargetedBudget] = useState<number>(() => {
    const saved = safeStorage.getItem('procurement_targeted_budget');
    return saved ? parseFloat(saved) : 0;
  });

  const handleSetTargetedBudget = (val: number) => {
    setTargetedBudget(val);
    safeStorage.setItem('procurement_targeted_budget', String(val));
  };

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetBackupName, setResetBackupName] = useState('');
  const [resetAlsoDatabase, setResetAlsoDatabase] = useState(false);

  // Saved Options specifications history state (shared by all users, stored in SQLite on the server)
  const [savedOptions, setSavedOptions] = useState<SavedOption[]>([]);
  const [savedDropdownOpen, setSavedDropdownOpen] = useState(false);

  const refreshSavedOptions = async () => {
    try {
      setSavedOptions(await api.listSavedOptions());
    } catch (err: any) {
      console.warn('Could not load saved options from the server:', err);
    }
  };

  // Load the shared state from the server on startup
  useEffect(() => {
    refreshSavedOptions();
    api.getDatabase()
      .then((db) => setInsertedDatabase(db && db.rows.length > 0 ? db.rows : null))
      .catch((err) => console.warn('Could not load the capability database from the server:', err));
  }, []);

  // Checking and reloading state triggers
  const [hasChecked, setHasChecked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  const [currentTime, setCurrentTime] = useState('');
  const [checkingError, setCheckingError] = useState('');

  // New states for standard and optimized verification paths
  const [showStandardCheckDialog, setShowStandardCheckDialog] = useState(false);
  const [showOptionsCheckDialog, setShowOptionsCheckDialog] = useState(false);
  const [showOptimizedCheckDialog, setShowOptimizedCheckDialog] = useState(false);
  const [useOptimizedRules, setUseOptimizedRules] = useState(false);
  const [allowSameLineTwice, setAllowSameLineTwice] = useState(false);

  // Live Feasibility background checking toggle state
  const [liveFeasibility, setLiveFeasibility] = useState<boolean>(() => {
    const saved = safeStorage.getItem('procurement_live_feasibility');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleLiveFeasibility = () => {
    setLiveFeasibility(prev => {
      const next = !prev;
      safeStorage.setItem('procurement_live_feasibility', String(next));
      return next;
    });
  };

  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const tzDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setShowSettingsDropdown(false);
      }
      if (tzDropdownRef.current && !tzDropdownRef.current.contains(event.target as Node)) {
        setShowTzDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const hasManualAdjustments = () => {
    return pitches.some(p => {
      if (p.maxInternalPercent !== undefined && p.maxInternalPercent < 100) return true;
      if (p.internalPctOverride !== undefined) return true;
      if (p.overlapVariable !== undefined) return true;
      if (p.targetedCpi !== undefined && p.targetedCpi > 0) return true;
      for (const key of Object.keys(p)) {
        if (/^vendor\d+PctOverride$/i.test(key) && (p as any)[key] !== undefined) return true;
        if (/^vendor\d+Pct$/i.test(key) && (p as any)[key] !== undefined && (p as any)[key] !== 100) return true;
      }
      return false;
    });
  };

  const resetManualAdjustments = (pList: FeasibilityRow[]) => {
    return pList.map(p => {
      if (p.isLocked) return p;
      const copy: any = { ...p };
      delete copy.targetedCpi;
      delete copy.maxInternalPercent;
      delete copy.internalPctOverride;
      delete copy.overlapVariable;
      for (const key of Object.keys(copy)) {
        if (/^vendor\d+PctOverride$/i.test(key)) {
          delete copy[key];
        } else if (/^vendor\d+Pct$/i.test(key)) {
          copy[key] = 100;
        }
      }
      return copy as FeasibilityRow;
    });
  };

  const handleStartChecking = async () => {
    if (pitches.length === 0) {
      setToastNotification({
        message: "No active specifications found. Please insert or load options first!",
        type: 'error'
      });
      return;
    }
    if (hasManualAdjustments()) {
      setShowStandardCheckDialog(true);
    } else {
      await executeCheck(false, pitches, false, false);
    }
  };

  const handleStartCheckingForOptions = async () => {
    if (pitches.length === 0) {
      setToastNotification({
        message: "No active specifications found. Please insert or load options first!",
        type: 'error'
      });
      return;
    }
    if (hasManualAdjustments()) {
      setShowOptionsCheckDialog(true);
    } else {
      await executeCheck(false, pitches, false, true);
    }
  };

  const handleStartCheckingOptimized = async () => {
    if (pitches.length === 0) {
      setToastNotification({
        message: "No active specifications found. Please insert or load options first!",
        type: 'error'
      });
      return;
    }
    if (hasManualAdjustments()) {
      setShowOptimizedCheckDialog(true);
    } else {
      await executeCheck(true, pitches, false, allowSameLineTwice);
    }
  };

  const executeCheck = async (
    isOptimized: boolean,
    pitchesToUse: FeasibilityRow[],
    isSilent: boolean = false,
    optAllowSameLineTwice?: boolean,
    overridesOverride?: Record<string, VendorTier>
  ) => {
    if (!isSilent) {
      setIsChecking(true);
      setCheckingError('');
    }
    setUseOptimizedRules(isOptimized);

    const activeAllowSameLineTwice = optAllowSameLineTwice !== undefined ? optAllowSameLineTwice : allowSameLineTwice;
    if (optAllowSameLineTwice !== undefined) {
      setAllowSameLineTwice(optAllowSameLineTwice);
    }

    const activeOverrides = overridesOverride || vendorOverrides;

    const aggregateCapabilities = (dbRows: FeasibilityRow[]) => {
      const deduplicatedDbRows = deduplicateDbRows(dbRows);
      // 1. Find all matching database rows across all checked pitches using 100% specs & tolerance rules
      const allMatches: FeasibilityRow[] = [];
      pitchesToUse.forEach(pitch => {
        if (pitch.isLocked) return;
        const groupMatches = findBestDbMatches(pitch, deduplicatedDbRows, new Set<string>());
        groupMatches.forEach(m => allMatches.push(m));
      });

      // 2. Scan all matches and full DB rows to detect active non-banned vendors (> 0 capacity) across 1..166+
      // Persisted Partner Mapping overrides (including "Do not use" / "Red" bans) ALWAYS take precedence!
      const vendorOverrideMap = new Map<string, VendorTier>();
      (Object.entries(activeOverrides || {}) as [string, VendorTier][]).forEach(([k, v]) => {
        vendorOverrideMap.set(k.toLowerCase().trim(), v);
      });
      (vendors || []).forEach(v => {
        const key = v.name.toLowerCase().trim();
        if (!vendorOverrideMap.has(key)) {
          vendorOverrideMap.set(key, v);
        }
      });

      const getVendorConfigForNum = (num: number): VendorTier => {
        const nameKey = `vendor ${num}`;
        const customOverride = vendorOverrideMap.get(nameKey);
        if (customOverride) return customOverride;
        const authConfig = getAuthoritativeVendorConfig(num);
        if (authConfig) return authConfig;
        const poolVendor = VENDOR_DATABASE_POOL.find(v => v.name.toLowerCase() === nameKey);
        return poolVendor ? { ...poolVendor } : { name: `Vendor ${num}`, tier: 'No Tier', color: 'Grey' };
      };

      const isVendorBanned = (v: VendorTier): boolean => {
        const tierLower = String(v.tier || '').toLowerCase();
        const colorLower = String(v.color || '').toLowerCase();
        return tierLower.includes('do not use') || colorLower === 'red';
      };

      const foundVendorNums = new Set<number>();
      allMatches.forEach(row => {
        Object.keys(row).forEach(key => {
          const m = key.match(/^vendor(\d+)$/i);
          if (m) {
            const num = parseInt(m[1], 10);
            const val = Number((row as any)[key]);
            if (val > 0 && !isVendorBanned(getVendorConfigForNum(num))) {
              foundVendorNums.add(num);
            }
          }
        });
      });

      // Preserve any manually added non-banned vendors across background/live checks
      const manuallyAddedNums = new Set<number>();
      (vendors || []).forEach(v => {
        if (v.isAddedManually) {
          const m = v.name.toLowerCase().match(/\d+/);
          if (m) {
            const num = parseInt(m[0], 10);
            if (!isVendorBanned(getVendorConfigForNum(num))) {
              foundVendorNums.add(num);
              manuallyAddedNums.add(num);
            }
          }
        }
      });

      // Resolve authoritative tiers & colors (with Partner Mapping overrides preserved)
      const detectedVendorsList: VendorTier[] = [];
      foundVendorNums.forEach(num => {
        const cfg = getVendorConfigForNum(num);
        detectedVendorsList.push(
          manuallyAddedNums.has(num) ? { ...cfg, isAddedManually: true } : cfg
        );
      });

      // 3. Sort detected vendors strictly based on Tier and Color priorities!
      const pTierValue = (tierStr: string): number => {
        const t = String(tierStr || '').toLowerCase();
        if (t.includes('do not use')) return 999;
        if (t.includes('0') || t.includes('prime')) return 0;
        if (t.includes('1')) return 1;
        if (t.includes('2')) return 2;
        if (t.includes('3')) return 3;
        return 4;
      };

      const pColorValue = (colorStr: string): number => {
        const c = String(colorStr || '').toLowerCase();
        if (c.includes('red')) return 999;
        if (c.includes('green')) return 1;
        if (c.includes('yellow')) return 2;
        if (c.includes('orange')) return 3;
        if (c.includes('grey') || c.includes('gray')) return 4;
        return 5;
      };

      detectedVendorsList.sort((a, b) => {
        const tA = pTierValue(a.tier);
        const tB = pTierValue(b.tier);
        if (tA !== tB) return tA - tB;
        const cA = pColorValue(a.color);
        const cB = pColorValue(b.color);
        if (cA !== cB) return cA - cB;
        const numA = parseInt(a.name.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.name.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });

      const fallbackVendors = [1, 2, 3, 4]
        .map(num => getVendorConfigForNum(num))
        .filter(v => !isVendorBanned(v));
      const activeVendorsList = detectedVendorsList.length > 0 ? detectedVendorsList : fallbackVendors;
      setVendors(activeVendorsList);

      const updatedPitches: FeasibilityRow[] = [];
      const usedDbRowIdSet = new Set<string>();

      // Maintain strict sequential audience order (never shuffle audiences!)
      pitchesToUse.forEach(pitch => {
        if (pitch.isLocked) {
          updatedPitches.push(pitch);
          return; // Preserve locked pitches completely unaffected!
        }

        const matches = findBestDbMatches(pitch, deduplicatedDbRows, activeAllowSameLineTwice ? new Set<string>() : usedDbRowIdSet);

        const updatedPitch = { ...pitch };

        if (matches.length > 0) {
          const deduplicatedMatches = deduplicateDbRows(matches);

          // Get aggregated capacities from the matched rows
          let aggregatedInternal = 0;
          const aggregatedVendors: { [vIdx: number]: number } = {};
          const aggregatedVendorCpis: { [vIdx: number]: number } = {};

          const numActiveVendors = activeVendorsList.length;

          deduplicatedMatches.forEach(mr => {
            if (!activeAllowSameLineTwice) {
              usedDbRowIdSet.add(mr.id);
            }

            // IR reduction factor: if incidence requested is lower by up to -10%,
            // feasibility generated is reduced by this percentage to reflect reality!
            const reductionFactor = mr._matchMetadata?.irReductionFactor ?? 1.0;

            // Across lines, take the highest internal capability without duplicating
            const reducedInternal = Math.round((mr.internal || 0) * reductionFactor);
            if (reducedInternal > aggregatedInternal) {
              aggregatedInternal = reducedInternal;
            }

            for (let idx = 0; idx < numActiveVendors; idx++) {
              const vIdx = idx + 1;
              const vendorObj = activeVendorsList[idx];
              const nameLower = vendorObj.name.toLowerCase();
              const matchNum = nameLower.match(/\d+/);
              const vendorNumInDb = matchNum ? parseInt(matchNum[0], 10) : vIdx;

              const dbCapKey = `vendor${vendorNumInDb}`;
              const dbCpiKey = `vendor${vendorNumInDb}Cpi`;

              const rawCap = Number((mr as any)[dbCapKey]) || 0;
              const vendorCap = Math.round(rawCap * reductionFactor);
              const cpiVal = parseFloat((mr as any)[dbCpiKey]);

              // Across lines, vendors are NOT duplicated: take highest capacity and best (cheaper) CPI
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

          // For manually added vendors that weren't in topScore-5 matches, preserve their real tolerance-matched DB capacity
          const hasManualMissingCap = activeVendorsList.some(
            (v, i) => v.isAddedManually && !(aggregatedVendors[i + 1] > 0)
          );
          if (hasManualMissingCap) {
            const broadMatches = deduplicateDbRows(
              deduplicatedDbRows.filter(dbRow => evaluateDbMatch(pitch, dbRow).isMatch)
            );
            activeVendorsList.forEach((vendorObj, idx) => {
              const vIdx = idx + 1;
              if (!vendorObj.isAddedManually || (aggregatedVendors[vIdx] || 0) > 0) return;
              const matchNum = vendorObj.name.toLowerCase().match(/\d+/);
              const vendorNumInDb = matchNum ? parseInt(matchNum[0], 10) : vIdx;
              const dbCapKey = `vendor${vendorNumInDb}`;
              const dbCpiKey = `vendor${vendorNumInDb}Cpi`;
              let maxCap = 0;
              let bestCpi = 0;
              broadMatches.forEach(mr => {
                const cap = parseInt((mr as any)[dbCapKey], 10) || 0;
                const cpi = parseFloat((mr as any)[dbCpiKey]) || 0;
                if (cap > maxCap) maxCap = cap;
                if (cpi > 0 && (bestCpi === 0 || cpi < bestCpi)) bestCpi = cpi;
              });
              if (maxCap > 0) {
                aggregatedVendors[vIdx] = maxCap;
                aggregatedVendorCpis[vIdx] = bestCpi;
              }
            });
          }

          updatedPitch.internal = aggregatedInternal;

          // Pass LOI markup and IR reduction metadata to pitch row
          const matchWithLoiMarkup = deduplicatedMatches.find(mr => mr._matchMetadata?.hasLoiMarkup);
          if (matchWithLoiMarkup) {
            updatedPitch.hasLoiMarkup = true;
            updatedPitch.loiDiff = matchWithLoiMarkup._matchMetadata?.loiDiff;
            updatedPitch.matchedDbLoi = matchWithLoiMarkup._matchMetadata?.matchedDbLoi;
          } else {
            updatedPitch.hasLoiMarkup = false;
            delete updatedPitch.loiDiff;
            delete updatedPitch.matchedDbLoi;
          }

          const matchWithIrReduction = deduplicatedMatches.find(mr => (mr._matchMetadata?.irReductionPct || 0) > 0);
          if (matchWithIrReduction) {
            updatedPitch.irReductionPct = matchWithIrReduction._matchMetadata?.irReductionPct;
          } else {
            delete updatedPitch.irReductionPct;
          }

          const firstWithLimit = deduplicatedMatches.find(mr => mr.maxInternalPercent !== undefined && mr.maxInternalPercent < 100);
          if (firstWithLimit) {
            updatedPitch.maxInternalPercent = firstWithLimit.maxInternalPercent;
          }

          // Remove any leftover vendor slots beyond activeVendorsList length
          for (const key of Object.keys(updatedPitch)) {
            const vm = key.match(/^vendor(\d+)(Cpi|Pct|PctOverride)?$/i);
            if (vm && parseInt(vm[1], 10) > numActiveVendors) {
              delete (updatedPitch as any)[key];
            }
          }
          for (let idx = 0; idx < numActiveVendors; idx++) {
            const vIdx = idx + 1;
            (updatedPitch as any)[`vendor${vIdx}`] = aggregatedVendors[vIdx] || 0;
            (updatedPitch as any)[`vendor${vIdx}Cpi`] = aggregatedVendorCpis[vIdx] || 0;
          }
        } else {
          // No match or gibberish country: 0 output and clear stale blocking overrides
          updatedPitch.internal = 0;
          updatedPitch.hasLoiMarkup = false;
          delete updatedPitch.loiDiff;
          delete updatedPitch.matchedDbLoi;
          delete updatedPitch.irReductionPct;
          if (!isSilent) {
            delete updatedPitch.maxInternalPercent;
            delete updatedPitch.internalPctOverride;
            delete updatedPitch.overlapVariable;
          }
          for (const key of Object.keys(updatedPitch)) {
            if (!isSilent && /^vendor\d+PctOverride$/i.test(key)) {
              delete (updatedPitch as any)[key];
            }
            const vm = key.match(/^vendor(\d+)(Cpi)?$/i);
            if (vm && parseInt(vm[1], 10) > activeVendorsList.length) {
              delete (updatedPitch as any)[key];
            }
          }
          const numActiveVendors = activeVendorsList.length;
          for (let idx = 0; idx < numActiveVendors; idx++) {
            const vIdx = idx + 1;
            (updatedPitch as any)[`vendor${vIdx}`] = 0;
            (updatedPitch as any)[`vendor${vIdx}Cpi`] = 0;
          }
        }

        updatedPitches.push(updatedPitch);
      });

      return { updatedPitches, activeVendorsList };
    };

    const activeDb: FeasibilityRow[] = (insertedDatabase && insertedDatabase.length > 0)
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

    try {
      const { updatedPitches, activeVendorsList } = aggregateCapabilities(activeDb);

      // Target pricing optimized check
      if (targetedBudget > 0) {
        const allocsCurrent = isOptimized
          ? calculateOptimizedAllocations(updatedPitches, activeStrategy, activeVendorsList, targetedBudget, activeAllowSameLineTwice)
          : calculateAllRows(updatedPitches, activeStrategy, activeVendorsList, activeAllowSameLineTwice);
        const costCurrent = allocsCurrent.reduce((sum, item) => sum + (item.totalCost || 0), 0);
        if (costCurrent > targetedBudget && !isOptimized) {
          const allocsCost = calculateAllRows(updatedPitches, 'cost', activeVendorsList, activeAllowSameLineTwice);
          const costCost = allocsCost.reduce((sum, item) => sum + (item.totalCost || 0), 0);
          if (costCost <= targetedBudget) {
            handleChangeStrategy('cost');
          }
        }
      }

      if (isSilent) {
        isSystemUpdatingRef.current = true;
        setPitches(updatedPitches);
        setHasChecked(true);
        isSystemUpdatingRef.current = false;
      } else {
        setTimeout(() => {
          isSystemUpdatingRef.current = true;
          setPitches(updatedPitches);
          setHasChecked(true);
          setIsChecking(false);
          isSystemUpdatingRef.current = false;
          setToastNotification({
            message: isOptimized
              ? `Feasibility Optimized check complete! Verified allocations with your manual adjustments and budget optimization.`
              : `Feasibility check complete! Successfully matched specifications with reference database (${activeDb.length.toLocaleString()} records) and compiled standard allocations.`,
            type: 'success'
          });
        }, 200);
      }
      return;
    } catch (err: any) {
      console.warn("Error running local lookup database:", err);
      if (!isSilent) {
        setIsChecking(false);
        setToastNotification({
          message: `Error executing feasibility check: ${err.message || err}`,
          type: 'error'
        });
      }
    }
  };

  const handleUpdatePitches = (newPitches: FeasibilityRow[], preserveHasChecked?: boolean) => {
    setPitches(newPitches);
    if (liveFeasibility && !isSystemUpdatingRef.current) {
      // Execute background calculation silently and automatically to update stats in real time
      executeCheck(useOptimizedRules, newPitches, true);
    } else if (!preserveHasChecked) {
      setHasChecked(false);
    }
  };

  const handleUpdateVendorOverride = (updatedVendor: VendorTier) => {
    const key = updatedVendor.name.toLowerCase().trim();
    const nextOverrides: Record<string, VendorTier> = {
      ...vendorOverrides,
      [key]: { ...updatedVendor }
    };
    setVendorOverrides(nextOverrides);
    safeStorage.setItem('procurement_vendor_overrides', JSON.stringify(nextOverrides));

    if (liveFeasibility && pitches.length > 0 && !isSystemUpdatingRef.current) {
      executeCheck(useOptimizedRules, pitches, true, allowSameLineTwice, nextOverrides);
    }
  };

  const handleAddManualVendor = (newVendors: VendorTier[], newPitches: FeasibilityRow[]) => {
    isSystemUpdatingRef.current = true;
    setVendors(newVendors);
    setPitches(newPitches);
    if (liveFeasibility) {
      setHasChecked(true);
    }
    isSystemUpdatingRef.current = false;
  };

  const handleRunCheapestFromChat = async (mode: 'reset' | 'keep') => {
    handleChangeStrategy('cost');
    if (mode === 'reset') {
      const clearedPitches = resetManualAdjustments(pitches);
      await executeCheck(false, clearedPitches, false, allowSameLineTwice);
    } else {
      await executeCheck(true, pitches, false, allowSameLineTwice);
    }
  };

  // Set up clock update with timeZone options
  const handleUpdateSelectedCityTz = (tz: string) => {
    setSelectedCityTz(tz);
    safeStorage.setItem('procurement_selected_tz', tz);
  };

  useEffect(() => {
    const updateTime = () => {
      try {
        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: selectedCityTz
        });
        setCurrentTime(timeStr);
      } catch (err) {
        setCurrentTime(new Date().toLocaleTimeString());
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);

    return () => clearInterval(timer);
  }, [selectedCityTz]);

  const rawAllocations = useMemo(() => {
    return useOptimizedRules
      ? calculateOptimizedAllocations(pitches, activeStrategy, vendors, targetedBudget, allowSameLineTwice)
      : calculateAllRows(pitches, activeStrategy, vendors, allowSameLineTwice);
  }, [pitches, activeStrategy, vendors, targetedBudget, allowSameLineTwice, useOptimizedRules]);

  const computedAllocations = rawAllocations;

  // Handlers for Custom Capability Database uploads
  const [isImportingDb, setIsImportingDb] = useState(false);

  // Handlers for Custom Capability Database uploads (.csv, or .xlsx converted to CSV by the server)
  const handleInsertDatabaseCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const isExcel = /\.xlsx?m?$/i.test(file.name);
    setIsImportingDb(true);
    try {
      let text: string;
      try {
        text = isExcel ? await api.convertDatabaseXlsx(file) : await file.text();
      } catch (err: any) {
        alert(`Could not read the database file: ${err.message || err}`);
        return;
      }

      let parsed: FeasibilityRow[];
      try {
        parsed = text ? parseCSVToPitches(text) : [];
      } catch (err: any) {
        setToastNotification({
          message: `Error parsing database CSV: ${err.message || err}`,
          type: 'error'
        });
        return;
      }

      if (parsed.length === 0) {
        setToastNotification({
          message: "Could not parse any rows from this file. Ensure columns match the required fields.",
          type: 'error'
        });
        return;
      }

      try {
        await api.saveDatabase(parsed, file.name);
      } catch (err: any) {
        alert(`Could not save the database to the server: ${err.message || err}`);
        return;
      }
      setInsertedDatabase(parsed);
      setToastNotification({
        message: `Successfully loaded local database! ${parsed.length} entries detected. Click "Check Feasibility" to match.`,
        type: 'success'
      });
    } finally {
      setIsImportingDb(false);
    }
  };

  const handleGlobalReset = async (shouldSave: boolean) => {
    try {
      if (shouldSave) {
        const finalName = resetBackupName.trim() || `Backup_${new Date().toLocaleDateString()}_Option`;
        const nameExists = savedOptions.some(o => o.name.toLowerCase() === finalName.toLowerCase());
        if (nameExists && savedOptions.length > 0) {
          setToastNotification({
            message: "An option with that name already exists. Please choose a different name to backup.",
            type: 'error'
          });
          return;
        }
        const newSaved = {
          id: `saved-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: finalName,
          timestamp: new Date().toLocaleString(),
          data: JSON.parse(JSON.stringify(pitches))
        };
        await api.createSavedOption(newSaved);
        setSavedOptions([...savedOptions, newSaved]);
      }

      if (resetAlsoDatabase) {
        await api.deleteDatabase();
        setInsertedDatabase(null);
      }
    } catch (err: any) {
      alert(`Could not reach the server: ${err.message || err}`);
      return;
    }

    // Clear quote lines, budget, and chat history while preserving the active database and Partner Mapping overrides
    setPitches([]);
    setVendors(getActiveVendorsForPitches([], vendorOverrides));
    safeStorage.setItem('procurement_scenario_pitches', JSON.stringify([]));
    handleSetTargetedBudget(0);
    setChatMessages([]);
    safeStorage.removeItem('procurement_continuous_chat');
    setHasChecked(false);
    setResetBackupName('');
    setResetAlsoDatabase(false);
    setShowResetDialog(false);

    setToastNotification({
      message: shouldSave ? "Current scenario saved, and quote & chat history have been reset (database preserved)!" : "Quote reset: Audience lines, budget, and chat history cleared (database preserved).",
      type: 'info'
    });
  };

  // Quick stats computed for top layout
  const activePitchesCount = pitches.length;
  const totalWantedSamplesList = pitches.reduce((sum, p) => sum + p.totalSampleSize, 0);

  return (
    <div className="min-h-screen bg-[#f4f6f8] flex flex-col font-sans text-[#1a202c]" id="feasibility-matrix-app-root">

      {/* 1. High-Density White Clean Header */}
      <header className="bg-white border-b border-slate-200" id="applet-top-header">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-gradient-to-br from-[#2b6cb0] to-indigo-700 text-white rounded-lg shadow-xs ring-1 ring-[#2b6cb0]/20">
              <Compass className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="flex items-baseline gap-1.5 font-sans tracking-tight leading-none">
                <span className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-[#2b6cb0] to-indigo-700 bg-clip-text text-transparent">
                  AFI
                </span>
                <span className="text-slate-300 font-light text-base select-none">-</span>
                <span className="text-sm sm:text-base font-bold text-[#2b6cb0]">
                  Automated <span className="text-slate-900">Feasibility</span> Intelligence
                </span>
              </h1>
              <span className="bg-[#f0fff4] text-emerald-800 text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-200">
                Live Preview
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Unified Settings Dropdown Button */}
            <div className="relative" ref={settingsDropdownRef}>
              <button
                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                className="flex items-center gap-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer select-none"
                title="Display & Feasibility Settings"
              >
                <Settings className="h-3.5 w-3.5 text-slate-500" />
                <span>Settings</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {showSettingsDropdown && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50 animate-fade-in space-y-1">
                  <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">
                    Feasibility Mode
                  </div>
                  <div className="px-3.5 py-1.5 flex items-center justify-between hover:bg-slate-50 rounded-lg mx-1.5">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-700">Live Feasibility</span>
                      <span className="text-[8.5px] text-slate-400 leading-tight">Auto-solve as you edit</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLiveFeasibility();
                      }}
                      className={`relative inline-flex h-4.5 w-8.5 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        liveFeasibility ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      title="When on, feasibility updates automatically in the background as you edit."
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          liveFeasibility ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-t border-b border-slate-100 mt-2 mb-1">
                    Feasibility Font Size
                  </div>
                  <div className="px-3.5 py-2 space-y-2 select-none">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Grid Text Size:</span>
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-[#2b6cb0]">
                        {tempFontSizeDelta === -2 ? "Compact (9pt)" :
                         tempFontSizeDelta === -1 ? "Small (10.5pt)" :
                         tempFontSizeDelta === 0 ? "Standard (12pt)" :
                         tempFontSizeDelta === 1 ? "Medium (13.5pt)" : "Large (15pt)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tempFontSizeDelta > -2) {
                            const next = tempFontSizeDelta - 1;
                            setTempFontSizeDelta(next);
                            handleUpdateFontSizeDelta(next);
                          }
                        }}
                        className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-xs font-bold text-slate-700 active:scale-95 cursor-pointer"
                        title="Decrease size"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="-2"
                        max="2"
                        step="1"
                        value={tempFontSizeDelta}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setTempFontSizeDelta(val);
                          handleUpdateFontSizeDelta(val);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2b6cb0]"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tempFontSizeDelta < 2) {
                            const next = tempFontSizeDelta + 1;
                            setTempFontSizeDelta(next);
                            handleUpdateFontSizeDelta(next);
                          }
                        }}
                        className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-xs font-bold text-slate-700 active:scale-95 cursor-pointer"
                        title="Increase size"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateFontSizeDelta(tempFontSizeDelta);
                        setShowSettingsDropdown(false);
                      }}
                      className="w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] py-1 rounded transition-all mt-1 cursor-pointer shadow-xs active:scale-95"
                    >
                      Apply & Close
                    </button>
                  </div>

                  <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-t border-b border-slate-100 mt-2 mb-1">
                    System Architecture & Rules
                  </div>
                  <div className="px-3.5 py-1.5 space-y-1.5 select-none">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setIsGeneratingDoc(true);
                        try {
                          await downloadComprehensiveRulesManual(pitches, vendors, selectedCityTz, insertedDatabase);
                        } catch (err) {
                          console.error("Error generating manual:", err);
                          setToastNotification({
                            message: "Error generating documentation Word file.",
                            type: 'error'
                          });
                        } finally {
                          setIsGeneratingDoc(false);
                          setShowSettingsDropdown(false);
                        }
                      }}
                      disabled={isGeneratingDoc}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#2b6cb0] to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-[11px] py-2 px-2.5 rounded-lg shadow-xs transition-all cursor-pointer select-none active:scale-95 disabled:opacity-50"
                      title="Download complete system specification, tab linkages, button workflows, feasibility engine rules, and assumptions as a local Word document (.docx)"
                    >
                      <FileDown className="h-4 w-4 shrink-0" />
                      <span>{isGeneratingDoc ? 'Generating Word (.docx)...' : 'Download Complete Rules Manual (.docx)'}</span>
                    </button>
                    <p className="text-[8.5px] text-slate-400 text-center leading-tight">
                      100% local client-side generation. No external Drive connection required.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={tzDropdownRef}>
              <button
                onClick={() => setShowTzDropdown(!showTzDropdown)}
                className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] shrink-0 font-mono transition cursor-pointer select-none"
                title="Click to select custom city timezone"
              >
                <Clock className="h-3.5 w-3.5 text-[#2b6cb0]" />
                <span className="text-[#2b6cb0] font-bold">{currentTime}</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600 font-semibold truncate max-w-[90px]">
                  {selectedCityTz.split('/').pop()?.replace('_', ' ') || selectedCityTz}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {showTzDropdown && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-lg border border-slate-200 shadow-xl py-1 z-50 animate-fade-in divide-y divide-slate-100">
                  <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                    Select Your City
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {[
                      { city: 'London (GMT)', tz: 'Europe/London' },
                      { city: 'New York (EST)', tz: 'America/New_York' },
                      { city: 'Tokyo (JST)', tz: 'Asia/Tokyo' },
                      { city: 'Paris (CET)', tz: 'Europe/Paris' },
                      { city: 'Sydney (AEST)', tz: 'Australia/Sydney' },
                      { city: 'Bucharest (EET)', tz: 'Europe/Bucharest' },
                      { city: 'UTC / GMT', tz: 'UTC' }
                    ].map((item) => (
                      <button
                        key={item.tz}
                        onClick={() => {
                          handleUpdateSelectedCityTz(item.tz);
                          setShowTzDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition cursor-pointer flex items-center justify-between ${
                          selectedCityTz === item.tz
                            ? 'bg-blue-50 text-blue-700 font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <span className="truncate">{item.city}</span>
                        {selectedCityTz === item.tz && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 3. Main Body Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 flex flex-col gap-4" id="primary-dashboard-frame">

        {/* Navigation Sidebar Tabs */}
        <div className="flex flex-wrap border-b border-slate-200 gap-1 bg-white p-1 rounded-t-xl border border-b-0 border-slate-200" id="nav-tabs-rail">
          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${activeTab === 'calculator' ? 'bg-[#ebf8ff] text-[#2b6cb0] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <TrendingDown className="h-4 w-4" />
            Feasibility Cost Optimizer
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scenarios')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${activeTab === 'scenarios' ? 'bg-[#ebf8ff] text-[#2b6cb0] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <Database className="h-4 w-4" />
            Manage Scenario Specifications
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vendors')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${activeTab === 'vendors' ? 'bg-[#ebf8ff] text-[#2b6cb0] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <Layers className="h-4 w-4" />
            Partner Mapping
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${activeTab === 'chat' ? 'bg-[#ebf8ff] text-[#2b6cb0] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <MessageSquare className="h-4 w-4" />
            Chat Assistant
          </button>

          {/* Saved Options Dropdown container */}
          <div className="relative">
            <button
              id="saved-options-dropdown-trigger"
              onClick={() => {
                if (!savedDropdownOpen) refreshSavedOptions();
                setSavedDropdownOpen(!savedDropdownOpen);
              }}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${savedDropdownOpen ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'text-slate-600 hover:text-[#1a202c] hover:bg-slate-50'}`}
            >
              <FolderHeart className="h-4 w-4 text-indigo-700" />
              Saved Options
              <ChevronDown className={`h-3 w-3 transition-transform ${savedDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {savedDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSavedDropdownOpen(false)}></div>
                <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-20 animate-fade-in text-slate-700">
                  <div className="px-3 pb-1.5 mb-1.5 border-b border-indigo-100 text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-sans">
                    Saved Specifications Limit ({savedOptions.length})
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {savedOptions.length === 0 ? (
                      <div className="px-3 py-4 text-center text-slate-400 text-[11px] font-sans">
                        No saved options yet.<br/>
                        Save specs via the button in the calculator tab to view here.
                      </div>
                    ) : (
                      savedOptions.map((opt) => (
                        <div key={opt.id} className="flex items-center justify-between gap-1 px-3 py-1.5 hover:bg-slate-50 text-xs transition border-b border-slate-50 last:border-b-0">
                          <button
                            onClick={() => {
                              setPitches(opt.data);
                              setHasChecked(true);
                              setActiveTab('calculator');
                              setSavedDropdownOpen(false);
                            }}
                            className="flex-1 text-left font-sans truncate hover:text-[#2b6cb0] focus:outline-none cursor-pointer"
                            title={`Load specifications for "${opt.name}"`}
                          >
                            <span className="font-semibold block truncate leading-tight text-slate-800">{opt.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono block">{opt.timestamp}</span>
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.deleteSavedOption(opt.id);
                                setSavedOptions((prev) => prev.filter((o) => o.id !== opt.id));
                              } catch (err: any) {
                                alert(`Could not delete saved option: ${err.message || err}`);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition shrink-0 cursor-pointer"
                            title="Delete saved option"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Insert Database File Trigger Button */}
          <div className="flex items-center gap-1">
            <input
              type="file"
              ref={dbFileInputRef}
              onChange={handleInsertDatabaseCSV}
              accept=".csv,.xlsx,.xlsm"
              className="hidden"
            />
            <button
              id="insert-db-nav-btn"
              onClick={() => dbFileInputRef.current?.click()}
              disabled={isImportingDb}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer border ${
                insertedDatabase
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                  : 'text-slate-600 hover:text-[#1a202c] hover:bg-slate-50 border-transparent'
              }`}
              title="Insert a custom CSV or Excel (.xlsx) database for feasibility lookups"
            >
              <Database className={`h-4 w-4 shrink-0 ${insertedDatabase ? 'text-emerald-600 animate-pulse' : 'text-slate-500'}`} />
              <span>{isImportingDb ? 'Loading database...' : insertedDatabase ? `Database: Active (${insertedDatabase.length} rows)` : 'Insert Database'}</span>
            </button>
            <button
              id="global-reset-quote-nav-btn"
              onClick={() => setShowResetDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition shadow-xs cursor-pointer ml-1"
              title="Reset Quote: clear all audiences, set budget to 0, and clear all lines"
            >
              <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
              <span>Reset Quote</span>
            </button>
          </div>
        </div>

        {/* Tab contents wrapper */}
        <div id="tab-viewport" className="w-full">
          {activeTab === 'calculator' && (
            <SpecsCalculator
              pitches={pitches}
              activeStrategy={activeStrategy}
              onChangeStrategy={handleChangeStrategy}
              onUpdatePitches={handleUpdatePitches}
              savedOptions={savedOptions}
              setSavedOptions={setSavedOptions}
              hasChecked={hasChecked}
              setHasChecked={setHasChecked}
              isChecking={isChecking}
              setIsChecking={setIsChecking}
              isReloading={isReloading}
              setIsReloading={setIsReloading}
              onStartChecking={handleStartChecking}
              onStartCheckingForOptions={handleStartCheckingForOptions}
              onStartCheckingOptimized={handleStartCheckingOptimized}
              allocations={computedAllocations}
              checkingError={checkingError}
              vendors={vendors}
              onToggleChat={() => setIsChatOpen(!isChatOpen)}
              onNewSpecsFileAttached={handleNewSpecsFileAttached}
              targetedBudget={targetedBudget}
              setTargetedBudget={handleSetTargetedBudget}
              liveFeasibility={liveFeasibility}
              onToggleLiveFeasibility={handleToggleLiveFeasibility}
              insertedDatabase={insertedDatabase}
              feasibilityFontSizeDelta={feasibilityFontSizeDelta}
              onResetQuote={() => setShowResetDialog(true)}
              onNotify={setToastNotification}
            />
          )}

          {activeTab === 'scenarios' && (
            <DatabaseGrid
              pitches={pitches}
              activeStrategy={activeStrategy}
              onUpdatePitches={handleUpdatePitches}
              onResetToDefault={() => setShowResetDialog(true)}
              savedOptions={savedOptions}
              setSavedOptions={setSavedOptions}
              hasChecked={hasChecked}
              setHasChecked={setHasChecked}
              isChecking={isChecking}
              setIsChecking={setIsChecking}
              isReloading={isReloading}
              setIsReloading={setIsReloading}
              onStartChecking={handleStartChecking}
              onStartCheckingForOptions={handleStartCheckingForOptions}
              onStartCheckingOptimized={handleStartCheckingOptimized}
              allocations={computedAllocations}
              vendors={vendors}
              onUpdateVendors={setVendors}
              onNewSpecsFileAttached={handleNewSpecsFileAttached}
              insertedDatabase={insertedDatabase}
              targetedBudget={targetedBudget}
              feasibilityFontSizeDelta={feasibilityFontSizeDelta}
              liveFeasibility={liveFeasibility}
              vendorOverrides={vendorOverrides}
              onAddManualVendor={handleAddManualVendor}
              onNotify={setToastNotification}
            />
          )}

          {activeTab === 'chat' && (
            <ChatPane
              pitches={pitches}
              insertedDatabase={insertedDatabase}
              allocations={computedAllocations}
              activeStrategy={activeStrategy}
              vendors={vendors}
              vendorOverrides={vendorOverrides}
              onUpdatePitches={handleUpdatePitches}
              messages={chatMessages}
              setMessages={setChatMessages}
              onUpdateStrategy={handleChangeStrategy}
              onRunCheapestWithMode={handleRunCheapestFromChat}
              isFloating={false}
            />
          )}

          {activeTab === 'vendors' && (
            <VendorManager
              vendors={vendors}
              onUpdateVendors={setVendors}
              vendorOverrides={vendorOverrides}
              onUpdateVendorOverride={handleUpdateVendorOverride}
            />
          )}
        </div>
      </main>

      {/* Floating moveable and resizable Chat box */}
      {isChatOpen && (
        <ChatPane
          pitches={pitches}
          insertedDatabase={insertedDatabase}
          allocations={computedAllocations}
          activeStrategy={activeStrategy}
          vendors={vendors}
          vendorOverrides={vendorOverrides}
          onUpdatePitches={handleUpdatePitches}
          messages={chatMessages}
          setMessages={setChatMessages}
          onUpdateStrategy={handleChangeStrategy}
          onRunCheapestWithMode={handleRunCheapestFromChat}
          isFloating={true}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {/* Reset Quote pop-out modal */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" id="global-reset-modal">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <RotateCcw className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900">Reset Quote Confirmation</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to reset this quote? This will clear all audiences, set the budget to $0, and remove all existing lines so you can add rows manually or upload a new Excel file.
            </p>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="text-[10px] text-slate-500 font-bold uppercase block">Save current interaction first (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Scenario Backup"
                value={resetBackupName}
                onChange={(e) => setResetBackupName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
              />
              <p className="text-[10px] text-slate-400">If you want to save your current quote before resetting, enter a name above. Otherwise leave it blank.</p>
            </div>

            {insertedDatabase && (
              <label className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetAlsoDatabase}
                  onChange={(e) => setResetAlsoDatabase(e.target.checked)}
                  className="mt-0.5 accent-rose-600 cursor-pointer"
                />
                <span>
                  Also remove the inserted capability database ({insertedDatabase.length} rows).
                  <span className="block text-[10px] text-rose-500 font-medium">The database is shared, so this removes it for every user of this server.</span>
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2 text-xs pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowResetDialog(false);
                  setResetBackupName('');
                  setResetAlsoDatabase(false);
                }}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleGlobalReset(false);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition font-bold cursor-pointer"
              >
                Reset Quote (Set to 0)
              </button>
              <button
                type="button"
                onClick={() => {
                  handleGlobalReset(true);
                }}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition font-bold shadow-sm cursor-pointer"
              >
                Save &amp; Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Feasibility confirmation modal when clicking Standard Feasibility Check */}
      {showStandardCheckDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" id="standard-check-modal">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900">Reset Custom Adjustments?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You have made manual specifications adjustments (such as edited panel blends, custom internal/external ceilings, or targeted CPI overrides).
              <br/><br/>
              Standard feasibility check will completely <strong>reset</strong> these manual overrides back to official specifications defaults before calculating. Are you sure you want to proceed and reset your custom adjustments?
            </p>

            <div className="flex justify-end gap-2 text-xs pt-1 border-t border-slate-100 pt-3">
              <button
                onClick={() => {
                  setShowStandardCheckDialog(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-bold cursor-pointer"
              >
                No, Cancel
              </button>
              <button
                onClick={async () => {
                  setShowStandardCheckDialog(false);
                  const resetPitches = resetManualAdjustments(pitches);
                  await executeCheck(false, resetPitches, false, false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition font-bold cursor-pointer"
                title="Wipes out all manual overrides (panel blends, CPI ceilings) to match pure database defaults"
              >
                Yes, Reset & Run
              </button>
              <button
                onClick={async () => {
                  setShowStandardCheckDialog(false);
                  await executeCheck(false, pitches, false, false);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-sm transition"
                title="Runs standard check while keeping all your custom manual overrides intact"
              >
                Keep & Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Feasibility confirmation modal when clicking Feasibility for Options */}
      {showOptionsCheckDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" id="options-check-modal">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900">Reset Custom Adjustments?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You have made manual specifications adjustments (such as edited panel blends, custom internal/external ceilings, or targeted CPI overrides).
              <br/><br/>
              Feasibility for options check will completely <strong>reset</strong> these manual overrides back to official specifications defaults before calculating. Are you sure you want to proceed and reset your custom adjustments?
            </p>

            <div className="flex justify-end gap-2 text-xs pt-1 border-t border-slate-100 pt-3">
              <button
                onClick={() => {
                  setShowOptionsCheckDialog(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-bold cursor-pointer"
              >
                No, Cancel
              </button>
              <button
                onClick={async () => {
                  setShowOptionsCheckDialog(false);
                  const resetPitches = resetManualAdjustments(pitches);
                  await executeCheck(false, resetPitches, false, true);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition font-bold cursor-pointer"
                title="Wipes out all manual overrides (panel blends, CPI ceilings) to match pure database defaults"
              >
                Yes, Reset & Run
              </button>
              <button
                onClick={async () => {
                  setShowOptionsCheckDialog(false);
                  await executeCheck(false, pitches, false, true);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-sm transition"
                title="Runs feasibility for options check while keeping all your custom manual overrides intact"
              >
                Keep & Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Feasibility Optimized modal */}
      {showOptimizedCheckDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" id="optimized-check-modal">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-indigo-600">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900">Run Feasibility Optimization?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to run the feasibility optimization with your current custom manual adjustments (including edited panel blends, targeted budget constraints, and targeted CPIs)?
              <br/><br/>
              Optimization will evaluate across all active database suppliers (166+ authoritative tiers, scalable to 1,000+ columns), following <strong>{allowSameLineTwice ? 'Feasibility for Options (reusing feasibility across scenarios)' : 'Feasibility for Targets (unique inventory per target)'}</strong> based on your previous check mode.
              <br/><br/>
              If any target lines are unfeasible under your manual adjustments or exceed our targeted budget limit, they will automatically fall back to standard cost-optimized rules to ensure full feasibility.
            </p>

            <div className="flex justify-end gap-2 text-xs pt-1 border-t border-slate-100 pt-3">
              <button
                onClick={() => {
                  setShowOptimizedCheckDialog(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-bold cursor-pointer"
              >
                No, Cancel
              </button>
              <button
                onClick={async () => {
                  setShowOptimizedCheckDialog(false);
                  await executeCheck(true, pitches, false, allowSameLineTwice);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-bold cursor-pointer"
              >
                Yes, Optimize & Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastNotification && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-[100] max-w-md flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-xs font-medium animate-fade-in ${
            toastNotification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : toastNotification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-slate-800'
          }`}
        >
          {toastNotification.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          ) : toastNotification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="h-4 w-4 text-[#2b6cb0] shrink-0 mt-0.5" />
          )}
          <span className="flex-1 leading-snug">{toastNotification.message}</span>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
            title="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 4. Elegant Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-400 text-center" id="applet-bottom-footer">
        <p>© 2026 Pitch Feasibility & Cost Optimizer. Self-hosted on Flask &amp; SQLite.</p>
      </footer>
    </div>
  );
}
