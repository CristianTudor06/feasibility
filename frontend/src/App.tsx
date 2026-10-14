import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FeasibilityRow, VendorTier, StrategyType, ChatMessage } from './types';
import { DEFAULT_PITCHES, DEFAULT_VENDORS, VENDOR_DATABASE_POOL } from './data/defaultData';
import { safeStorage } from './lib/storage';
import { api, SavedOption } from './lib/api';
import { downloadBRDDocument, downloadSetupManualDocument } from './lib/docxGenerator';
import { parseCSVToPitches } from './lib/csvParser';
import { calculateAllRows, calculateOptimizedAllocations, deduplicateDbRows } from './lib/calculator';
import { generateBoardPresentation } from './lib/pptxGenerator';

// Import newly created modular components
import DatabaseGrid from './components/DatabaseGrid';
import SpecsCalculator from './components/SpecsCalculator';
import ChatPane from './components/ChatPane';
import VendorManager from './components/VendorManager';

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
  Settings,
  Settings2,
  Presentation
} from 'lucide-react';

export default function App() {
  // Primary state holding our entire active workflow
  const [pitches, setPitches] = useState<FeasibilityRow[]>(DEFAULT_PITCHES);
  const [vendors, setVendors] = useState<VendorTier[]>(DEFAULT_VENDORS);
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

  // Feasibility strategy change handler with confirmation checks
  const handleChangeStrategy = (newStrategy: StrategyType) => {
    if (activeStrategy === newStrategy) return;
    if (hasManualAdjustments()) {
      const ok = window.confirm(
        "Manual adjustments have been made to your specifications. Changing the Feasibility Strategy will affect your manual adjustments and overwrite current allocations. Do you want to proceed and change?"
      );
      if (!ok) return;
    }
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
    setVendors(DEFAULT_VENDORS);
    setHasChecked(false);
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
  const settingsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setShowSettingsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDownloadBrdDocx = async () => {
    try {
      await downloadBRDDocument(pitches, computedAllocations, activeStrategy, vendors, selectedCityTz);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to download BRD Word document: ${err.message || err}`);
    }
  };

  const handleDownloadSetupDocx = async () => {
    try {
      await downloadSetupManualDocument(pitches, vendors, selectedCityTz);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to download Setup Manual: ${err.message || err}`);
    }
  };

  const hasManualAdjustments = () => {
    return pitches.some(p => {
      if (p.maxInternalPercent !== undefined && p.maxInternalPercent !== 100) return true;
      if (p.targetedCpi !== undefined && p.targetedCpi > 0) return true;
      for (let i = 1; i <= 8; i++) {
        if ((p as any)[`vendor${i}PctOverride`] !== undefined) return true;
        if ((p as any)[`vendor${i}Pct`] !== undefined && (p as any)[`vendor${i}Pct`] !== 100) return true;
      }
      return false;
    });
  };

  const resetManualAdjustments = (pList: FeasibilityRow[]) => {
    return pList.map(p => {
      const copy = { ...p };
      if ('targetedCpi' in copy) delete copy.targetedCpi;
      copy.maxInternalPercent = 100;
      for (let i = 1; i <= 8; i++) {
        if (`vendor${i}PctOverride` in copy) delete (copy as any)[`vendor${i}PctOverride`];
        (copy as any)[`vendor${i}Pct`] = 100;
      }
      return copy;
    });
  };

  const handleStartChecking = async () => {
    if (pitches.length === 0) {
      alert("No active specifications found. Please insert or load options first!");
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
      alert("No active specifications found. Please insert or load options first!");
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
      alert("No active specifications found. Please insert or load options first!");
      return;
    }
    setShowOptimizedCheckDialog(true);
  };

  const executeCheck = async (isOptimized: boolean, pitchesToUse: FeasibilityRow[], isSilent: boolean = false, optAllowSameLineTwice?: boolean) => {
    if (!isSilent) {
      setIsChecking(true);
      setCheckingError('');
    }
    setUseOptimizedRules(isOptimized);

    const activeAllowSameLineTwice = optAllowSameLineTwice !== undefined ? optAllowSameLineTwice : allowSameLineTwice;
    if (optAllowSameLineTwice !== undefined) {
      setAllowSameLineTwice(optAllowSameLineTwice);
    }

    const isNoQuotas = (qStr: string): boolean => {
      const s = qStr.toLowerCase().trim();
      return !s || s === 'no' || s === 'no quotas' || s === 'none' || s === 'no quota' || s === 'n/a' || s === 'noquotas';
    };

    const matchDbRowToPitchSpec = (dbRow: FeasibilityRow, pitch: FeasibilityRow): boolean => {
      // Country/Market check (clean case-insensitive comparison of alphanumeric characters)
      const m1 = String(dbRow.market || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const m2 = String(pitch.market || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (m1 !== m2) return false;

      // B. LOI Check
      const loiDb = Number(dbRow.loi || 0);
      const loiPitch = Number(pitch.loi || 0);
      if (loiDb > 0 && loiPitch > 0 && Math.round(loiDb) !== Math.round(loiPitch)) {
        return false;
      }

      // C. IR% (with narrow margin of exact match or extremely close within 0.5% for precise apples-to-apples)
      const irDb = Number(dbRow.irPercent || 0);
      const irPitch = Number(pitch.irPercent || 0);
      if (irDb > 0 && irPitch > 0 && Math.abs(irDb - irPitch) > 0.005) {
        return false;
      }

      // D. IR Universe (or Target) synonymic exact/clean apples-to-apples matching
      const u1Db = String(dbRow.irUniverse || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const u1Pitch = String(pitch.irUniverse || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tDb = String(dbRow.target || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tPitch = String(pitch.target || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (u1Pitch) {
        const universeMatch = (u1Db === u1Pitch) || (tDb === tPitch);
        if (!universeMatch) return false;
      }

      // E. Quotas specification check with special "No" fallback rule
      const qDbClean = String(dbRow.quotas || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const qPitchClean = String(pitch.quotas || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const pitchNoQuotas = isNoQuotas(qPitchClean);
      const dbNoQuotas = isNoQuotas(qDbClean);

      if (!pitchNoQuotas) {
        // Specs require quotas, so DB row MUST have quotas (cannot be no-quotas)
        if (dbNoQuotas) {
          return false;
        }
        // And must match the specific quotas
        if (qDbClean !== qPitchClean && !qDbClean.includes(qPitchClean) && !qPitchClean.includes(qDbClean)) {
          return false;
        }
      }

      return true;
    };

    const findBestDbMatches = (pitch: FeasibilityRow, dbRows: FeasibilityRow[], excludedIds: Set<string>): FeasibilityRow[] => {
      const candidates = dbRows.filter(dbRow => !excludedIds.has(dbRow.id));

      const scoredCandidates = candidates.map(dbRow => {
        // Country/Market check (CRITICAL: different countries can NEVER match)
        const m1 = String(dbRow.market || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const m2 = String(pitch.market || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (m1 !== m2) return { dbRow, score: -99999 };

        let score = 10; // Base score for matching Country

        // B. LOI Check
        const loiDb = Number(dbRow.loi || 0);
        const loiPitch = Number(pitch.loi || 0);
        if (loiDb > 0 && loiPitch > 0) {
          const diff = Math.abs(loiDb - loiPitch);
          if (diff === 0) score += 20;
          else if (diff <= 2) score += 15;
          else if (diff <= 5) score += 10;
          else if (diff <= 10) score += 5;
        }

        // C. IR%
        const irDb = Number(dbRow.irPercent || 0);
        const irPitch = Number(pitch.irPercent || 0);
        if (irDb > 0 && irPitch > 0) {
          const diff = Math.abs(irDb - irPitch);
          if (diff <= 0.005) score += 20;
          else if (diff <= 0.02) score += 15;
          else if (diff <= 0.05) score += 10;
          else if (diff <= 0.10) score += 5;
        }

        // D. IR Universe / Target Description
        const u1Db = String(dbRow.irUniverse || '').toLowerCase().trim();
        const u1Pitch = String(pitch.irUniverse || '').toLowerCase().trim();
        const tDb = String(dbRow.target || '').toLowerCase().trim();
        const tPitch = String(pitch.target || '').toLowerCase().trim();

        if (u1Pitch || tPitch) {
          const uDbClean = u1Db.replace(/[^a-z0-9]/g, '');
          const uPitchClean = u1Pitch.replace(/[^a-z0-9]/g, '');
          const tDbClean = tDb.replace(/[^a-z0-9]/g, '');
          const tPitchClean = tPitch.replace(/[^a-z0-9]/g, '');

          if (uPitchClean === uDbClean || tPitchClean === tDbClean) {
            score += 30; // Exact match
          } else if (uDbClean.includes(uPitchClean) || uPitchClean.includes(uDbClean) || tDbClean.includes(tPitchClean) || tPitchClean.includes(tDbClean)) {
            score += 15; // Containment match
          } else {
            // Shared words check
            const wDb = u1Db.split(/\s+/).filter(w => w.length >= 2);
            const wPitch = u1Pitch.split(/\s+/).filter(w => w.length >= 2);
            let sharedCount = 0;
            wPitch.forEach(wp => {
              if (wDb.some(wd => wd.includes(wp) || wp.includes(wd))) {
                sharedCount++;
              }
            });
            score += sharedCount * 5;
          }
        }

        // E. Quotas spec
        const qDbClean = String(dbRow.quotas || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const qPitchClean = String(pitch.quotas || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (qDbClean === qPitchClean) {
          score += 10;
        } else if (qDbClean.includes(qPitchClean) || qPitchClean.includes(qDbClean)) {
          score += 5;
        }

        return { dbRow, score };
      });

      // Filter to only matching country and sort by score descending
      const validScored = scoredCandidates.filter(item => item.score >= 10);
      if (validScored.length === 0) return [];

      validScored.sort((a, b) => b.score - a.score);

      const topScore = validScored[0].score;
      // We return all rows matching close to the topScore (within 5 points) or having general high match score >= 50
      const selected = validScored.filter(item => {
        return (item.score >= 50) || (item.score >= topScore - 5);
      });

      return selected.map(item => item.dbRow);
    };

    const aggregateCapabilities = (dbRows: FeasibilityRow[]) => {
      const deduplicatedDbRows = deduplicateDbRows(dbRows);
      // 1. Find all matching database rows across all checked pitches using scoring logic
      const allMatches: FeasibilityRow[] = [];
      const pitchGroupsTest: { [name: string]: FeasibilityRow[] } = {};
      pitchesToUse.forEach(p => {
        const name = p.pitchName || 'Default';
        if (!pitchGroupsTest[name]) pitchGroupsTest[name] = [];
        pitchGroupsTest[name].push(p);
      });

      Object.values(pitchGroupsTest).forEach(pitchGroup => {
        pitchGroup.forEach(pitch => {
          if (pitch.isLocked) {
            return; // Skip locked rows in matching
          }
          const groupMatches = findBestDbMatches(pitch, deduplicatedDbRows, new Set<string>());

          groupMatches.forEach(m => {
            allMatches.push(m);
          });
        });
      });

      // 2. Scan all matches to detect which vendors possess actual delivered capabilities (> 0 capacity)
      const foundVendorNums = new Set<number>();
      allMatches.forEach(row => {
        Object.keys(row).forEach(key => {
          const m = key.match(/^vendor(\d+)$/i);
          if (m && !key.endsWith('Cpi') && !key.endsWith('Pct') && !key.endsWith('PctOverride')) {
            const val = Number((row as any)[key]);
            if (val > 0) {
              foundVendorNums.add(parseInt(m[1], 10));
            }
          }
        });
      });

      // Find original tiers and colors configured for the detected vendors from database pool
      const detectedVendorsList: VendorTier[] = [];
      foundVendorNums.forEach(num => {
        const name = `Vendor ${num}`;
        const poolVendor = VENDOR_DATABASE_POOL.find(v => v.name.toLowerCase() === name.toLowerCase());
        if (poolVendor) {
          detectedVendorsList.push({
            name: poolVendor.name,
            tier: poolVendor.tier,
            color: poolVendor.color
          });
        } else {
          detectedVendorsList.push({
            name,
            tier: 'tier 3',
            color: 'orange'
          });
        }
      });

      // 3. Sort detected vendors strictly based on Tier and Color priorities!
      const pTierValue = (tierStr: string): number => {
        const t = String(tierStr || '').toLowerCase();
        if (t.includes('0') || t.includes('prime')) return 0;
        if (t.includes('1')) return 1;
        if (t.includes('2')) return 2;
        if (t.includes('3')) return 3;
        return 4;
      };

      const pColorValue = (colorStr: string): number => {
        const c = String(colorStr || '').toLowerCase();
        if (c.includes('green')) return 1;
        if (c.includes('yellow')) return 2;
        if (c.includes('orange')) return 3;
        return 4;
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

      const mergedVendors: VendorTier[] = [...detectedVendorsList];
      (vendors || []).forEach(v => {
        const existing = mergedVendors.find(mv => mv.name.toLowerCase() === v.name.toLowerCase());
        if (!existing) {
          if (v.isAddedManually) {
            mergedVendors.push(v);
          }
        } else if (v.isAddedManually) {
          existing.isAddedManually = true;
        }
      });
      const activeVendorsList = mergedVendors.length > 0 ? mergedVendors : DEFAULT_VENDORS;
      setVendors(activeVendorsList);

      const groups: { [name: string]: FeasibilityRow[] } = {};
      pitchesToUse.forEach(p => {
        const name = p.pitchName || 'Default';
        if (!groups[name]) groups[name] = [];
        groups[name].push(p);
      });

      const updatedPitches: FeasibilityRow[] = [];

      Object.entries(groups).forEach(([pitchName, pitchGroup]) => {
        const usedDbRowIdSet = new Set<string>();

        pitchGroup.forEach(pitch => {
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

              aggregatedInternal += mr.internal || 0;

              for (let idx = 0; idx < numActiveVendors; idx++) {
                const vIdx = idx + 1;
                const vendorObj = activeVendorsList[idx];
                const nameLower = vendorObj.name.toLowerCase();
                const matchNum = nameLower.match(/\d+/);
                const vendorNumInDb = matchNum ? parseInt(matchNum[0], 10) : vIdx;

                const dbCapKey = `vendor${vendorNumInDb}`;
                const dbCpiKey = `vendor${vendorNumInDb}Cpi`;

                const cap = Number((mr as any)[dbCapKey]) || 0;
                aggregatedVendors[vIdx] = (aggregatedVendors[vIdx] || 0) + cap;

                const cpiVal = parseFloat((mr as any)[dbCpiKey]);
                if (cpiVal > 0) {
                  aggregatedVendorCpis[vIdx] = cpiVal;
                }
              }
            });

            updatedPitch.internal = aggregatedInternal;

            const firstWithLimit = deduplicatedMatches.find(mr => mr.maxInternalPercent !== undefined);
            if (firstWithLimit) {
              updatedPitch.maxInternalPercent = firstWithLimit.maxInternalPercent;
            }

            for (let idx = 0; idx < numActiveVendors; idx++) {
              const vIdx = idx + 1;
              (updatedPitch as any)[`vendor${vIdx}`] = aggregatedVendors[vIdx] || 0;
              (updatedPitch as any)[`vendor${vIdx}Cpi`] = aggregatedVendorCpis[vIdx] || 0;
            }
          } else {
            updatedPitch.internal = 0;
            const numActiveVendors = activeVendorsList.length;
            for (let idx = 0; idx < numActiveVendors; idx++) {
              const vIdx = idx + 1;
              (updatedPitch as any)[`vendor${vIdx}`] = 0;
              (updatedPitch as any)[`vendor${vIdx}Cpi`] = 0;
            }
          }

          updatedPitches.push(updatedPitch);
        });
      });

      return updatedPitches;
    };

    // Require local database to be inserted, alert otherwise without failing
    if (!insertedDatabase || insertedDatabase.length === 0) {
      if (!isSilent) {
        setIsChecking(false);
        alert("Database not available, please insert it.");
      }
      return;
    }

    try {
      const updatedPitches = aggregateCapabilities(insertedDatabase);

      // Target pricing optimized check
      if (targetedBudget > 0) {
        const allocsCurrent = isOptimized
          ? calculateOptimizedAllocations(updatedPitches, activeStrategy, vendors, targetedBudget, activeAllowSameLineTwice)
          : calculateAllRows(updatedPitches, activeStrategy, vendors, activeAllowSameLineTwice);
        const costCurrent = allocsCurrent.reduce((sum, item) => sum + (item.totalCost || 0), 0);
        if (costCurrent > targetedBudget && !isOptimized) {
          const allocsCost = calculateAllRows(updatedPitches, 'cost', vendors, activeAllowSameLineTwice);
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
          alert(isOptimized
            ? `Feasibility Optimized check complete! Verified allocations with your manual adjustments and budget optimization.`
            : `Feasibility check complete! Successfully matched specifications with the locally inserted database (${insertedDatabase.length} records) and compiled standard allocations.`
          );
        }, 200);
      }
      return;
    } catch (err: any) {
      console.warn("Error running local lookup database:", err);
      if (!isSilent) {
        setIsChecking(false);
        alert(`Error executing feasibility check: ${err.message || err}`);
      }
    }
  };

  const handleUpdatePitches = (newPitches: FeasibilityRow[], preserveHasChecked?: boolean) => {
    setPitches(newPitches);
    if (liveFeasibility && insertedDatabase && insertedDatabase.length > 0 && !isSystemUpdatingRef.current) {
      // Execute background calculation silently and automatically to update stats in real time
      executeCheck(useOptimizedRules, newPitches, true);
    } else if (!preserveHasChecked) {
      setHasChecked(false);
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

  const rawAllocations = useOptimizedRules
    ? calculateOptimizedAllocations(pitches, activeStrategy, vendors, targetedBudget, allowSameLineTwice)
    : calculateAllRows(pitches, activeStrategy, vendors, allowSameLineTwice);

  const computedAllocations = rawAllocations;

  // Handlers for Custom Capability Database uploads
  const handleInsertDatabaseCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          if (text) {
            const parsed = parseCSVToPitches(text);
            if (parsed.length > 0) {
              await api.saveDatabase(parsed, file.name);
              setInsertedDatabase(parsed);
              alert(`Successfully loaded local lookup database! ${parsed.length} entries matching Country/Market targets detected. Click "Check Feasibility" to match with active specifications.`);
            } else {
              alert("Could not parse any rows from this file. Ensure columns match the required fields (Country/Market, Target, Internal Panel, Vendor Cap, Vendor CPI, etc.)");
            }
          }
        } catch (err: any) {
          alert(`Error parsing database CSV: ${err.message || err}`);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleGlobalReset = async (shouldSave: boolean) => {
    try {
      if (shouldSave) {
        const finalName = resetBackupName.trim() || `Backup_${new Date().toLocaleDateString()}_Option`;
        const nameExists = savedOptions.some(o => o.name.toLowerCase() === finalName.toLowerCase());
        if (nameExists && savedOptions.length > 0) {
          alert("An option with that name already exists. Please choose a different name to backup.");
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

    // Clear everything
    setPitches(DEFAULT_PITCHES);
    setVendors(DEFAULT_VENDORS);
    setHasChecked(false);
    setResetBackupName('');
    setResetAlsoDatabase(false);
    setShowResetDialog(false);

    alert(shouldSave ? "Current specifications saved, and system has been fully reset!" : "System has been fully reset!");
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
            <div className="p-1.5 bg-[#ebf8ff] text-[#2b6cb0] rounded-lg border border-[#bee3f8]">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold tracking-tight text-slate-900 font-sans">
                  CMT - <span className="text-[#2b6cb0]">Cost Management Tool</span>
                </h1>
                <span className="bg-[#ebf8ff] text-[#2b6cb0] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-[#bee3f8]">
                  Set A-L Connected
                </span>
                <span className="bg-[#f0fff4] text-emerald-800 text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-200">
                  Live Preview
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Unified Settings Dropdown Button */}
            <div className="relative" ref={settingsDropdownRef}>
              <button
                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                className="flex items-center gap-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer select-none"
                title="Document downloads and preferences"
              >
                <Settings className="h-3.5 w-3.5 text-slate-500" />
                <span>Settings</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {showSettingsDropdown && (
                <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50 animate-fade-in space-y-1">
                  <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">
                    Direct Downloads
                  </div>

                  {/* Download BRD Word File Option */}
                  <div className="px-2.5 py-1.5 hover:bg-slate-50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        handleDownloadBrdDocx();
                        setShowSettingsDropdown(false);
                      }}
                      className="flex-1 flex items-center gap-2 text-left text-xs text-slate-700 hover:text-blue-700 font-semibold cursor-pointer"
                      title="Download BRD Document (.docx) directly"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">Download BRD (.docx)</span>
                    </button>
                    <span className="text-[8px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200">Local</span>
                  </div>

                  {/* Download Setup Manual Option */}
                  <div className="px-2.5 py-1.5 hover:bg-slate-50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        handleDownloadSetupDocx();
                        setShowSettingsDropdown(false);
                      }}
                      className="flex-1 flex items-center gap-2 text-left text-xs text-slate-700 hover:text-blue-700 font-semibold cursor-pointer"
                      title="Download Setup Manual (.docx) directly"
                    >
                      <Settings2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">Download Setup (.docx)</span>
                    </button>
                    <span className="text-[8px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200">Local</span>
                  </div>

                  {/* Download Professional PPTX Presentation Option */}
                  <div className="px-2.5 py-1.5 hover:bg-slate-50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        generateBoardPresentation();
                        setShowSettingsDropdown(false);
                      }}
                      className="flex-1 flex items-center gap-2 text-left text-xs text-slate-700 hover:text-blue-700 font-semibold cursor-pointer"
                      title="Download Executive Board Presentation (.pptx) directly"
                    >
                      <Presentation className="h-3.5 w-3.5 text-[#2b6cb0] shrink-0" />
                      <span className="truncate">Download Board Deck (.pptx)</span>
                    </button>
                    <span className="text-[8px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200">Local</span>
                  </div>

                  <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-t border-b border-slate-100 mt-2 mb-1">
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
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                        {tempFontSizeDelta === 0 ? "Standard (12pt)" : tempFontSizeDelta === 1 ? "+1pt (13pt)" : "-1pt (11pt)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tempFontSizeDelta > -1) setTempFontSizeDelta(tempFontSizeDelta - 1);
                        }}
                        className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-xs font-bold text-slate-700 active:scale-95 cursor-pointer"
                        title="Decrease size by 1pt"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="1"
                        value={tempFontSizeDelta}
                        onChange={(e) => setTempFontSizeDelta(parseInt(e.target.value, 10))}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2b6cb0]"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tempFontSizeDelta < 1) setTempFontSizeDelta(tempFontSizeDelta + 1);
                        }}
                        className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-xs font-bold text-slate-700 active:scale-95 cursor-pointer"
                        title="Increase size by 1pt"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateFontSizeDelta(tempFontSizeDelta);
                      }}
                      className="w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] py-1 rounded transition-all mt-1 cursor-pointer shadow-xs active:scale-95"
                    >
                      Apply Font Size
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
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
                            : 'text-slate-650 hover:bg-slate-50 hover:text-slate-900'
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
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${activeTab === 'calculator' ? 'bg-[#ebf8ff] text-[#2b6cb0] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <TrendingDown className="h-4 w-4" />
            Feasibility Cost Optimizer
          </button>

          <button
            onClick={() => setActiveTab('scenarios')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${activeTab === 'scenarios' ? 'bg-[#ebf8ff] text-[#2b6cb0] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <Database className="h-4 w-4" />
            Manage Scenario Specifications
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${activeTab === 'chat' ? 'bg-[#ebf8ff] text-[#2b6cb0] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <MessageSquare className="h-4 w-4" />
            Chat Assistant
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${activeTab === 'vendors' ? 'bg-[#ebf8ff] text-[#2b6cb0] font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            <Layers className="h-4 w-4" />
            Partner Mapping
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
                <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-20 animate-fade-in text-slate-705">
                  <div className="px-3 pb-1.5 mb-1.5 border-b border-indigo-100 text-[10px] font-bold uppercase tracking-wider text-indigo-750 font-sans">
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
              accept=".csv"
              className="hidden"
            />
            <button
              id="insert-db-nav-btn"
              onClick={() => dbFileInputRef.current?.click()}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer border ${
                insertedDatabase
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'
                  : 'text-slate-600 hover:text-[#1a202c] hover:bg-slate-50 border-transparent'
              }`}
              title="Insert a custom CSV database for feasibility lookups"
            >
              <Database className={`h-4 w-4 shrink-0 ${insertedDatabase ? 'text-emerald-600 animate-pulse' : 'text-slate-500'}`} />
              <span>{insertedDatabase ? `Database: Active (${insertedDatabase.length} rows)` : 'Insert Database'}</span>
            </button>
            <button
              id="global-reset-bin-btn"
              onClick={() => setShowResetDialog(true)}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
              title="Reset all specifications, custom database, and clear everything done back to default"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tab contents wrapper with micro-animation */}
        <div id="tab-viewport">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
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
                />
              )}

              {activeTab === 'chat' && (
                <ChatPane
                  pitches={pitches}
                  insertedDatabase={insertedDatabase}
                  allocations={computedAllocations}
                  activeStrategy={activeStrategy}
                  vendors={vendors}
                  onUpdatePitches={handleUpdatePitches}
                  messages={chatMessages}
                  setMessages={setChatMessages}
                  onUpdateStrategy={handleChangeStrategy}
                  isFloating={false}
                />
              )}

              {activeTab === 'vendors' && (
                <VendorManager
                  vendors={vendors}
                  onUpdateVendors={setVendors}
                />
              )}
            </motion.div>
          </AnimatePresence>
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
          onUpdatePitches={setPitches}
          messages={chatMessages}
          setMessages={setChatMessages}
          onUpdateStrategy={handleChangeStrategy}
          isFloating={true}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      )}

      {/* Global Reset pop-out modal */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" id="global-reset-modal">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900">Confirm Reset & Refresh All</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to completely reset everything? This will clear all feasibility results, reset parameters, and remove any custom vendors added. If you have not saved, you will lose your data.
            </p>

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

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <label className="text-[10px] text-slate-500 font-bold uppercase block">Would you like to save your current option first?</label>
              <input
                type="text"
                placeholder="e.g. Saved Backup Option"
                value={resetBackupName}
                onChange={(e) => setResetBackupName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
              />
              <p className="text-[10px] text-slate-400">If you want to save, type a name above. Otherwise leave it blank.</p>
            </div>

            <div className="flex justify-end gap-2 text-xs pt-1">
              <button
                onClick={() => {
                  setShowResetDialog(false);
                  setResetBackupName('');
                  setResetAlsoDatabase(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleGlobalReset(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 transition font-bold cursor-pointer"
              >
                Reset Without Saving
              </button>
              <button
                onClick={() => {
                  handleGlobalReset(true);
                }}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition font-bold shadow-sm cursor-pointer"
              >
                Save & Reset
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
                  await executeCheck(true, pitches);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-bold cursor-pointer"
              >
                Yes, Optimize & Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Elegant Minimal Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-400 text-center" id="applet-bottom-footer">
        <p>© 2026 Pitch Feasibility & Cost Optimizer. Self-hosted on Flask &amp; SQLite.</p>
      </footer>
    </div>
  );
}
