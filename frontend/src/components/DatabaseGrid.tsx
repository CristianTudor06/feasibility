import React, { useState, useRef } from 'react';
import { FeasibilityRow, StrategyType, VendorTier } from '../types';
import { parseCSVToPitches } from '../lib/csvParser';
import { ALL_COUNTRIES } from '../data/countries';
import { calculateAllRows, deduplicateDbRows } from '../lib/calculator';
import { VENDOR_DATABASE_POOL } from '../data/defaultData';
import { 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
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
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  React.useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract unique markets
  const markets = ['All', ...Array.from(new Set(pitches.map((p) => p.market)))];

  const allocations = passedAllocations || calculateAllRows(pitches, activeStrategy, vendors);

  // Search/Filter
  const filteredPitches = pitches.filter((pitch) => {
    const matchesSearch =
      pitch.pitchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pitch.market.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pitch.target.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMarket = selectedMarket === 'All' || pitch.market === selectedMarket;

    return matchesSearch && matchesMarket;
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const updatePitchesAndDecheck = (newPitches: FeasibilityRow[]) => {
    onUpdatePitches(newPitches);
    if (setHasChecked) {
      setHasChecked(false);
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
        alert(`Error parsing CSV file: ${err.message || err}`);
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
      alert("This line is locked and cannot be deleted!");
      return;
    }
    const ok = window.confirm("Are you sure you want to delete this option specs line?");
    if (!ok) return;
    updatePitchesAndDecheck(pitches.filter((p) => p.id !== id));
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
              value = Math.max(0, num);
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

  const handleAddNewVendor = () => {
    if (!vendors || !onUpdateVendors) {
      setToastNotification({ message: "Vendor updating is unavailable in this view.", type: "error" });
      return;
    }

    const activeNames = vendors.map(v => v.name.toLowerCase().trim());
    const candidates = VENDOR_DATABASE_POOL.filter(candidate => {
      return !activeNames.includes(candidate.name.toLowerCase().trim());
    });

    if (candidates.length === 0) {
      setToastNotification({ message: "No vendors available", type: "error" });
      return;
    }

    const getTierPriority = (tier: string) => {
      const t = String(tier || '').toLowerCase();
      if (t.includes('0') || t.includes('prime')) return 0;
      if (t.includes('1')) return 1;
      if (t.includes('2')) return 2;
      if (t.includes('3')) return 3;
      return 4;
    };

    const getColorPriority = (color: string) => {
      const c = String(color || '').toLowerCase();
      if (c === 'green') return 1;
      if (c === 'yellow') return 2;
      if (c === 'orange') return 3;
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
          const matches = insertedDatabase.filter((dbRow: any) => {
            const m1 = String(dbRow.market || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const m2 = String(pitch.market || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (m1 !== m2) return false;

            const t1 = String(dbRow.target || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const t2 = String(pitch.target || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const u1 = String(dbRow.irUniverse || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const u2 = String(pitch.irUniverse || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            return (
              t1 === t2 ||
              u1 === u2 ||
              (t1 && t2 && (t1.includes(t2) || t2.includes(t1))) ||
              (u1 && u2 && (u1.includes(u2) || u2.includes(u1)))
            );
          });

          const deduplicatedMatches = deduplicateDbRows(matches);
          const capSum = deduplicatedMatches.reduce((sum: number, r: any) => sum + (parseInt(r[dbCapKey], 10) || 0), 0);
          if (capSum > 0) {
            lineCap = capSum;
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
      const matches = dbSearchSource.filter((dbRow: any) => {
        const m1 = String(dbRow.market || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const m2 = String(pitch.market || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (m1 !== m2) return false;

        const t1 = String(dbRow.target || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const t2 = String(pitch.target || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const u1 = String(dbRow.irUniverse || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const u2 = String(pitch.irUniverse || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        return (
          t1 === t2 ||
          u1 === u2 ||
          (t1 && t2 && (t1.includes(t2) || t2.includes(t1))) ||
          (u1 && u2 && (u1.includes(u2) || u2.includes(u1)))
        );
      });

      if (matches.length > 0 && vendorNumInDb > 0) {
        const deduplicatedMatches = deduplicateDbRows(matches);
        realCapacity = deduplicatedMatches.reduce((sum: number, r: any) => sum + (parseInt(r[dbCapKey], 10) || 0), 0);
        for (const mr of deduplicatedMatches) {
          const val = parseFloat(mr[dbCpiKey]);
          if (val > 0) {
            realCpi = val;
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
      {toastNotification && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all animate-fade-in ${
          toastNotification.type === 'error'
            ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-amber-900/10'
            : toastNotification.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-900/10'
            : 'bg-blue-50 border-blue-300 text-blue-900 shadow-blue-900/10'
        }`} id="fe-toast-notification">
          {toastNotification.type === 'error' ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          )}
          <span>{toastNotification.message}</span>
          <button
            onClick={() => setToastNotification(null)}
            className="ml-2 p-1 rounded-md hover:bg-black/5 text-slate-500 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
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
              className="pl-9 pr-4 py-1.5 w-60 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] focus:border-[#2b6cb0]"
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
            id="add-new-vendor-btn"
            onClick={handleAddNewVendor}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#2b6cb0] bg-blue-50 border border-blue-200 rounded-lg hover:text-[#205080] hover:bg-blue-100 transition"
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
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            id="insert-specs-btn"
          >
            <FileUp className="h-4 w-4 text-[#2b6cb0]" />
            Insert Specs (Excel/CSV)
          </button>

          <button
            id="add-blank-row"
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <Plus className="h-4 w-4 text-emerald-600" />
            Add Scenario
          </button>

          <button
            id="reset-db-btn"
            onClick={onResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:text-slate-900 hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Defaults
          </button>

          <button
            id="help-toggle-btn"
            onClick={() => setHelpOpen(!helpOpen)}
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
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
          <div className="overflow-x-auto relative">
            {filteredPitches.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50/20">
                <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-800">No pitch records match filters</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Insert specs from Excel, add a blank scenario, or drag & drop a compatible CSV file.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse" style={{ fontSize: feasibilityFontSizeDelta === -1 ? '11px' : feasibilityFontSizeDelta === 1 ? '13px' : '12px' }}>
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

                    return (
                      <tr 
                        key={pitch.id} 
                        className="hover:bg-slate-50/50 transition-colors group text-[11px]"
                      >
                        {/* 2. Country / Market */}
                        <td className="p-2 col-static text-slate-800 font-bold">
                          {isEditingMarket ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                              autoFocus
                              list="country-datalist"
                              className="px-1 border border-[#2b6cb0] rounded-md bg-white text-slate-800 w-full"
                            />
                          ) : (
                            <span 
                              onDoubleClick={() => startEditing(pitch.id, 'market', pitch.market)}
                              className="cursor-pointer border-b border-dashed border-slate-200 hover:border-slate-800 font-bold text-slate-900 inline-block min-w-[70px] min-h-[1.5em] align-middle select-none"
                              title="Double click to edit country"
                            >
                              {String(pitch.market || '').trim() || (
                                <span className="text-slate-400 italic font-normal text-[10px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150">
                                  (Empty)
                                </span>
                              )}
                            </span>
                          )}
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
                              onDoubleClick={() => startEditing(pitch.id, 'totalSampleSize', pitch.totalSampleSize)}
                              className="cursor-pointer border-b border-dashed border-slate-200 hover:border-slate-800"
                            >
                              {pitch.totalSampleSize.toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* 4. LOI */}
                        <td className="p-2 col-static font-mono text-center">
                          {editingCell?.rowId === pitch.id && editingCell?.field === 'loi' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                              autoFocus
                              className="w-12 px-1 text-center border border-[#2b6cb0] rounded-md bg-white text-slate-930 font-sans"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => startEditing(pitch.id, 'loi', pitch.loi)}
                              className="cursor-pointer border-b border-dashed border-slate-200 hover:border-slate-800"
                            >
                              {pitch.loi}m
                            </span>
                          )}
                        </td>

                        {/* 5. IR% */}
                        <td className="p-2 col-static font-mono text-center font-bold text-emerald-950">
                          {editingCell?.rowId === pitch.id && editingCell?.field === 'irPercent' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                              autoFocus
                              className="w-12 px-1 text-center border border-[#2b6cb0] rounded-md bg-white text-slate-935 font-sans font-bold"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => startEditing(pitch.id, 'irPercent', (pitch.irPercent * 100).toFixed(0) + '%')}
                              className="cursor-pointer border-b border-dashed border-slate-200 hover:border-slate-800"
                            >
                              {(pitch.irPercent * 100).toFixed(0)}%
                            </span>
                          )}
                        </td>

                        {/* 6. IR Universe */}
                        <td className="p-2 col-static font-medium text-slate-750 truncate max-w-[100px]" title={pitch.irUniverse}>
                          {editingCell?.rowId === pitch.id && editingCell?.field === 'irUniverse' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                              autoFocus
                              className="w-20 px-1 border border-[#2b6cb0] rounded-md bg-white text-slate-800 font-sans font-normal"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => startEditing(pitch.id, 'irUniverse', pitch.irUniverse)}
                              className="cursor-pointer border-b border-dashed border-slate-200 hover:border-slate-800"
                            >
                              {pitch.irUniverse}
                            </span>
                          )}
                        </td>

                        {/* 7. Quotas */}
                        <td className="p-2 col-static text-slate-600 truncate max-w-[130px]" title={pitch.quotas}>
                          {editingCell?.rowId === pitch.id && editingCell?.field === 'quotas' ? (
                            <input
                              type="text"
                              value={tempEditValue}
                              onChange={(e) => setTempEditValue(e.target.value)}
                              onBlur={saveInlineEdit}
                              onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                              autoFocus
                              className="w-28 px-1 border border-[#2b6cb0] rounded-md bg-white text-slate-800 font-sans font-normal"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => startEditing(pitch.id, 'quotas', pitch.quotas)}
                              className="cursor-pointer border-b border-dashed border-slate-200 hover:border-slate-800"
                            >
                              {pitch.quotas || 'No Quotas'}
                            </span>
                          )}
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
                           className="p-2 text-center bg-[#ebf8ff]/50 font-bold text-slate-900"
                           title="Max internal panel capability limit % (max potential capacity)"
                         >
                           <span>
                             {pitch.maxInternalPercent !== undefined ? `${pitch.maxInternalPercent}% *` : `${internalMaxPct}%`}
                           </span>
                         </td>

                         {/* D. Internal Used % */}
                         <td 
                           className="p-2 text-center bg-[#ebf8ff]/40 border-r border-slate-200 cursor-pointer hover:bg-amber-50" 
                           onDoubleClick={() => {
                             const defaultVal = pitch.totalSampleSize > 0 ? Math.round((alloc.allocatedInternal || 0) / pitch.totalSampleSize * 100) : 0;
                             startEditing(pitch.id, 'internalPctOverride', pitch.internalPctOverride !== undefined ? pitch.internalPctOverride : defaultVal);
                           }}
                           title="Double click to set custom % override of target size for the Internal panel. Empty, auto, or reset to clear."
                         >
                           {editingCell?.rowId === pitch.id && editingCell?.field === 'internalPctOverride' ? (
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
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            alloc.status === 'Fully Feasible' 
                              ? 'text-emerald-800 bg-emerald-100/85 border-emerald-200' 
                              : alloc.status === 'Oversample'
                                ? 'text-purple-800 bg-purple-100/85 border-purple-200'
                                : alloc.status === 'Partially Feasible' 
                                  ? 'text-amber-805 bg-amber-100/85 border-amber-200' 
                                  : 'text-rose-800 bg-rose-100 border-rose-250'
                          }`}>
                            {alloc.status === 'Fully Feasible' 
                              ? 'Secured' 
                              : alloc.status === 'Oversample'
                                ? 'Oversample'
                                : alloc.status === 'Partially Feasible' 
                                  ? `Deficit (-${alloc.unfilledSample})` 
                                  : 'Unfilled'}
                          </span>
                        </td>

                        <td className={`p-2 text-right font-mono font-bold ${
                          alloc.status === 'Oversample' ? 'text-purple-700' : 'text-[#2b6cb0]'
                        }`}>
                          {alloc.totalAllocated.toLocaleString()}
                        </td>

                        <td className={`p-2 text-right font-mono ${alloc.unfilledSample > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                          {alloc.unfilledSample > 0 ? alloc.unfilledSample.toLocaleString() : '0'}
                        </td>

                        <td className="p-2 text-right font-mono text-[#205080] font-bold">
                          {displayMaxPotential.toLocaleString()}
                        </td>

                        <td 
                          className="p-2 text-center font-mono text-slate-755 whitespace-nowrap cursor-pointer hover:bg-amber-50"
                          onDoubleClick={() => {
                            const defaultVal = pitch.totalSampleSize > 0 ? Math.round((alloc.allocatedInternal || 0) / pitch.totalSampleSize * 100) : 0;
                            startEditing(pitch.id, 'internalPctOverride', pitch.internalPctOverride !== undefined ? pitch.internalPctOverride : defaultVal);
                          }}
                          title="Double click to set Internal Used % override share"
                        >
                          {editingCell?.rowId === pitch.id && editingCell?.field === 'internalPctOverride' ? (
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
                            <>
                              <span className="font-semibold text-indigo-755">{alloc.internalSharePct}%</span>
                              <span className="text-slate-300 mx-1">/</span>
                              <span className="font-semibold text-emerald-700">{alloc.externalSharePct}%</span>
                            </>
                          )}
                        </td>

                        <td className="p-2 text-center font-mono font-bold text-slate-705">
                          {alloc.numVendorsUsed}
                        </td>

                        <td className="p-2 text-right font-mono">
                          {pitch.targetedCpi !== undefined && pitch.targetedCpi > 0 ? (
                            alloc.weightedCpi > pitch.targetedCpi ? (
                              <span className="text-red-650 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-mono font-bold tracking-tight text-right w-full block">
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
                        </td>

                        <td className="p-2 text-right font-mono whitespace-nowrap">
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
                            onClick={() => handleDuplicateRow(pitch.id)}
                            className="p-1.5 bg-[#ebf8ff] hover:bg-[#bee3f8] text-[#2b6cb0] rounded-md border border-[#bee3f8] hover:text-[#205080] transition shadow-sm mx-auto flex items-center justify-center cursor-pointer"
                            title="Duplicate scenario option"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </td>

                        {/* Action Delete */}
                        <td className="p-2 text-center bg-slate-50/50">
                          <button
                            id={`del-row-${pitch.id}`}
                            onClick={() => handleDeleteRow(pitch.id)}
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
            <span>Double click cells to edit. Manually set vendor % sliders to instantly scale capacities and save scenarios!</span>
          </div>
          <div>
            <span className="font-semibold">{filteredPitches.length} showing</span> / {pitches.length} options overall
          </div>
        </div>
      )}

      {/* Dynamic Feasibility Costs output table inside Manage Scenarios tab! - REMOVED per user request */}
      {false && (
      <div className="mt-6 border-t border-slate-200 pt-6 space-y-4" id="scenarios-calculations-output-box">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="fe-scenarios-results-grid-box">
          <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <TrendingDown className="h-4.5 w-4.5 text-[#2b6cb0]" />
                Feasibility &amp; Spend Calculations (Live Preview)
              </h3>
              <p className="text-[11px] text-slate-500">Live feasibility outputs computed instantly over active scenario specs.</p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Start Checking Dropdown inside scenario specifications wrapper */}
              <div className="relative inline-block text-left" id="start-checking-actions-grid">
                <button
                  type="button"
                  onClick={() => setIsCheckDropdownOpen(!isCheckDropdownOpen)}
                  disabled={isChecking || pitches.length === 0}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition shadow-sm cursor-pointer border ${
                    isChecking || pitches.length === 0
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-indigo-650 hover:bg-indigo-700 text-white border-indigo-700 bg-indigo-600'
                  }`}
                  id="check-feasibility-dropdown-btn-grid"
                  title="Select feasibility evaluation style from the database"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1 mb-0.5" />
                  {isChecking ? 'Checking...' : 'Check Feasibility'}
                  <ChevronDown className="h-3 w-3 ml-1 mb-0.5" />
                </button>

                {isCheckDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsCheckDropdownOpen(false)} 
                    />
                    <div className="absolute right-0 mt-1.5 w-64 rounded-lg bg-white border border-slate-200 shadow-xl z-50 overflow-hidden py-1 text-left" id="check-feasibility-dropdown-menu-grid">
                      {/* 1. Feasibility for Targets */}
                      <button
                        type="button"
                        onClick={() => {
                          onStartChecking?.();
                          setIsCheckDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-800 font-medium flex items-center gap-2.5 border-b border-slate-100 cursor-pointer"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-900">Feasibility for Targets</div>
                          <div className="text-[10px] text-slate-400">Depletes capacities &amp; extends externally</div>
                        </div>
                      </button>

                      {/* 2. Feasibility for options */}
                      <button
                        type="button"
                        onClick={() => {
                          onStartCheckingForOptions?.();
                          setIsCheckDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-800 font-medium flex items-center gap-2.5 border-b border-slate-100 cursor-pointer"
                      >
                        <Layers className="h-4 w-4 text-sky-600 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-900">Feasibility for options</div>
                          <div className="text-[10px] text-slate-400">Re-uses database row capacities fully</div>
                        </div>
                      </button>

                      {/* 3. Feasibility Optimized */}
                      <button
                        type="button"
                        onClick={() => {
                          onStartCheckingOptimized?.();
                          setIsCheckDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-800 font-medium flex items-center gap-2.5 cursor-pointer"
                      >
                        <Sliders className="h-4 w-4 text-indigo-600 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-900">Feasibility Optimized</div>
                          <div className="text-[10px] text-slate-400">Optimizes panel blends, CPIs &amp; budget</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {!hasChecked && pitches.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 p-3 text-xs text-amber-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-650 shrink-0" />
                <span>
                  <strong>Specs Updated</strong>: Your scenario specification changes require checking. Click <strong>Check Feasibility</strong> to refresh feasibility metrics.
                </span>
              </div>
              <button
                onClick={onStartChecking}
                disabled={isChecking}
                className="px-2.5 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition pointer-events-auto shrink-0 shadow cursor-pointer"
              >
                Check Feasibility
              </button>
            </div>
          )}

          <div className="overflow-x-auto text-[11px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-2">Option</th>
                  <th className="p-2 text-center bg-slate-100/40 min-w-[170px]">Specifications Overview</th>
                  <th className="p-2">Feasibility Status</th>
                  <th className="p-2 text-right">Target</th>
                  <th className="p-2 text-right text-[#2b6cb0]">feasible</th>
                  <th className="p-2 text-right text-rose-700">missing</th>
                  <th className="p-2 text-right text-[#205080]" title="Specs Potential max feasible">max feasible</th>
                  <th className="p-2 text-center text-slate-800">Internal/Ext Share</th>
                  <th className="p-2 text-center text-slate-700 font-bold" title="Number of external vendors utilized">Nr of vendors</th>
                  <th className="p-2 text-right text-emerald-850 font-bold">Weighted CPI</th>
                  <th className="p-2 text-right text-indigo-950 font-bold">Targeted CPI</th>
                  <th className="p-2 text-right text-slate-800">PM Fee</th>
                  <th className="p-2 text-center">Comparability</th>
                  <th className="p-2 text-right text-slate-900 font-bold">Total external costs (no markup)</th>
                  <th className="p-2 text-right text-emerald-800 font-bold">OP %</th>
                </tr>
              </thead>
              <tbody>
                {pitches.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-slate-400 font-sans italic">
                      No scenario specifications loaded.
                    </td>
                  </tr>
                ) : (
                  pitches.map((pitch) => {
                    const alloc = allocations.find((a) => a.rowId === pitch.id) || {
                      status: 'Unfeasible',
                      allocatedInternal: 0,
                      allocatedVendor1: 0,
                      allocatedVendor2: 0,
                      allocatedVendor3: 0,
                      allocatedVendor4: 0,
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

                    const rowSalesCpi = pitch.salesCpi !== undefined ? pitch.salesCpi : 7.50;
                    const rowRevenue = alloc.totalAllocated * rowSalesCpi;
                    const rowOpCosts = (alloc.externalCost || 0) + (alloc.internalCostRef || 0);
                    const rowOpPct = rowRevenue > 0 ? ((rowRevenue - rowOpCosts) / rowRevenue) * 100 : 0;

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

                    return (
                      <tr key={pitch.id} className="hover:bg-slate-50 border-b border-slate-50 text-[11px]">
                        <td className="p-2 font-medium text-slate-900">
                          <span className="font-bold block text-slate-850">{pitch.market}</span>
                        </td>
                        
                         {/* Specifications Overview Column INSIDE output table inside scenarios tab as well */}
                        <td className="p-2 bg-slate-50/40 text-center">
                          <div className="flex flex-col gap-0.5 text-[10px] items-center justify-center">
                            <div className="flex items-center gap-1.5 font-sans justify-center">
                              <span className="font-bold text-[#205080]" title="Length of interview">LOI:</span>
                              <span className="text-slate-750 font-mono font-medium">{pitch.loi}m</span>
                              <span className="text-slate-300">|</span>
                              <span className="font-bold text-emerald-800" title="Incidence rate percentage">IR%:</span>
                              <span className="text-emerald-950 font-mono font-bold">{(pitch.irPercent * 100).toFixed(0)}%</span>
                              <span className="text-slate-300">|</span>
                              <span className="font-bold text-[#205080]" title="IR universe">Univ:</span>
                              <span className="text-slate-750 font-mono font-medium truncate max-w-[85px] inline-block align-bottom" title={pitch.irUniverse}>{pitch.irUniverse}</span>
                            </div>
                            <div className="text-[9px] text-slate-500 font-medium truncate flex gap-1 justify-center">
                              <span className="text-slate-400 font-bold">Quotas:</span> <span className="text-slate-600 truncate max-w-[130px]" title={pitch.quotas}>{pitch.quotas}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-2">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            alloc.status === 'Fully Feasible' 
                              ? 'text-emerald-800 bg-emerald-100/80 border-emerald-200' 
                              : alloc.status === 'Oversample'
                                ? 'text-purple-800 bg-purple-100/80 border-purple-200'
                                : alloc.status === 'Partially Feasible' 
                                  ? 'text-amber-805 bg-amber-100/85 border-amber-200' 
                                  : 'text-rose-800 bg-rose-105 border-rose-250'
                          }`}>
                            {alloc.status === 'Fully Feasible' 
                              ? 'Secured' 
                              : alloc.status === 'Oversample'
                                ? 'Oversample'
                                : alloc.status === 'Partially Feasible' 
                                  ? `Deficit (-${alloc.unfilledSample})` 
                                  : 'Unfilled'}
                          </span>
                        </td>

                        <td className="p-2 text-right font-mono text-slate-700">
                          {pitch.totalSampleSize.toLocaleString()}
                        </td>

                        <td className={`p-2 text-right font-mono font-bold ${
                          alloc.status === 'Oversample' ? 'text-purple-700' : 'text-[#2b6cb0]'
                        }`}>
                          {alloc.totalAllocated.toLocaleString()}
                        </td>

                        <td className={`p-2 text-right font-mono ${alloc.unfilledSample > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                          {alloc.unfilledSample > 0 ? alloc.unfilledSample.toLocaleString() : '0'}
                        </td>

                        <td className="p-2 text-right font-mono text-indigo-900 font-bold">
                          {displayMaxPotential.toLocaleString()}
                        </td>

                        <td 
                          className="p-2 text-center font-mono text-slate-750 cursor-pointer hover:bg-amber-50"
                          onDoubleClick={() => {
                            const defaultVal = pitch.totalSampleSize > 0 ? Math.round((alloc.allocatedInternal || 0) / pitch.totalSampleSize * 100) : 0;
                            startEditing(pitch.id, 'internalPctOverride', pitch.internalPctOverride !== undefined ? pitch.internalPctOverride : defaultVal);
                          }}
                          title="Double click to set Internal Used % override share"
                        >
                          {editingCell?.rowId === pitch.id && editingCell?.field === 'internalPctOverride' ? (
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
                            <>
                              <span className="font-semibold text-indigo-750">{alloc.internalSharePct}%</span>
                              <span className="text-slate-355 mx-0.5">/</span>
                              <span className="font-semibold text-emerald-700">{alloc.externalSharePct}%</span>
                            </>
                          )}
                        </td>

                        <td className="p-2 text-center font-mono font-bold text-slate-705">
                          {alloc.numVendorsUsed}
                        </td>

                        <td className={`p-2 text-right font-mono font-bold ${
                          pitch.targetedCpi !== undefined && pitch.targetedCpi > 0
                            ? (alloc.weightedCpi > pitch.targetedCpi ? 'text-rose-655 font-bold' : 'text-emerald-655 font-bold')
                            : 'text-emerald-800'
                        }`}>
                          ${alloc.weightedCpi.toFixed(2)}
                        </td>

                        <td className="p-2 text-right font-mono whitespace-nowrap">
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
                          ${pitch.pmFee !== undefined ? pitch.pmFee : 150}
                        </td>

                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            (pitch.comparability || 'High') === 'High' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800'
                          }`}>
                            {pitch.comparability || 'High'}
                          </span>
                        </td>

                        <td className="p-2 text-right font-mono text-slate-900 font-bold">
                          ${alloc.externalCost.toLocaleString()}
                        </td>

                        <td className="p-2 text-right font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded ${rowOpPct >= 0 ? 'bg-emerald-50 text-emerald-850' : 'bg-rose-50 text-rose-850'}`}>
                            {rowOpPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
