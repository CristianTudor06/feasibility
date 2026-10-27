import React, { useState, useRef, useMemo } from 'react';
import { FeasibilityRow, StrategyType, VendorTier } from '../types';
import { parseCSVToPitches } from '../lib/csvParser';
import { ALL_COUNTRIES, isValidCountry, getCanonicalCountryName } from '../data/countries';
import { calculateAllRows, deduplicateDbRows } from '../lib/calculator';
import { evaluateDbMatch } from '../lib/matching';
import ComboboxCell from './ComboboxCell';
import { 
  GLOBAL_ALL_LOIS, 
  GLOBAL_ALL_IRS, 
  GLOBAL_ALL_UNIVERSES, 
  GLOBAL_ALL_QUOTAS, 
  ALL_DB_COUNTRIES,
  getDbCountries,
  getCountryPreExistingSpecs,
  getCountrySpecsByUniverse,
  ATTACHED_REFERENCE_SPECS
} from '../data/attachedSpecsData';
import { VENDOR_DATABASE_POOL } from '../data/defaultData';
import { 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  RotateCcw,
  Trash2, 
  Plus, 
  FileUp, 
  HelpCircle, 
  CheckCircle,
  Copy,
  Settings,
  Info,
  Sliders,
  DollarSign,
  Maximize2,
  AlertCircle,
  XCircle,
  CheckCircle2,
  FileDown,
  Share2,
  ArrowRight,
  TrendingDown,
  Layers,
  Lock,
  Unlock,
  ChevronDown,
  Database,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

interface DatabaseGridProps {
  pitches: FeasibilityRow[];
  activeStrategy: StrategyType;
  onUpdatePitches: (newPitches: FeasibilityRow[], preserveHasChecked?: boolean) => void;
  onResetToDefault: () => void;
  user?: any;
  savedOptions?: any;
  setSavedOptions?: any;
  hasChecked?: boolean;
  setHasChecked?: (checked: boolean) => void;
  isChecking?: boolean;
  setIsChecking?: (checking: boolean) => void;
  isReloading?: boolean;
  setIsReloading?: (reloading: boolean) => void;
  lastSpreadsheetId?: string;
  setLastSpreadsheetId?: (id: string) => void;
  onStartChecking?: () => void;
  onStartCheckingForOptions?: () => void;
  onStartCheckingOptimized?: () => void;
  allocations?: any[];
  vendors?: VendorTier[];
  onUpdateVendors?: (newVendors: VendorTier[]) => void;
  onNewSpecsFileAttached?: () => void;
  insertedDatabase?: any;
  targetedBudget?: number;
  feasibilityFontSizeDelta?: number;
}

function InstantTooltip({
  text,
  children,
  position = 'bottom'
}: {
  text?: string;
  children?: React.ReactNode;
  position?: 'top' | 'bottom';
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (!text) return <>{children}</>;
  return (
    <span 
      className="relative inline-flex items-center cursor-help"
      title={text}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {children}
      {isOpen && (
        <span
          className={`pointer-events-none absolute z-[99999] flex flex-col ${
            position === 'top'
              ? 'bottom-full left-0 mb-1.5'
              : 'top-full left-0 mt-1.5'
          }`}
          style={{ minWidth: '180px', maxWidth: '320px' }}
        >
          <span className="bg-slate-900 text-white text-[11px] font-sans font-medium px-2.5 py-1.5 rounded-md shadow-2xl border border-slate-700 whitespace-normal text-left leading-snug">
            {text}
          </span>
          {position === 'top' ? (
            <span className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 ml-4 border-r border-b border-slate-700"></span>
          ) : (
            <span className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mb-1 ml-4 order-first border-l border-t border-slate-700"></span>
          )}
        </span>
      )}
    </span>
  );
}

export default function DatabaseGrid({
  pitches,
  activeStrategy,
  onUpdatePitches,
  onResetToDefault,
  user,
  savedOptions,
  setSavedOptions,
  hasChecked = true,
  setHasChecked,
  isChecking = false,
  setIsChecking,
  isReloading = false,
  setIsReloading,
  lastSpreadsheetId,
  setLastSpreadsheetId,
  onStartChecking,
  onStartCheckingForOptions,
  onStartCheckingOptimized,
  allocations: passedAllocations,
  vendors,
  onUpdateVendors,
  onNewSpecsFileAttached,
  insertedDatabase,
  targetedBudget,
  feasibilityFontSizeDelta = 0
}: DatabaseGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('All');
  const [dragActive, setDragActive] = useState(false);
  const [isCheckDropdownOpen, setIsCheckDropdownOpen] = useState(false);
  
  // High fidelity editing cells
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof FeasibilityRow } | null>(null);
  const [tempEditValue, setTempEditValue] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const setToastNotification = (_val: any) => {};

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeDbCountries = useMemo(() => getDbCountries(insertedDatabase), [insertedDatabase]);

  const markets = useMemo(() => ['All', ...Array.from(new Set(pitches.map((p) => p.market)))], [pitches]);

  const allocations = useMemo(() => passedAllocations || calculateAllRows(pitches, activeStrategy, vendors), [passedAllocations, pitches, activeStrategy, vendors]);

  // Search/Filter for Scenarios
  const filteredPitches = useMemo(() => {
    return pitches.filter((pitch) => {
      const matchesSearch =
        pitch.pitchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pitch.market.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pitch.target.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesMarket = selectedMarket === 'All' || pitch.market === selectedMarket;

      return matchesSearch && matchesMarket;
    });
  }, [pitches, searchQuery, selectedMarket]);

  const updatePitchesAndDecheck = (newPitches: FeasibilityRow[]) => {
    onUpdatePitches(newPitches);
    if (setHasChecked) {
      setHasChecked(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (text) {
          const parsed = parseCSVToPitches(text);
          if (parsed.length > 0) {
            updatePitchesAndDecheck(parsed);
            if (onNewSpecsFileAttached) {
              onNewSpecsFileAttached();
            }
          }
        }
      } catch (err: any) {
        setToastNotification({
          message: `Error parsing CSV file: ${err.message || err}`,
          type: 'error'
        });
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  // Add blank option row
  const handleAddRow = () => {
    const newRow: FeasibilityRow = {
      id: `row-new-${Date.now()}`,
      pitchName: 'Pitch ' + (Math.floor(Math.random() * 10) + 4),
      source: 'User Creation',
      option: String(pitches.filter(p => p.pitchName === 'Pitch 1').length + 1),
      market: 'Germany',
      target: 'gen pop 18-65yo',
      loi: 10,
      irPercent: 0.2,
      irUniverse: 'gen pop 18-65yo',
      quotas: 'AGR',
      waves: 1,
      totalFreshSample: 1000,
      totalSampleSize: 1000,
      internal: 3000,
      maxInternalPercent: 100,
      vendor1: 1500,
      vendor1Cpi: 4,
      vendor2: 500,
      vendor2Cpi: 6,
      vendor3: 0,
      vendor3Cpi: 0,
      vendor4: 0,
      vendor4Cpi: 0,
      vendor1Pct: 100,
      vendor2Pct: 100,
      vendor3Pct: 100,
      vendor4Pct: 100,
      pmFee: 150,
      salesCpi: 7.50,
      comparability: 'High'
    };
    updatePitchesAndDecheck([...pitches, newRow]);
    setToastNotification({
      message: `Added new blank scenario.`,
      type: "success"
    });
  };

  // Duplicate scenario option ("Button to save and copy the option")
  const handleDuplicateRow = (rowId: string) => {
    const origin = pitches.find(p => p.id === rowId);
    if (!origin) return;

    const duplicatedCell: FeasibilityRow = {
      ...origin,
      id: `row-copied-grid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      option: `${origin.option} (Copy)`,
    };

    updatePitchesAndDecheck([...pitches, duplicatedCell]);
    setToastNotification({
      message: `Duplicated scenario "${origin.option}" to bottom.`,
      type: "success"
    });
  };

  const handleToggleLockRow = (rowId: string) => {
    updatePitchesAndDecheck(pitches.map(p => {
      if (p.id === rowId) {
        const nextLocked = !p.isLocked;
        let lockedAlloc = undefined;
        if (nextLocked) {
          lockedAlloc = allocations?.find(a => a.rowId === rowId);
        }
        return {
          ...p,
          isLocked: nextLocked,
          lockedAllocation: lockedAlloc
        };
      }
      return p;
    }));
  };

  const handleDeleteRow = (id: string) => {
    const target = pitches.find(p => p.id === id);
    if (!target) return;
    if (target.isLocked) {
      setToastNotification({
        message: "This line is locked and cannot be deleted!",
        type: "error"
      });
      return;
    }
    updatePitchesAndDecheck(pitches.filter((p) => p.id !== id));
    setToastNotification({
      message: `Deleted scenario "${target.option}".`,
      type: "info"
    });
  };

  // Inline grid cell double-click editing saves instantly
  const startEditing = (rowId: string, field: keyof FeasibilityRow, currentVal: any) => {
    const r = pitches.find(p => p.id === rowId);
    if (r && r.isLocked) {
      return; // Disable editing on locked rows
    }
    setEditingCell({ rowId, field });
    setTempEditValue(String(currentVal));
  };

  const saveInlineEdit = () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;

    const updated = pitches.map((pitch) => {
      if (pitch.id === rowId) {
        let value: any = tempEditValue;

        // Number parsing or validations
        if (field === 'irPercent') {
          let num = parseFloat(tempEditValue.replace('%', ''));
          if (isNaN(num)) num = 20;
          value = num > 1 ? num / 100 : num;
        } else if (
          String(field).endsWith('PctOverride')
        ) {
          const rawStr = tempEditValue.trim().toLowerCase();
          if (rawStr === '' || rawStr === 'auto' || rawStr === 'reset') {
            const nextPitch = { ...pitch };
            delete (nextPitch as any)[field];
            return nextPitch;
          } else {
            let num = parseFloat(rawStr.replace(/[^0-9.-]/g, ''));
            if (isNaN(num)) {
              const nextPitch = { ...pitch };
              delete (nextPitch as any)[field];
              return nextPitch;
            } else {
              value = Math.max(0, Math.min(100, num));
            }
          }
        } else if (
          [
            'loi', 'waves', 'totalFreshSample', 'totalSampleSize', 
            'internal', 'maxInternalPercent', 
            'pmFee', 'salesCpi', 'targetedCpi'
          ].includes(String(field)) ||
          String(field).startsWith('vendor')
        ) {
          value = parseFloat(tempEditValue.replace(/[^0-9.-]/g, '')) || 0;
          if (String(field).endsWith('Pct') || field === 'maxInternalPercent') {
            value = Math.max(0, Math.min(100, value));
          }
        }

        return { ...pitch, [field]: value };
      }
      return pitch;
    });

    updatePitchesAndDecheck(updated);
    setEditingCell(null);
  };

  const handleCellSave = (rowId: string, field: keyof FeasibilityRow, rawVal: string) => {
    const updated = pitches.map((pitch) => {
      if (pitch.id === rowId) {
        let value: any = rawVal;
        const lower = String(rawVal || '').trim().toLowerCase();

        if (field === 'market') {
          if (lower.startsWith('insert') || lower === '') {
            value = '';
          } else {
            value = getCanonicalCountryName(rawVal) || rawVal.trim();
          }
        } else if (field === 'irPercent') {
          if (lower.startsWith('insert') || lower === '' || lower === 'none' || lower === '0' || lower === '0%') {
            value = 0;
          } else {
            let num = parseFloat(rawVal.replace('%', '').trim());
            if (isNaN(num)) num = 0;
            value = num > 1 ? num / 100 : num;
          }
        } else if (field === 'loi') {
          if (lower.startsWith('insert') || lower === '' || lower === 'none' || lower === '0') {
            value = 0;
          } else {
            value = parseFloat(rawVal.replace(/[^0-9.-]/g, '')) || 0;
          }
        } else if (field === 'irUniverse') {
          if (lower.startsWith('insert') || lower === '' || lower === 'none') {
            value = '';
          } else {
            value = rawVal.trim();
          }
        } else if (field === 'quotas') {
          if (lower.startsWith('insert') || lower === '') {
            value = 'No quotas';
          } else {
            value = rawVal.trim();
          }
        }
        return { ...pitch, [field]: value };
      }
      return pitch;
    });
    updatePitchesAndDecheck(updated);
  };

  const handleAddNewVendor = () => {
    if (!vendors || !onUpdateVendors) {
      setToastNotification({ message: "Vendor updating is unavailable in this view.", type: "error" });
      return;
    }

    const activeNames = vendors.map(v => v.name.toLowerCase().trim());
    const candidates = VENDOR_DATABASE_POOL.filter(candidate => {
      const isDoNotUse = String(candidate.tier || '').toLowerCase().includes('do not use');
      const isRed = String(candidate.color || '').toLowerCase() === 'red';
      if (isDoNotUse || isRed) return false;
      return !activeNames.includes(candidate.name.toLowerCase().trim());
    });

    if (candidates.length === 0) {
      setToastNotification({ message: "No vendors available", type: "error" });
      return;
    }

    const getTierPriority = (tier: string) => {
      const t = String(tier || '').toLowerCase();
      if (t.includes('do not use')) return 999;
      if (t.includes('0') || t.includes('prime')) return 0;
      if (t.includes('1')) return 1;
      if (t.includes('2')) return 2;
      if (t.includes('3')) return 3;
      if (t.includes('no tier')) return 4;
      return 4;
    };

    const getColorPriority = (color: string) => {
      const c = String(color || '').toLowerCase();
      if (c === 'red') return 999;
      if (c === 'green') return 1;
      if (c === 'yellow') return 2;
      if (c === 'orange') return 3;
      if (c === 'grey' || c === 'gray') return 4;
      return 4;
    };

    const matchedCandidates = candidates.map(candidate => {
      const nameLower = candidate.name.toLowerCase();
      const matchNum = nameLower.match(/\d+/);
      const vendorNum = matchNum ? parseInt(matchNum[0], 10) : 0;
      const dbCapKey = `vendor${vendorNum}`;

      let matchesCount = 0;
      let totalCapacity = 0;

      pitches.forEach(pitch => {
        let lineCap = 0;

        // 1. Check inserted database if loaded
        if (insertedDatabase && insertedDatabase.length > 0 && vendorNum > 0) {
          const matches = insertedDatabase.filter((dbRow: any) => evaluateDbMatch(pitch, dbRow).isMatch);

          const deduplicatedMatches = deduplicateDbRows(matches);
          const maxCap = deduplicatedMatches.reduce((max: number, r: any) => Math.max(max, parseInt(r[dbCapKey], 10) || 0), 0);
          if (maxCap > 0) {
            lineCap = maxCap;
          }
        }

        // 2. Check directly on pitch object
        if (lineCap === 0 && vendorNum > 0 && (pitch as any)[dbCapKey] !== undefined) {
          const directCap = Number((pitch as any)[dbCapKey]) || 0;
          if (directCap > 0) {
            lineCap = directCap;
          }
        }

        // 3. Check VENDOR_DATABASE_POOL country coverage
        if (lineCap === 0 && candidate.countries && candidate.countries.length > 0) {
          const pitchMarket = String(pitch.market || '').toLowerCase().trim();
          const matchesCountry = candidate.countries.some(c => {
            const cLower = c.toLowerCase().trim();
            return cLower === pitchMarket || pitchMarket.includes(cLower) || cLower.includes(pitchMarket);
          });
          if (matchesCountry) {
            lineCap = Math.max(1000, pitch.totalSampleSize || 1000);
          }
        }

        if (lineCap > 0) {
          matchesCount++;
          totalCapacity += lineCap;
        }
      });

      return {
        candidate,
        matchesCount,
        totalCapacity,
        tierVal: getTierPriority(candidate.tier),
        colorVal: getColorPriority(candidate.color)
      };
    });

    // Only candidates with matchesCount > 0 and totalCapacity > 0 are eligible
    const eligibleCandidates = matchedCandidates.filter(c => c.matchesCount > 0 && c.totalCapacity > 0);

    if (eligibleCandidates.length === 0) {
      setToastNotification({ message: "No vendors available", type: "error" });
      return;
    }

    eligibleCandidates.sort((a, b) => {
      if (b.matchesCount !== a.matchesCount) {
        return b.matchesCount - a.matchesCount;
      }
      if (a.tierVal !== b.tierVal) {
        return a.tierVal - b.tierVal;
      }
      if (a.colorVal !== b.colorVal) {
        return a.colorVal - b.colorVal;
      }
      return b.totalCapacity - a.totalCapacity;
    });

    const best = eligibleCandidates[0].candidate;
    const nextIdx = vendors.length + 1;

    const updatedVendors = [...vendors, { name: best.name, tier: best.tier, color: best.color, isAddedManually: true } as VendorTier];
    onUpdateVendors(updatedVendors);

    const capKey = `vendor${nextIdx}`;
    const cpiKey = `vendor${nextIdx}Cpi`;
    const pctKey = `vendor${nextIdx}Pct`;
    const overrideKey = `vendor${nextIdx}PctOverride`;

    const nextPitches = pitches.map(pitch => {
      const nameLower = best.name.toLowerCase();
      const matchNum = nameLower.match(/\d+/);
      const vendorNumInDb = matchNum ? parseInt(matchNum[0], 10) : 0;
      const dbCapKey = `vendor${vendorNumInDb}`;
      const dbCpiKey = `vendor${vendorNumInDb}Cpi`;

      let realCapacity = 0;
      let realCpi = 0;

      const dbSearchSource = insertedDatabase || [];
      const matches = dbSearchSource.filter((dbRow: any) => evaluateDbMatch(pitch, dbRow).isMatch);

      if (matches.length > 0 && vendorNumInDb > 0) {
        const deduplicatedMatches = deduplicateDbRows(matches);
        realCapacity = deduplicatedMatches.reduce((max: number, r: any) => Math.max(max, parseInt(r[dbCapKey], 10) || 0), 0);
        for (const mr of deduplicatedMatches) {
          const val = parseFloat(mr[dbCpiKey]);
          if (val > 0) {
            if (realCpi === 0 || val < realCpi) {
              realCpi = val;
            }
          }
        }
      }

      if (realCapacity === 0 && vendorNumInDb > 0) {
        if ((pitch as any)[dbCapKey] !== undefined) {
          realCapacity = Number((pitch as any)[dbCapKey]) || 0;
        }
        if ((pitch as any)[dbCpiKey] !== undefined) {
          realCpi = Number((pitch as any)[dbCpiKey]) || 0;
        }
      }

      if (realCapacity === 0 && best.countries && best.countries.length > 0) {
        const pitchMarket = String(pitch.market || '').toLowerCase().trim();
        const matchesCountry = best.countries.some(c => {
          const cLower = c.toLowerCase().trim();
          return cLower === pitchMarket || pitchMarket.includes(cLower) || cLower.includes(pitchMarket);
        });
        if (matchesCountry) {
          realCapacity = Math.max(1000, pitch.totalSampleSize || 1000);
          realCpi = 5;
        }
      }

      const updatedPitch = {
        ...pitch,
        [capKey]: realCapacity,
        [cpiKey]: realCpi,
        [pctKey]: 100
      };
      delete (updatedPitch as any)[overrideKey];
      return updatedPitch;
    });

    onUpdatePitches(nextPitches, true);
    setToastNotification({
      message: `Successfully added vendor ${best.name} (${best.tier.toUpperCase()}, ${best.color.toUpperCase()}) with matching market capabilities!`,
      type: "success"
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in relative" id="fe-specs-grid-container">
      {/* Header Widget */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="search-input"
              type="text"
              placeholder="Search pitches, targets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-64 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] focus:border-[#2b6cb0]"
            />
          </div>

          <select
            id="market-filter"
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2b6cb0]"
          >
            {markets.map((m) => (
              <option key={m} value={m}>{m === 'All' ? 'All Countries' : m}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="add-new-vendor-btn"
            onClick={handleAddNewVendor}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#2b6cb0] bg-blue-50 border border-blue-200 rounded-lg hover:text-[#205080] hover:bg-blue-100 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add new vendor
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            id="insert-specs-btn"
          >
            <FileUp className="h-4 w-4 text-[#2b6cb0]" />
            Insert Specs (Excel/CSV)
          </button>

          <button
            type="button"
            id="add-blank-row"
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            <Plus className="h-4 w-4 text-emerald-600" />
            Add Scenario
          </button>

          <button
            type="button"
            id="reset-quote-db-btn"
            onClick={onResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition shadow-xs cursor-pointer"
            title="Reset Quote: clear all audiences, set budget to 0, and clear all lines"
          >
            <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
            Reset Quote
          </button>

          <button
            type="button"
            id="help-toggle-btn"
            onClick={() => setHelpOpen(!helpOpen)}
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            title="Formatting help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {helpOpen && (
        <div className="bg-blue-50/50 border-b border-blue-100 p-4 text-xs text-blue-900 leading-relaxed grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="font-bold text-[#205080] block mb-1">Overview grid rules for specs mapping:</span>
            - Specs are condensed in a single card for readability.<br/>
            - **Internally columns**: show Potential cap and actual Feasible Contribution capped by Max Internal %.<br/>
            - **Externally columns**: show Potential cap, Feasible cap (with sliders applied), and vendor bills.
          </div>
          <div>
            <span className="font-bold text-[#205080] block mb-1">Manually Adjustment & blending:</span>
            Change the percentage slider inputs (e.g. `V1 %: 60` or double click to set values from 0% to 100%) for each vendor to adjust vendor cap instantly and modify the weighted price. Duplicate rows to perform testing side-by-side.
          </div>
          <div>
            <span className="font-bold text-[#205080] block mb-1">Vetted Vendor & Tier Rules:</span>
            - The system checks feasibility and capabilities across any of the **43 vetted vendors** in the database pool.<br/>
            - Sorting/Allocation follows strict tier priority: **Tier 1 &gt; Tier 2 &gt; Tier 3 &gt; No Tier (as priority level 3)**.<br/>
            - Tie-breaking within tiers follows quality flags: **Green (High) &gt; Yellow (Medium) &gt; Orange (Low)**, then lowest CPI first.
          </div>
        </div>
      )}

      {/* Main Grid View */}
      <div 
        id="file-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative group ${dragActive ? 'bg-slate-100 border-2 border-dashed border-slate-400 p-8' : 'p-0'}`}
      >
        {dragActive ? (
          <div className="text-center py-12">
            <FileUp className="h-10 w-10 mx-auto text-[#2b6cb0] mb-2 animate-bounce" />
            <p className="text-sm font-semibold text-slate-800">Drop your CSV template file here...</p>
            <p className="text-xs text-slate-500 mt-1">Accepts country-pitch specs in 21-column layout.</p>
          </div>
        ) : (
          <div className="overflow-x-auto relative pb-44 min-h-[360px]">
            {filteredPitches.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50/20">
                <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-800">No pitch records match filters</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Insert specs from Excel, add a blank scenario, or drag & drop a compatible CSV file.
                </p>
              </div>
            ) : (
              <table
                className="w-full text-left border-collapse dynamic-feasibility-grid"
                style={{ '--grid-font-size': `${12 + (feasibilityFontSizeDelta || 0) * 1.5}px` } as React.CSSProperties}
              >
                <thead>
                  {/* Category Headers Row */}
                  <tr className="bg-[#2b6cb0]/10 border-b border-[#2b6cb0]/20 text-[10px] font-bold tracking-wider text-[#205080]">
                    <th colSpan={6} className="p-2 border-r border-[#2b6cb0]/20 text-center uppercase">General Requirements</th>
                    
                    {/* Visual Separator Column 1 */}
                    <th className="p-0 w-1.5 bg-slate-300"></th>

                    <th colSpan={4} className="p-2 border-r border-[#2b6cb0]/20 text-center bg-[#ebf8ff] uppercase text-indigo-950 font-extrabold">Internal Capabilities</th>
                    
                    {/* Visual Separator Column 2 */}
                    <th className="p-0 w-1.5 bg-slate-300"></th>

                    <th colSpan={vendors ? vendors.length * 3 : 12} className="p-2 border-r border-[#2b6cb0]/20 text-center bg-emerald-50 text-emerald-950 uppercase">Externally Capabilities (Vendors)</th>
                    <th colSpan={12} className="p-2 border-r border-slate-200 text-center bg-indigo-50 text-indigo-950 uppercase">Spent &amp; Feasibility Calculations Output</th>
                    <th colSpan={3} className="p-2 text-center uppercase bg-slate-100/50">Actions</th>
                  </tr>
                  
                  {/* Main Header Labels */}
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold uppercase tracking-wider text-[9px]">
                    {/* General */}
                    <th className="p-2 col-static">Country</th>
                    <th className="p-2 col-static text-right font-bold text-slate-900 pr-3">Target Size</th>
                    <th className="p-2 col-static text-center">LOI</th>
                    <th className="p-2 col-static text-center">IR%</th>
                    <th className="p-2 col-static text-center">IR Universe</th>
                    <th className="p-2 col-static text-center">Quotas</th>
                    
                    {/* NEW SEPARATOR Label */}
                    <th className="p-0 w-1.5 bg-slate-300"></th>

                    {/* Internally (4 columns with beautiful highlighted coloring) */}
                    <th className="p-2 w-20 text-center bg-amber-50 font-bold text-amber-800 border-r border-amber-200/50" title="Overlap rate">Overlap</th>
                    <th className="p-2 text-center bg-blue-50 font-bold text-blue-700 border-r border-blue-200/50" title="Max Feasible Internal panel capability inclusive of Overlap percentage (can exceed 100%)">Max Potential Feasible</th>
                    <th className="p-2 text-center bg-[#ebf8ff] font-bold text-indigo-900">Internal Max %</th>
                    <th className="p-2 text-center bg-[#ebf8ff] font-bold text-emerald-900 border-r border-[#2b6cb0]/20" title="Manual override pct of sample allocated to Internal panel. Double click to edit, enter empty/auto/reset to clear override.">Internal Used %</th>
                    
                    {/* NEW SEPARATOR Label */}
                    <th className="p-0 w-1.5 bg-slate-300"></th>

                    {/* Externally (dynamically generated index based on list of vendors) */}
                    {(vendors || []).map((vendor, idx) => {
                      const vIdx = idx + 1;
                      const isBgOdd = vIdx % 2 === 1;
                      const bgClass = isBgOdd ? 'bg-emerald-50/70' : 'bg-emerald-50/20';
                      const textClass = isBgOdd ? 'text-emerald-950' : 'text-emerald-850';
                      const borderClass = vIdx === vendors?.length ? 'border-r border-slate-200' : '';
                      return (
                        <React.Fragment key={vIdx}>
                          <th className={`p-1.5 text-center ${bgClass} font-semibold ${textClass}`}>{vendor.name} Max</th>
                          <th className={`p-1.5 text-center ${bgClass} font-semibold text-slate-850`}>{vendor.name} Used</th>
                          <th className={`p-1.5 text-center ${bgClass} font-semibold text-slate-700 ${borderClass}`}>{vendor.name} CPI</th>
                        </React.Fragment>
                      );
                    })}
                    
                    <th className="p-2">Feasibility Status</th>
                    <th className="p-2 text-right text-[#2b6cb0]">feasible</th>
                    <th className="p-2 text-right text-rose-700">missing</th>
                    <th className="p-2 text-right text-rose-600 font-bold" title="Missing sample as a percentage of target size">missing %</th>
                    <th className="p-2 text-right text-[#205080]" title="Specs Potential max feasible">max feasible</th>
                    <th className="p-2 text-center text-slate-800">Internal/Ext Share</th>
                    <th className="p-2 text-center text-slate-705 font-bold" title="Number of external vendors utilized">Nr of vendors</th>
                    <th className="p-2 text-right text-emerald-850 font-bold">Weighted CPI</th>
                    <th className="p-2 text-right text-indigo-950 font-bold">Targeted CPI</th>
                    <th className="p-2 text-right text-slate-800">PM Fee</th>
                    <th className="p-2 text-center">Comparability</th>
                    <th className="p-2 text-right text-slate-900 font-bold">Total external costs (no markup)</th>
                    <th className="p-2 text-right text-emerald-800 font-bold border-r border-slate-200">OP %</th>

                    {/* Actions */}
                    <th className="p-2 text-center bg-slate-100/30">Lock</th>
                    <th className="p-2 text-center bg-slate-100/30">Duplicate</th>
                    <th className="p-2 text-center bg-slate-100/30">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredPitches.map((pitch) => {
                    const alloc = allocations.find((a) => a.rowId === pitch.id) || {
                      status: 'Unfeasible',
                      allocatedInternal: 0,
                      totalAllocated: 0,
                      unfilledSample: pitch.totalSampleSize,
                      maxPotential: 0,
                      overlapPenaltyPct: 0,
                      internalSharePct: 0,
                      externalSharePct: 0,
                      activeVendorsCsv: 'None',
                      weightedCpi: 0,
                      numVendorsUsed: 0,
                      pmFee: 150,
                      comparability: 'High',
                      totalCost: 0,
                      operationalProfit: 0,
                      externalCost: 0,
                      internalCostRef: 0
                    } as any;

                    // Get penalty multiplier based on dynamic overlap
                    const selectedOverlapPct = pitch.overlapVariable !== undefined ? pitch.overlapVariable : (alloc.overlapPenaltyPct || 0);
                    const penaltyMultiplier = 1 - selectedOverlapPct / 100;

                    // Precalculate Max Feasible Internal contribution
                    const maxInternalPct = pitch.maxInternalPercent !== undefined ? pitch.maxInternalPercent : 100;
                    const internalFeasibilityLimit = Math.round(pitch.totalSampleSize * (maxInternalPct / 100));
                    // OVERLAP APPLIED ON MAX FEASIBLE INTERNAL Contribution (reduced)
                    const maxFeasibleInternal = Math.round(Math.min(pitch.internal, internalFeasibilityLimit) * penaltyMultiplier);

                    // Dynamic ratio of raw internal capacity (from database) as % of target sample size
                    const internalMaxPct = pitch.totalSampleSize > 0 ? Math.round((pitch.internal / pitch.totalSampleSize) * 100) : 0;
                    
                    // Max potential penalized internal feasibility as % of target sample size (can exceed 100%)
                    const maxFeasibleInternalPct = pitch.totalSampleSize > 0 ? Math.round((pitch.internal * penaltyMultiplier / pitch.totalSampleSize) * 100) : 0;

                    // Max Potential Feasible (considering all available vendors + internal + overlap)
                    let potentialPanels = 0;
                    if (Number(pitch.internal || 0) > 0) potentialPanels++;
                    const numVendorsForMax = vendors ? vendors.length : 4;
                    for (let idx = 0; idx < numVendorsForMax; idx++) {
                      if ((Number((pitch as any)[`vendor${idx + 1}`]) || 0) > 0) {
                        potentialPanels++;
                      }
                    }

                    let potentialPenaltyPct = 0;
                    if (pitch.overlapVariable !== undefined) {
                      potentialPenaltyPct = pitch.overlapVariable;
                    } else {
                      if (potentialPanels <= 1) potentialPenaltyPct = 0;
                      else if (potentialPanels === 2) potentialPenaltyPct = 20;
                      else if (potentialPanels === 3) potentialPenaltyPct = 25;
                      else if (potentialPanels === 4) potentialPenaltyPct = 30;
                      else if (potentialPanels === 5) potentialPenaltyPct = 35;
                      else if (potentialPanels === 6) potentialPenaltyPct = 40;
                      else potentialPenaltyPct = 50;
                    }

                    const potentialPenaltyMultiplier = 1 - potentialPenaltyPct / 100;
                    const maxPotentialExternal = Array.from({ length: numVendorsForMax }).reduce((acc: number, _, idx) => acc + (Number((pitch as any)[`vendor${idx + 1}`]) || 0), 0) as number;
                    const displayMaxPotential = Math.round((Number(pitch.internal || 0) + maxPotentialExternal) * potentialPenaltyMultiplier);
                    const maxPotentialFeasiblePct = pitch.totalSampleSize > 0 ? Math.round((displayMaxPotential / pitch.totalSampleSize) * 100) : 0;

                    // Compute vendor metrics dynamically
                    const numVendors = vendors ? vendors.length : 4;
                    const vendorMetrics = Array.from({ length: numVendors }).map((_, idx) => {
                      const vIdx = idx + 1;
                      const capKey = `vendor${vIdx}` as keyof FeasibilityRow & string;
                      const pctKey = `vendor${vIdx}Pct` as keyof FeasibilityRow & string;
                      const overrideKey = `vendor${vIdx}PctOverride` as keyof FeasibilityRow & string;
                      const cpiKey = `vendor${vIdx}Cpi` as keyof FeasibilityRow & string;

                      const rawCap = (pitch[capKey] as number) || 0;
                      const sliderPct = pitch[pctKey] !== undefined ? (pitch[pctKey] as number) : 100;
                      // APPLY OVERLAP APPLIED ON MAX FEASIBLE EXTERNAL Vendor capacities (reduced)
                      const feasible = Math.round(rawCap * (sliderPct / 100) * penaltyMultiplier);

                      const allocatedVal = alloc[`allocatedVendor${vIdx}`] || 0;
                      const usedPct = pitch[overrideKey] !== undefined 
                        ? (pitch[overrideKey] as number) 
                        : (pitch.totalSampleSize > 0 ? (allocatedVal / pitch.totalSampleSize * 100) : 0);

                      const maxFeasiblePct = pitch.totalSampleSize > 0 ? (feasible / pitch.totalSampleSize * 100) : 0;
                      const isExceeded = usedPct > maxFeasiblePct + 0.01;
                      const cpi = (pitch[cpiKey] as number) || 0;

                      return {
                        vIdx,
                        feasible,
                        usedPct,
                        maxFeasiblePct,
                        isExceeded,
                        cpi,
                        rawCap,
                        sliderPct,
                        overrideKey,
                        pctKey,
                        cpiKey
                      };
                    });

                    const isEditingInternal = editingCell?.rowId === pitch.id && editingCell?.field === 'internal';
                    const isEditingInternalPct = editingCell?.rowId === pitch.id && editingCell?.field === 'maxInternalPercent';
                    const isEditingName = editingCell?.rowId === pitch.id && editingCell?.field === 'pitchName';
                    const isEditingMarket = editingCell?.rowId === pitch.id && editingCell?.field === 'market';
                    const isEditingTarget = editingCell?.rowId === pitch.id && editingCell?.field === 'totalSampleSize';

                    const getPctStr = (val: number, target: number) => {
                      if (!target) return '0%';
                      return `${Math.round((val / target) * 100)}%`;
                    };

                    const formatFeasibilityPct = (value: number, target: number) => {
                      if (!target) return '0%';
                      const pct = (value / target) * 100;
                      if (pct === 0) return '0%';
                      if (pct % 1 === 0) return `${pct.toFixed(0)}%`;
                      return `${pct.toFixed(1)}%`;
                    };

                    const isEditingPmFee = editingCell?.rowId === pitch.id && editingCell?.field === 'pmFee';
                    const isEditingComp = editingCell?.rowId === pitch.id && editingCell?.field === 'comparability';

                    const rowSalesCpi = pitch.salesCpi !== undefined ? pitch.salesCpi : 7.50;
                    const rowRevenue = alloc.totalAllocated * rowSalesCpi;
                    const rowOpCosts = (alloc.externalCost || 0) + (alloc.internalCostRef || 0);
                    const rowOpPct = rowRevenue > 0 ? ((rowRevenue - rowOpCosts) / rowRevenue) * 100 : 0;

                    const pitchSpecs = getCountrySpecsByUniverse(pitch.market, pitch.irUniverse, insertedDatabase);

                    const getUnfeasibleReason = (p: FeasibilityRow, specs: any): string => {
                      if (!p.market || !isValidCountry(p.market) || String(p.market).startsWith('Insert')) {
                        return 'Missing or invalid country';
                      }
                      if (!p.irPercent || p.irPercent <= 0 || String(p.irPercent).toLowerCase().startsWith('insert')) {
                        return 'Missing: Incidence (IR%)';
                      }
                      if (!p.loi || p.loi <= 0 || String(p.loi).toLowerCase().startsWith('insert')) {
                        return 'Missing: Duration (LOI)';
                      }
                      if (!p.irUniverse || String(p.irUniverse).trim() === '' || String(p.irUniverse).toLowerCase().startsWith('insert')) {
                        return 'Missing: Universe (IR universe)';
                      }
                      if (specs.preExistingUniverses && specs.preExistingUniverses.length > 0) {
                        const cleanUniverse = p.irUniverse.toLowerCase().trim();
                        const exists = specs.preExistingUniverses.some((u: string) => u.toLowerCase().trim() === cleanUniverse);
                        if (!exists) {
                          return 'Universe not found in database for this country';
                        }
                      }
                      const totalCap = (p.internal || 0) + (p.vendor1 || 0) + (p.vendor2 || 0) + (p.vendor3 || 0) + (p.vendor4 || 0);
                      if (totalCap === 0) {
                        return 'Capacity is 0 in database for specified parameters';
                      }
                      if (p.totalSampleSize <= 0) {
                        return 'Missing: Target Sample Size';
                      }
                      return 'Incomplete feasibility / No vendor covers demand';
                    };

                    const unfeasibleReason = getUnfeasibleReason(pitch, pitchSpecs);

                    return (
                      <tr 
                        key={pitch.id} 
                        className="hover:bg-slate-50/50 transition-colors group text-[11px]"
                      >
                        {/* 2. Country / Market with Autocomplete combobox */}
                        <td className="p-2 col-static text-slate-800 font-bold">
                          <ComboboxCell
                            value={pitch.market}
                            onSave={(val) => handleCellSave(pitch.id, 'market', val)}
                            options={ALL_COUNTRIES}
                            preExistingOptions={activeDbCountries}
                            specType="country"
                            placeholder="Insert country"
                            displayValue={
                              <div className="flex items-center gap-1.5">
                                <span className={isValidCountry(pitch.market) ? 'text-slate-900 font-bold' : 'text-slate-400 italic font-normal'}>
                                  {getCanonicalCountryName(pitch.market) || pitch.market || 'Insert country'}
                                </span>
                                {!isValidCountry(pitch.market) && pitch.market && (
                                  <span className="text-[9px] font-bold text-rose-600 bg-rose-100 px-1 py-0.2 rounded border border-rose-200 uppercase tracking-tight shrink-0" title="Unrecognized country: 0 output">
                                    0 output
                                  </span>
                                )}
                              </div>
                            }
                            align="left"
                            widthClass="w-36"
                          />
                        </td>

                        {/* 3. Target Size */}
                        <td className="p-2 text-right pr-3 font-mono font-bold text-slate-900 col-static">
                          {isEditingTarget ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                              autoFocus
                              className="w-16 px-1 text-right border border-[#2b6cb0] rounded-md bg-white text-slate-900 font-bold"
                            />
                          ) : (
                            <span 
                              onClick={() => startEditing(pitch.id, 'totalSampleSize', pitch.totalSampleSize)}
                              onDoubleClick={() => startEditing(pitch.id, 'totalSampleSize', pitch.totalSampleSize)}
                              className="cursor-pointer border-b border-dashed border-slate-200 hover:border-slate-800"
                            >
                              {pitch.totalSampleSize.toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* 4. LOI (1..100 range, green DB ones, grey others) */}
                        <td className="p-2 col-static font-mono text-center">
                          <ComboboxCell
                            value={pitch.loi && pitch.loi > 0 ? pitch.loi : ''}
                            onSave={(val) => handleCellSave(pitch.id, 'loi', val)}
                            options={pitchSpecs.loiDropdownOptions}
                            preExistingOptions={pitchSpecs.preExistingLois}
                            specType="loi"
                            placeholder="Insert LOI"
                            displayValue={pitch.loi && pitch.loi > 0 ? `${pitch.loi}m` : undefined}
                            align="center"
                            widthClass="w-20"
                          />
                        </td>

                        {/* 5. IR% (1%..100% range, green DB ones, grey others) */}
                        <td className="p-2 col-static font-mono text-center font-bold text-emerald-950">
                          <ComboboxCell
                            value={pitch.irPercent && pitch.irPercent > 0 ? `${Math.round(pitch.irPercent * 100)}%` : ''}
                            onSave={(val) => handleCellSave(pitch.id, 'irPercent', val)}
                            options={pitchSpecs.irDropdownOptions}
                            preExistingOptions={pitchSpecs.preExistingIrs}
                            specType="ir"
                            placeholder="Insert incidence"
                            displayValue={pitch.irPercent && pitch.irPercent > 0 ? `${Math.round(pitch.irPercent * 100)}%` : undefined}
                            align="center"
                            widthClass="w-20"
                          />
                        </td>

                        {/* 6. IR Universe (country variables) */}
                        <td className="p-2 col-static font-medium text-slate-750 max-w-[130px]" title={pitch.irUniverse}>
                          <ComboboxCell
                            value={pitch.irUniverse}
                            onSave={(val) => handleCellSave(pitch.id, 'irUniverse', val)}
                            options={pitchSpecs.universeDropdownOptions}
                            preExistingOptions={pitchSpecs.preExistingUniverses}
                            specType="universe"
                            placeholder="Insert universe"
                            displayValue={pitch.irUniverse ? <span className="truncate max-w-[110px] inline-block align-middle">{pitch.irUniverse}</span> : undefined}
                            align="left"
                            widthClass="w-40"
                          />
                        </td>

                        {/* 7. Quotas (available quotas & No quotas) */}
                        <td className="p-2 col-static text-slate-600 max-w-[150px]" title={pitch.quotas}>
                          <ComboboxCell
                            value={pitch.quotas || 'No quotas'}
                            onSave={(val) => handleCellSave(pitch.id, 'quotas', val)}
                            options={pitchSpecs.quotaDropdownOptions}
                            preExistingOptions={pitchSpecs.preExistingQuotas}
                            specType="quota"
                            placeholder="Insert quotas"
                            displayValue={pitch.quotas ? <span className="truncate max-w-[130px] inline-block align-middle">{pitch.quotas}</span> : undefined}
                            align="left"
                            widthClass="w-44"
                          />
                        </td>

                         {/* --- INTERNALLY 4 COLUMNS --- */}
                         {/* Visual Separator Column 1 */}
                         <td className="p-0 bg-slate-250 border-r border-slate-350 w-1.5"></td>

                         {/* A. Overlap Assumed */}
                         <td className="p-1 text-center bg-amber-50/40 border-r border-amber-200/40">
                           <select
                             value={pitch.overlapVariable !== undefined ? pitch.overlapVariable : 'auto'}
                             onChange={(e) => {
                               const val = e.target.value === 'auto' ? undefined : parseInt(e.target.value, 10);
                               const updated = pitches.map((p) => {
                                 if (p.id === pitch.id) {
                                   return { ...p, overlapVariable: val };
                                 }
                                 return p;
                               });
                               updatePitchesAndDecheck(updated);
                             }}
                             className="bg-white text-amber-900 border border-amber-200 rounded px-1 py-0.5 text-[10px] font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer max-w-[55px] text-center shadow-xs"
                           >
                             <option value="auto">Auto</option>
                             <option value="0">0%</option>
                             <option value="5">5%</option>
                             <option value="10">10%</option>
                             <option value="15">15%</option>
                             <option value="20">20%</option>
                             <option value="25">25%</option>
                             <option value="30">30%</option>
                             <option value="35">35%</option>
                             <option value="40">40%</option>
                             <option value="45">45%</option>
                             <option value="50">50%</option>
                           </select>
                         </td>

                         {/* B. Max Potential Feasible Output (including overlap penalty, can exceed 100%) */}
                         <td className="p-2 text-center font-mono font-extrabold text-blue-750 bg-blue-50/70 border-r border-blue-200/40 text-[11px] whitespace-nowrap">
                           {maxPotentialFeasiblePct}%
                         </td>

                         {/* C. Internal Max % (represents direct raw database capacity, can exceed 100%) */}
                          <td 
                            className="p-2 text-center bg-[#ebf8ff]/50 font-bold text-slate-900 cursor-pointer hover:bg-amber-50"
                            onClick={() => {
                              if (editingCell?.rowId === pitch.id && editingCell?.field === "maxInternalPercent") return;
                              startEditing(pitch.id, "maxInternalPercent", pitch.maxInternalPercent !== undefined ? pitch.maxInternalPercent : 100);
                            }}
                            onDoubleClick={() => {
                              startEditing(pitch.id, "maxInternalPercent", pitch.maxInternalPercent !== undefined ? pitch.maxInternalPercent : 100);
                            }}
                            title="Click or double click to set maximum internal panel percentage limit (0-100%)."
                          >
                            {editingCell?.rowId === pitch.id && editingCell?.field === "maxInternalPercent" ? (
                              <input
                                type="text"
                                value={tempEditValue}
                                onChange={(e) => setTempEditValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={saveInlineEdit}
                                onKeyDown={(e) => e.key === "Enter" && saveInlineEdit()}
                                autoFocus
                                className="w-12 text-center border border-[#2b6cb0] rounded bg-white text-slate-900 font-bold"
                              />
                            ) : (
                              <span className="cursor-pointer border-b border-dashed border-slate-300 hover:border-[#2b6cb0]">
                                {pitch.maxInternalPercent !== undefined ? `${pitch.maxInternalPercent}% *` : `${internalMaxPct}%`}
                              </span>
                            )}
                          </td>

                          {/* D. Internal Used % */}
                          <td 
                            className="p-2 text-center bg-[#ebf8ff]/40 border-r border-slate-200 cursor-pointer hover:bg-amber-50" 
                            onClick={() => {
                              if (editingCell?.rowId === pitch.id && editingCell?.field === "internalPctOverride") return;
                              const defaultVal = pitch.totalSampleSize > 0 ? Math.round((alloc.allocatedInternal || 0) / pitch.totalSampleSize * 100) : 0;
                              startEditing(pitch.id, "internalPctOverride", pitch.internalPctOverride !== undefined ? pitch.internalPctOverride : defaultVal);
                            }}
                            onDoubleClick={() => {
                              const defaultVal = pitch.totalSampleSize > 0 ? Math.round((alloc.allocatedInternal || 0) / pitch.totalSampleSize * 100) : 0;
                              startEditing(pitch.id, "internalPctOverride", pitch.internalPctOverride !== undefined ? pitch.internalPctOverride : defaultVal);
                            }}
                            title="Click or double click to set custom % override of target size for the Internal panel. Empty, auto, or reset to clear."
                          >
                            {editingCell?.rowId === pitch.id && editingCell?.field === "internalPctOverride" ? (
                              <input
                                type="text"
                                value={tempEditValue}
                                onChange={(e) => setTempEditValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={saveInlineEdit}
                                onKeyDown={(e) => e.key === "Enter" && saveInlineEdit()}
                                autoFocus
                                className="w-12 text-center border border-[#2b6cb0] rounded bg-white text-slate-900 font-bold"
                              />
                            ) : (
                              <span 
                                className="cursor-pointer border-b border-dashed border-slate-300 hover:border-[#2b6cb0] font-semibold text-[#205080]"
                              >
                                {pitch.internalPctOverride !== undefined ? `${pitch.internalPctOverride}% *` : `${pitch.totalSampleSize > 0 ? Math.round((alloc.allocatedInternal || 0) / pitch.totalSampleSize * 100) : 0}%`}
                              </span>
                            )}
                          </td>

                         {/* Visual Separator Column 2 */}
                         <td className="p-0 bg-slate-250 border-r border-slate-350 w-1.5"></td>

                        {/* --- EXTERNALLY PROP COLUMNS (V1-V(N) Max Feasible, Used, CPI) --- */}
                        {vendorMetrics.map((vm) => {
                          const isBgOdd = vm.vIdx % 2 === 1;
                          const bgClass = isBgOdd ? 'bg-emerald-50/50' : 'bg-emerald-50/10';
                          const textClass = isBgOdd ? 'text-emerald-800 font-bold' : 'text-emerald-850 font-semibold';
                          const borderClass = vm.vIdx === vendorMetrics.length ? 'border-r border-slate-200' : '';
                          const allocatedVal = alloc[`allocatedVendor${vm.vIdx}`] || 0;
                          const defaultVendorUsedPct = pitch.totalSampleSize > 0 ? Math.round((allocatedVal / pitch.totalSampleSize) * 100) : 0;

                          return (
                            <React.Fragment key={vm.vIdx}>
                              {/* Vendor Max % */}
                              <td 
                                className={`p-1.5 text-center font-mono ${textClass} ${bgClass}`}
                                title="Vendor Max Capacity limit % (max potential capability)"
                              >
                                <span>
                                  {getPctStr(vm.feasible, pitch.totalSampleSize)}
                                </span>
                              </td>

                              {/* Vendor Used % */}
                              <td 
                                className={`p-1.5 text-center font-mono font-medium bg-[#ebf8ff]/30 cursor-pointer hover:bg-amber-50 ${bgClass}`} 
                                onDoubleClick={() => startEditing(pitch.id, vm.overrideKey, pitch[vm.overrideKey] !== undefined ? pitch[vm.overrideKey] : defaultVendorUsedPct)}
                                title="Double click to set custom % override of target size. Clear to reset."
                              >
                                {editingCell?.rowId === pitch.id && editingCell?.field === vm.overrideKey ? (
                                  <input
                                    type="text"
                                    value={tempEditValue}
                                    onChange={(e) => setTempEditValue(e.target.value)}
                                    onBlur={saveInlineEdit}
                                    onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                                    autoFocus
                                    className={`w-12 text-center border rounded bg-white text-slate-900 font-bold animate-pulse ${vm.isExceeded ? 'border-red-500 text-red-600' : 'border-[#2b6cb0]'}`}
                                  />
                                ) : (
                                  <span 
                                    className={`border-b border-dashed border-slate-300 hover:border-[#205080] font-semibold ${vm.isExceeded ? 'text-red-700 font-bold' : 'text-[#205080]'}`}
                                  >
                                    {pitch[vm.overrideKey] !== undefined ? `${pitch[vm.overrideKey]}% *` : getPctStr(allocatedVal, pitch.totalSampleSize)}
                                  </span>
                                )}
                              </td>

                              {/* Vendor CPI */}
                              <td 
                                className={`p-1.5 text-center font-mono text-slate-600 cursor-pointer hover:bg-amber-50 ${bgClass} ${borderClass}`}
                                onDoubleClick={() => startEditing(pitch.id, vm.cpiKey, vm.cpi)}
                                title="Double click to edit Vendor CPI"
                              >
                                {editingCell?.rowId === pitch.id && editingCell?.field === vm.cpiKey ? (
                                  <input
                                    type="text"
                                    value={tempEditValue}
                                    onChange={(e) => setTempEditValue(e.target.value)}
                                    onBlur={saveInlineEdit}
                                    onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                                    autoFocus
                                    className="w-12 text-center border border-[#2b6cb0] rounded bg-white text-slate-900 font-bold"
                                  />
                                ) : (
                                  <span className="border-b border-dashed border-slate-300 hover:border-[#205080]">
                                    {vm.rawCap > 0 ? `$${vm.cpi.toFixed(2)}` : '-'}
                                  </span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        {/* --- SPENT & FEASIBILITY CALCULATIONS OUTPUT --- */}
                        <td className="p-2">
                          <InstantTooltip text={
                            alloc.status === 'Fully Feasible' 
                              ? '100% Demand Feasible' 
                              : alloc.status === 'Oversample' 
                                ? 'Allocated sample exceeds target' 
                                : `Deficit (-${alloc.unfilledSample.toLocaleString()} sample): ${unfeasibleReason}`
                          }>
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border cursor-help ${
                                alloc.status === 'Fully Feasible' 
                                  ? 'text-emerald-800 bg-emerald-100/85 border-emerald-200' 
                                  : alloc.status === 'Oversample'
                                    ? 'text-purple-800 bg-purple-100/85 border-purple-200'
                                    : alloc.status === 'Partially Feasible' 
                                      ? 'text-amber-805 bg-amber-100/85 border-amber-200 shadow-2xs' 
                                      : 'text-rose-800 bg-rose-100 border-rose-250 shadow-2xs'
                              }`}
                            >
                              {alloc.status === 'Fully Feasible' ? (
                                'Secured'
                              ) : alloc.status === 'Oversample' ? (
                                'Oversample'
                              ) : alloc.status === 'Partially Feasible' ? (
                                <>
                                  Deficit (-{alloc.unfilledSample})
                                  <HelpCircle className="h-2 w-2 opacity-60 ml-0.5" />
                                </>
                              ) : (
                                <>
                                  Unfilled
                                  <HelpCircle className="h-2.5 w-2.5 opacity-70 ml-0.5 text-rose-700" />
                                </>
                              )}
                            </span>
                          </InstantTooltip>
                        </td>

                        <td
                          className={`p-2 text-right font-mono font-bold ${
                            alloc.status === 'Oversample' ? 'text-purple-700' : 'text-[#2b6cb0]'
                          } ${alloc.totalAllocated === 0 ? 'cursor-help' : ''}`}
                        >
                          {alloc.totalAllocated === 0 ? (
                            <InstantTooltip text={`0 feasible: ${unfeasibleReason}`}>
                              <span className="inline-flex items-center gap-1 justify-end text-rose-500 font-bold cursor-help">
                                0
                                <HelpCircle className="h-2.5 w-2.5 opacity-60 text-rose-400" />
                              </span>
                            </InstantTooltip>
                          ) : (
                            alloc.totalAllocated.toLocaleString()
                          )}
                        </td>

                        <td
                          className={`p-2 text-right font-mono ${alloc.unfilledSample > 0 ? 'text-rose-600 font-bold cursor-help' : 'text-slate-400'}`}
                        >
                          {alloc.unfilledSample > 0 ? (
                            <InstantTooltip text={`Deficit (-${alloc.unfilledSample.toLocaleString()} sample): ${unfeasibleReason}`}>
                              <span className="inline-flex items-center gap-1 justify-end cursor-help">
                                {alloc.unfilledSample.toLocaleString()}
                                <HelpCircle className="h-2.5 w-2.5 opacity-60 text-rose-500" />
                              </span>
                            </InstantTooltip>
                          ) : (
                            '0'
                          )}
                        </td>

                        {/* Missing % */}
                        <td
                          className={`p-2 text-right font-mono ${alloc.unfilledSample > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}
                          title={alloc.unfilledSample > 0 ? `${pitch.totalSampleSize > 0 ? Math.round((alloc.unfilledSample / pitch.totalSampleSize) * 100) : 0}% deficit` : '0% missing'}
                        >
                          {pitch.totalSampleSize > 0 ? `${Math.round((alloc.unfilledSample / pitch.totalSampleSize) * 100)}%` : '0%'}
                        </td>

                        <td className="p-2 text-right font-mono text-[#205080] font-bold">
                          {displayMaxPotential.toLocaleString()}
                        </td>

                        <td 
                          className="p-2 text-center font-mono text-slate-755 whitespace-nowrap"
                          title="Calculated Internal panel share % vs external vendors share %"
                        >
                          <span className="font-semibold text-indigo-755">{alloc.internalSharePct}%</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="font-semibold text-emerald-700">{alloc.externalSharePct}%</span>
                        </td>

                        <td className="p-2 text-center font-mono font-bold text-slate-705">
                          {alloc.numVendorsUsed}
                        </td>

                        <td className="p-2 text-right font-mono" title={alloc.hasLoiMarkup ? alloc.loiMarkupNote : undefined}>
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1 justify-end">
                              {alloc.hasLoiMarkup && (
                                <span
                                  className="text-[8px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-sans font-bold cursor-help"
                                  title={alloc.loiMarkupNote}
                                >
                                  +10% LOI
                                </span>
                              )}
                              {pitch.targetedCpi !== undefined && pitch.targetedCpi > 0 ? (
                                alloc.weightedCpi > pitch.targetedCpi ? (
                                  <span className="text-red-650 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-mono font-bold tracking-tight text-right block">
                                    ${alloc.weightedCpi.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 font-mono font-bold">
                                    ${alloc.weightedCpi.toFixed(2)}
                                  </span>
                                )
                              ) : (
                                <span className="text-emerald-800 font-mono font-bold">
                                  ${alloc.weightedCpi.toFixed(2)}
                                </span>
                              )}
                            </div>
                            {alloc.hasLoiMarkup && (
                              <span
                                className="text-[8px] text-amber-600 italic font-medium cursor-help"
                                title={alloc.loiMarkupNote}
                              >
                                * LOI assumption (+10%)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-2 text-right font-mono whitespace-nowrap" title={alloc.hasLoiMarkup ? alloc.loiMarkupNote : (pitch.targetedCpi ? `Targeted CPI: $${pitch.targetedCpi.toFixed(2)}` : undefined)}>
                          {editingCell?.rowId === pitch.id && editingCell?.field === 'targetedCpi' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                              autoFocus
                              className="w-16 px-1 text-right border border-[#2b6cb0] rounded bg-white text-slate-900 font-bold"
                            />
                          ) : (
                            <span 
                              onDoubleClick={() => startEditing(pitch.id, 'targetedCpi', pitch.targetedCpi !== undefined && pitch.targetedCpi > 0 ? pitch.targetedCpi : '')}
                              className="cursor-pointer border-b border-dashed border-slate-300 hover:border-[#2b6cb0] font-semibold text-slate-705"
                              title="Double click to edit Targeted CPI"
                            >
                              {pitch.targetedCpi !== undefined && pitch.targetedCpi > 0 ? `$${pitch.targetedCpi.toFixed(2)}` : '-'}
                            </span>
                          )}
                        </td>

                        <td className="p-2 text-right font-mono text-slate-800">
                          {isEditingPmFee ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                              autoFocus
                              className="w-12 text-center border border-[#2b6cb0] rounded bg-white text-slate-900 font-semibold"
                            />
                          ) : (
                            <span 
                              onDoubleClick={() => startEditing(pitch.id, 'pmFee', pitch.pmFee !== undefined ? pitch.pmFee : 150)}
                              className="cursor-pointer border-b border-dashed border-slate-205 hover:border-[#2b6cb0] font-semibold"
                            >
                              ${pitch.pmFee !== undefined ? pitch.pmFee : 150}
                            </span>
                          )}
                        </td>

                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            (pitch.comparability || 'High') === 'High' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-805 border border-amber-200'
                          }`}>
                            {pitch.comparability || 'High'}
                          </span>
                        </td>

                        <td className="p-2 text-right font-mono text-slate-900 font-bold">
                          ${alloc.externalCost.toLocaleString()}
                        </td>

                        <td className="p-2 text-right font-mono font-bold border-r border-slate-200">
                          <span className={`px-2 py-0.5 rounded ${rowOpPct >= 0 ? 'bg-emerald-50 text-emerald-850' : 'bg-rose-50 text-rose-850'}`}>
                            {rowOpPct.toFixed(1)}%
                          </span>
                        </td>

                        {/* Action Lock */}
                        <td className="p-2 text-center bg-slate-50/50">
                          <button
                            onClick={() => handleToggleLockRow(pitch.id)}
                            className={`p-1.5 rounded-md border transition shadow-sm cursor-pointer mx-auto flex items-center justify-center ${
                              pitch.isLocked
                                ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200 animate-pulse'
                                : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                            }`}
                            title={pitch.isLocked ? "Row is LOCKED. Click to unlock" : "Row is UNLOCKED. Click to lock"}
                          >
                            {pitch.isLocked ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              <Unlock className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>

                        {/* Action Duplicate */}
                        <td className="p-2 text-center bg-slate-50/50">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateRow(pitch.id);
                            }}
                            className="p-1.5 bg-[#ebf8ff] hover:bg-[#bee3f8] text-[#2b6cb0] rounded-md border border-[#bee3f8] hover:text-[#205080] transition shadow-xs mx-auto flex items-center justify-center cursor-pointer"
                            title="Duplicate scenario option"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </td>

                        {/* Action Delete */}
                        <td className="p-2 text-center bg-slate-50/50">
                          <button
                            type="button"
                            id={`del-row-${pitch.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRow(pitch.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 transition mx-auto flex items-center justify-center cursor-pointer"
                            title="Delete scenario option"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {pitches.length > 0 && (
        <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/30">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-emerald-600" />
            <span>Click or double click cells to edit. Manually set vendor % sliders to instantly scale capacities and save scenarios!</span>
          </div>
          <div>
            <span className="font-semibold">{filteredPitches.length} showing</span> / {pitches.length} options overall
          </div>
        </div>
      )}
      <datalist id="country-datalist">
        {ALL_COUNTRIES.map((cty) => (
          <option key={cty} value={cty} />
        ))}
      </datalist>
    </div>
  );
}
