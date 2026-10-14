import React, { useState, useRef } from 'react';
import { FeasibilityRow, AllocationResult, StrategyType, VendorTier } from '../types';
import { calculateAllRows } from '../lib/calculator';
import { safeStorage } from '../lib/storage';
import { api, SavedOption } from '../lib/api';
import { ALL_COUNTRIES } from '../data/countries';
import { parseCSVToPitches } from '../lib/csvParser';
import {
  FileCheck,
  Calculator,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileDown,
  Share2,
  LogOut,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  TrendingDown,
  Lock,
  Unlock,
  ArrowRight,
  Copy,
  Plus,
  FileSpreadsheet,
  Settings,
  DollarSign,
  Briefcase,
  Layers,
  FileUp,
  PlayCircle,
  FolderPlus,
  RefreshCw,
  Trash2,
  Sparkles,
  Sliders
} from 'lucide-react';

interface SpecsCalculatorProps {
  pitches: FeasibilityRow[];
  activeStrategy: StrategyType;
  onChangeStrategy: (strategy: StrategyType) => void;
  onUpdatePitches: (newPitches: FeasibilityRow[], preserveHasChecked?: boolean) => void;
  savedOptions: SavedOption[];
  setSavedOptions: React.Dispatch<React.SetStateAction<SavedOption[]>>;
  hasChecked: boolean;
  setHasChecked: (checked: boolean) => void;
  isChecking: boolean;
  setIsChecking: (checking: boolean) => void;
  isReloading: boolean;
  setIsReloading: (reloading: boolean) => void;
  onStartChecking: () => void;
  onStartCheckingForOptions?: () => void;
  onStartCheckingOptimized?: () => void;
  allocations?: any[];
  checkingError?: string;
  vendors?: VendorTier[];
  onToggleChat?: () => void;
  onNewSpecsFileAttached?: () => void;
  targetedBudget?: number;
  setTargetedBudget?: (val: number) => void;
  liveFeasibility: boolean;
  onToggleLiveFeasibility: () => void;
}

export default function SpecsCalculator({
  pitches,
  activeStrategy,
  onChangeStrategy,
  onUpdatePitches,
  savedOptions,
  setSavedOptions,
  hasChecked,
  setHasChecked,
  isChecking,
  setIsChecking,
  isReloading,
  setIsReloading,
  onStartChecking,
  onStartCheckingForOptions,
  onStartCheckingOptimized,
  allocations: passedAllocations,
  checkingError,
  vendors,
  onToggleChat,
  onNewSpecsFileAttached,
  targetedBudget = 0,
  setTargetedBudget,
  liveFeasibility,
  onToggleLiveFeasibility
}: SpecsCalculatorProps) {
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCheckDropdownOpen, setIsCheckDropdownOpen] = useState(false);

  // Sizable details collapsible settings with persistence
  const [showStats, setShowStats] = useState(() => {
    const saved = safeStorage.getItem('hide_stats_widget');
    return saved === 'true' ? false : true;
  });

  const [showStrategy, setShowStrategy] = useState(() => {
    const saved = safeStorage.getItem('hide_strategy_widget');
    return saved === 'true' ? false : true;
  });

  const [showOverview, setShowOverview] = useState(() => {
    const saved = safeStorage.getItem('hide_overview_widget');
    return saved === 'true' ? false : true;
  });

  const [showComparison, setShowComparison] = useState(() => {
    const saved = safeStorage.getItem('hide_comparison_widget');
    return saved === 'true' ? false : true;
  });

  const [showOptimizer, setShowOptimizer] = useState(() => {
    const saved = safeStorage.getItem('hide_optimizer_widget');
    return saved === 'true' ? false : true;
  });

  const handleToggleStats = () => {
    const nextVal = !showStats;
    setShowStats(nextVal);
    safeStorage.setItem('hide_stats_widget', nextVal ? 'false' : 'true');
  };

  const handleToggleStrategy = () => {
    const nextVal = !showStrategy;
    setShowStrategy(nextVal);
    safeStorage.setItem('hide_strategy_widget', nextVal ? 'false' : 'true');
  };

  const handleToggleOverview = () => {
    const nextVal = !showOverview;
    setShowOverview(nextVal);
    safeStorage.setItem('hide_overview_widget', nextVal ? 'false' : 'true');
  };

  const handleToggleComparison = () => {
    const nextVal = !showComparison;
    setShowComparison(nextVal);
    safeStorage.setItem('hide_comparison_widget', nextVal ? 'false' : 'true');
  };

  const handleToggleOptimizer = () => {
    const nextVal = !showOptimizer;
    setShowOptimizer(nextVal);
    safeStorage.setItem('hide_optimizer_widget', nextVal ? 'false' : 'true');
  };

  // Save Dialog Options
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveMode, setSaveMode] = useState<'create' | 'override'>('create');
  const [newSaveName, setNewSaveName] = useState('');
  const [selectedOverrideId, setSelectedOverrideId] = useState('');

  // Inline editing state for specs and calculated values
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof FeasibilityRow } | null>(null);
  const [tempEditValue, setTempEditValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Perform advanced calculations
  const allocations = passedAllocations || calculateAllRows(pitches, activeStrategy, vendors);

  // 2. Perform alternative strategies for comparative dashboards
  const costAllocations = calculateAllRows(pitches, 'cost', vendors);
  const tierAllocations = calculateAllRows(pitches, 'tier', vendors);
  const noInternalAllocations = calculateAllRows(pitches, 'no-internal-cost', vendors);

  // Compute key summary figures
  const totalTargetSample = pitches.reduce((sum, p) => sum + p.totalSampleSize, 0);
  const totalAllocatedSample = allocations.reduce((sum, a) => sum + a.totalAllocated, 0);

  // Real combined project spend and client sales totals
  const totalBillableRevenue = allocations.reduce((sum, a) => sum + (a.totalAllocated * a.salesCpi), 0);
  const totalExternalSpendOnly = allocations.reduce((sum, a) => sum + a.externalCost, 0);
  const totalProjectManagerFees = allocations.reduce((sum, a) => sum + a.pmFee, 0);
  const totalInternalCostRef = allocations.reduce((sum, a) => sum + a.internalCostRef, 0);

  // Main cost of the project including external spend + PM fees
  const totalCost = allocations.reduce((sum, a) => sum + a.totalCost, 0);
  const totalOperationalProfit = allocations.reduce((sum, a) => sum + a.operationalProfit, 0);

  // Overall OP %: (Revenue - (External Cost + Internal Cost)) / Revenue (excluding other fees like PM fee)
  const overallOpCostsOnly = totalExternalSpendOnly + totalInternalCostRef;
  const overallOpPct = totalBillableRevenue > 0 ? ((totalBillableRevenue - overallOpCostsOnly) / totalBillableRevenue) * 100 : 0;

  // Internalization %: sum of internal panel share (allocatedInternal) from total needed across all countries (totalTargetSample)
  const totalInternalAllocated = allocations.reduce((sum, a) => sum + a.allocatedInternal, 0);
  const internalizationPct = totalTargetSample > 0 ? (totalInternalAllocated / totalTargetSample) * 100 : 0;

  const unfilledCount = allocations.reduce((sum, a) => sum + a.unfilledSample, 0);
  const fillingRate = totalTargetSample > 0 ? (totalAllocatedSample / totalTargetSample) * 100 : 0;

  // Alternative costs comparisons
  const totalCostCostOpt = costAllocations.reduce((sum, a) => sum + a.totalCost, 0);
  const totalCostTierOpt = tierAllocations.reduce((sum, a) => sum + a.totalCost, 0);
  const totalCostNoInternalOpt = noInternalAllocations.reduce((sum, a) => sum + a.totalCost, 0);

  // Status counters
  const fullyFeasibleCount = allocations.filter(a => a.status === 'Fully Feasible').length;
  const partiallyFeasibleCount = allocations.filter(a => a.status === 'Partially Feasible').length;
  const unfeasibleCount = allocations.filter(a => a.status === 'Unfeasible').length;

  // Duplicate an option ("Button to save and copy the option")
  const handleDuplicateOption = (rowId: string) => {
    const original = pitches.find(p => p.id === rowId);
    if (!original) return;

    const duplicateRow: FeasibilityRow = {
      ...original,
      id: `row-duplicated-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      option: `${original.option} (Copy)`,
    };

    onUpdatePitches([...pitches, duplicateRow]);
  };

  // Add a new blank specification line
  const handleAddLine = () => {
    const newRow: FeasibilityRow = {
      id: `row-new-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      pitchName: pitches.length > 0 ? pitches[0].pitchName : 'Pitch 1',
      source: 'User Creation',
      option: String(pitches.length + 1),
      market: 'Germany',
      target: 'gen pop 18-65yo',
      loi: 10,
      irPercent: 0.20,
      irUniverse: 'gen pop 18-65yo',
      quotas: 'No quotas',
      waves: 1,
      totalFreshSample: 1000,
      totalSampleSize: 1000,
      internal: 0,
      maxInternalPercent: 100,
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
      salesCpi: 7.50,
      comparability: 'High'
    };

    onUpdatePitches([...pitches, newRow]);
  };

  // 1. Clear current specs
  const handleClearSpecs = () => {
    if (confirm("Are you sure you want to clear all the specs? Data will be lost.")) {
      onUpdatePitches([]);
      setHasChecked(false);
    }
  };

  // 4. Trigger Save dialog with choice options
  const handleSaveCurrentOption = () => {
    if (pitches.length === 0) {
      alert("There are no specifications currently loaded to be saved.");
      return;
    }

    const defaultName = `Scenario Option ${savedOptions.length + 1}`;
    setNewSaveName(defaultName);
    // Pick up options saved by colleagues since this page was loaded
    api.listSavedOptions().then(setSavedOptions).catch((err) => console.warn('Could not refresh saved options:', err));
    setSaveMode(savedOptions.length > 0 ? 'create' : 'create'); // default to create new or override
    setSelectedOverrideId(savedOptions[0]?.id || '');
    setShowSaveDialog(true);
  };

  const executeSaveChoice = async () => {
    try {
      await persistSaveChoice();
    } catch (err: any) {
      alert(`Could not save to the server: ${err.message || err}`);
    }
  };

  const persistSaveChoice = async () => {
    const nowStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString();

    if (saveMode === 'create') {
      const finalName = newSaveName.trim() || `Scenario Option ${savedOptions.length + 1}`;

      // Prevent duplicate names in create mode simply
      const nameExists = savedOptions.some(o => o.name.toLowerCase() === finalName.toLowerCase());
      if (nameExists && savedOptions.length > 0) {
        if (!confirm(`An option named "${finalName}" already exists. Do you want to overwrite it instead?`)) {
          return;
        }
        // convert to override
        const target = savedOptions.find(o => o.name.toLowerCase() === finalName.toLowerCase());
        if (target) {
          const overwritten = { ...target, timestamp: nowStamp(), data: JSON.parse(JSON.stringify(pitches)) };
          await api.updateSavedOption(overwritten);
          setSavedOptions(savedOptions.map(opt => opt.id === target.id ? overwritten : opt));
          setShowSaveDialog(false);
          alert(`Option "${finalName}" successfully overwritten!`);
          return;
        }
      }

      const newSaved = {
        id: `saved-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: finalName,
        timestamp: nowStamp(),
        data: JSON.parse(JSON.stringify(pitches))
      };
      await api.createSavedOption(newSaved);
      setSavedOptions([...savedOptions, newSaved]);
      alert(`Option "${finalName}" saved successfully!`);
    } else {
      // override mode
      if (!selectedOverrideId) {
        alert("Please select a saved option target to override.");
        return;
      }
      const targetOpt = savedOptions.find(o => o.id === selectedOverrideId);
      const name = targetOpt ? targetOpt.name : 'Overridden Option';
      if (targetOpt) {
        const overridden = { ...targetOpt, timestamp: nowStamp(), data: JSON.parse(JSON.stringify(pitches)) };
        await api.updateSavedOption(overridden);
        setSavedOptions(savedOptions.map(opt => opt.id === selectedOverrideId ? overridden : opt));
      }
      alert(`Option "${name}" overridden successfully!`);
    }
    setShowSaveDialog(false);
  };

  // Excel (.xlsx) download, generated by the Flask server (replaces the old Google Sheets export)
  const handleDownloadExcel = async () => {
    setErrorMsg('');
    setExporting(true);

    const strategyNameMap = {
      cost: 'Cheapest-First (Internal Panel Preserved)',
      tier: 'Tier-Priority (Quality/Vetting Preserved)',
      'no-internal-cost': 'Excluding Internal Panel (Vendors purely)'
    };

    try {
      await api.downloadExcel(
        pitches,
        allocations,
        strategyNameMap[activeStrategy],
        `feasibility_export_${activeStrategy}_${Date.now()}.xlsx`
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to generate the Excel file.');
    } finally {
      setExporting(false);
    }
  };

  // Standard CSV Feasibility Download
  const handleDownloadStandardCSV = () => {
    const filename = `feasibility_export_${activeStrategy}_${Date.now()}.csv`;

    const headers = [
      "Pitch name", "Source", "Option", "Market", "Target", "LOI", "IR%", "IR universe", "Quotas", "Nº of Waves",
      "Total fresh sample", "Total Sample Size (CALCULATED)", "Internal Max", "Max Internal %", "Vendor 1 Cap", "Vendor 1 CPI", "Vendor 2 Cap", "Vendor 2 CPI",
      "Vendor 3 Cap", "Vendor 3 CPI", "Vendor 4 Cap", "Vendor 4 CPI",
      "Feasibility Status", "Allocated Internal", "Allocated Vendor 1", "Allocated Vendor 2", "Allocated Vendor 3", "Allocated Vendor 4",
      "Total Allocated Sample", "Unfilled Sample", "Max Potential", "Overlap Penalty %", "Internal Share %", "External Share %", "Used Vendors",
      "Weighted CPI ($)", "Number of Vendors", "PM Fee ($)", "Comparability Status", "Total Cost ($)", "OP - Operational Profit (%)"
    ];

    const lines = [headers.join(',')];

    pitches.forEach((row) => {
      const alloc = allocations.find(a => a.rowId === row.id) || {
        status: 'Unfeasible',
        allocatedInternal: 0,
        allocatedVendor1: 0,
        allocatedVendor2: 0,
        allocatedVendor3: 0,
        allocatedVendor4: 0,
        totalAllocated: 0,
        unfilledSample: row.totalSampleSize,
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

      const rowSalesCpi = row.salesCpi !== undefined ? row.salesCpi : 7.5;
      const rowRevenue = alloc.totalAllocated * rowSalesCpi;
      const rowOpCosts = (alloc.externalCost || 0) + (alloc.internalCostRef || 0);
      const rowOpPct = rowRevenue > 0 ? ((rowRevenue - rowOpCosts) / rowRevenue) * 100 : 0;

      const lineValues = [
        `"${row.pitchName}"`,
        `"${row.source}"`,
        `"${row.option}"`,
        `"${row.market}"`,
        `"${row.target}"`,
        row.loi,
        `"${(row.irPercent * 100).toFixed(0)}%"`,
        `"${row.irUniverse}"`,
        `"${row.quotas}"`,
        row.waves,
        row.totalFreshSample,
        row.totalSampleSize,
        row.internal,
        row.maxInternalPercent !== undefined ? row.maxInternalPercent : 100,
        row.vendor1,
        row.vendor1Cpi,
        row.vendor2,
        row.vendor2Cpi,
        row.vendor3,
        row.vendor3Cpi,
        row.vendor4,
        row.vendor4Cpi,
        alloc.status,
        alloc.allocatedInternal,
        alloc.allocatedVendor1,
        alloc.allocatedVendor2,
        alloc.allocatedVendor3,
        alloc.allocatedVendor4,
        alloc.totalAllocated,
        alloc.unfilledSample,
        alloc.maxPotential,
        `${alloc.overlapPenaltyPct}%`,
        `${alloc.internalSharePct}%`,
        `${alloc.externalSharePct}%`,
        `"${alloc.activeVendorsCsv}"`,
        alloc.weightedCpi.toFixed(2),
        alloc.numVendorsUsed,
        alloc.pmFee,
        `"${alloc.comparability}"`,
        alloc.totalCost,
        `${rowOpPct.toFixed(1)}%`
      ];

      lines.push(lineValues.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Support CSV upload immediately on this page
  const handleInsertSpecsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          if (text) {
            const parsed = parseCSVToPitches(text);
            if (parsed.length > 0) {
              onUpdatePitches(parsed);
              if (onNewSpecsFileAttached) {
                onNewSpecsFileAttached();
              }
            }
          }
        } catch (err: any) {
          alert(`Error uploading file: ${err.message || err}`);
        }
      };
      reader.readAsText(e.target.files[0]);
    }
    e.target.value = '';
  };

  const startEditing = (rowId: string, field: keyof FeasibilityRow, val: any) => {
    const r = pitches.find(p => p.id === rowId);
    if (r && r.isLocked) {
      return; // Disable editing on locked rows
    }
    setEditingCell({ rowId, field });
    setTempEditValue(String(val));
  };

  const saveInlineEdit = () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;

    const updated = pitches.map((pitch) => {
      if (pitch.id === rowId) {
        let value: any = tempEditValue;
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
            'vendor1', 'vendor1Cpi', 'vendor1Pct',
            'vendor2', 'vendor2Cpi', 'vendor2Pct',
            'vendor3', 'vendor3Cpi', 'vendor3Pct',
            'vendor4', 'vendor4Cpi', 'vendor4Pct',
            'vendor5', 'vendor5Cpi', 'vendor5Pct',
            'vendor6', 'vendor6Cpi', 'vendor6Pct',
            'vendor7', 'vendor7Cpi', 'vendor7Pct',
            'vendor8', 'vendor8Cpi', 'vendor8Pct',
            'pmFee', 'salesCpi', 'targetedCpi'
          ].includes(String(field))
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

    onUpdatePitches(updated);
    setEditingCell(null);
  };

  const handleToggleLockRow = (rowId: string) => {
    const updated = pitches.map(p => {
      if (p.id === rowId) {
        const nextLocked = !p.isLocked;
        let lockedAlloc = undefined;
        if (nextLocked) {
          lockedAlloc = passedAllocations?.find(a => a.rowId === rowId);
        }
        return {
          ...p,
          isLocked: nextLocked,
          lockedAllocation: lockedAlloc
        };
      }
      return p;
    });
    onUpdatePitches(updated, true);
  };

  const handleDeleteRow = (id: string) => {
    const target = pitches.find(p => p.id === id);
    if (target && target.isLocked) {
      alert("This line is locked and cannot be deleted!");
      return;
    }
    const ok = window.confirm("Are you sure you want to delete this option specs line?");
    if (!ok) return;
    onUpdatePitches(pitches.filter(p => p.id !== id));
  };

  return (
    <div className="space-y-4" id="specs-calculations-root">

      {/* 1. Header Widget with quick specs import */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm" id="procurement-optimizer-main-header">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white" id="procurement-optimizer-header-row">
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            <div className="flex items-center gap-1.5 mr-1">
              <Calculator className="h-4 w-4 text-[#2b6cb0] shrink-0" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Procurement Cost & Profit Optimizer
              </h3>
            </div>

            <div className={`flex flex-wrap items-center gap-1.5 ${showOptimizer ? 'flex' : 'hidden lg:flex'}`}>
              {/* Assistant */}
              <button
                onClick={onToggleChat}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm cursor-pointer"
                id="reload-data-btn"
                title="Open movable, resizable Assistant"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#2b6cb0]" />
                Assistant
              </button>

              {/* Insert Specs */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleInsertSpecsCSV}
                accept=".csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm cursor-pointer"
                id="insert-specs-calc-tab-btn"
                title="Insert procurement Excel/CSV file"
              >
                <FileUp className="h-3.5 w-3.5 text-indigo-600" />
                Insert Specs
              </button>

              {/* Add Line */}
              <button
                onClick={handleAddLine}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm cursor-pointer"
                id="add-line-calc-tab-btn"
                title="Add a new blank specification line"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-600" />
                Add Line
              </button>
            </div>

            <button
              onClick={handleToggleOptimizer}
              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all duration-150 cursor-pointer lg:hidden ml-auto"
              id="toggle-optimizer-btn"
              title={showOptimizer ? "Hide Optimizer Controls" : "Unhide Optimizer Controls"}
            >
              {showOptimizer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          <div className={`flex-wrap items-center gap-2 lg:flex ${showOptimizer ? 'flex' : 'hidden lg:flex'}`}>
            {/* Start Checking Dropdown */}
            <div className="relative inline-block text-left" id="start-checking-actions">
              <button
                type="button"
                onClick={() => setIsCheckDropdownOpen(!isCheckDropdownOpen)}
                disabled={isChecking || pitches.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition shadow-sm cursor-pointer border ${
                  isChecking || pitches.length === 0
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700'
                }`}
                id="check-feasibility-dropdown-btn"
                title="Select feasibility evaluation style from the database"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                {isChecking ? 'Checking...' : 'Check Feasibility'}
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </button>

              {isCheckDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsCheckDropdownOpen(false)}
                  />
                  <div className="absolute left-0 mt-1.5 w-64 rounded-lg bg-white border border-slate-200 shadow-xl z-50 overflow-hidden py-1" id="check-feasibility-dropdown-menu">
                    {/* 1. Feasibility for Targets */}
                    <button
                      type="button"
                      onClick={() => {
                        onStartChecking();
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

            {/* Save Option */}
            <button
              onClick={handleSaveCurrentOption}
              disabled={pitches.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              id="save-specs-btn"
              title="Save specifications as a new option in top navigation bar list"
            >
              <FolderPlus className="h-3.5 w-3.5 text-indigo-600" />
              Save
            </button>

            <button
              onClick={handleToggleOptimizer}
              className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all duration-150 cursor-pointer hidden lg:block"
              id="toggle-optimizer-btn-desktop"
              title={showOptimizer ? "Hide Optimizer Controls" : "Unhide Optimizer Controls"}
            >
              {showOptimizer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {showOptimizer && (
          <div className="text-[11px] text-slate-500 mt-1.5 border-t border-slate-100 pt-1.5 animate-fade-in">
            Optimize, duplicate options, adjust metrics, and view operational margins.
          </div>
        )}
      </div>

      {/* 2. Collapsible High Density Quick Stats Dashboard Wrapper */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-3" id="collapsible-stats-dashboard-area">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-emerald-600 shrink-0" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Global Overview - Dashboard</h3>
          </div>
          <button
            onClick={handleToggleStats}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all duration-150 cursor-pointer"
            id="toggle-stats-btn"
            title={showStats ? "Hide Stats Details" : "Unhide Stats Details"}
          >
            {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {showStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" id="stats-summary-widgets">
            {/* Total Cost */}
            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100 flex flex-col justify-between">
              <div className="border-b border-slate-100 pb-1.5">
                <div className="text-slate-500 font-bold text-[9px] uppercase tracking-wider flex items-center justify-between">
                  <span>Total Cost (No Markup)</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-lg font-bold font-mono tracking-tight ${
                    targetedBudget > 0
                      ? (totalCost > targetedBudget ? 'text-rose-600' : 'text-emerald-600')
                      : 'text-slate-900'
                  }`}>
                    ${totalCost.toLocaleString()}
                  </span>
                  <span className="text-slate-400 text-[9px] font-bold">USD</span>
                </div>
              </div>

              <div className="pt-1.5 flex flex-col space-y-1">
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-600">
                  <span className="font-bold text-slate-450 uppercase tracking-wider text-[8px]">Target Price:</span>
                  <div className="relative flex items-center">
                    <span className="absolute left-1.5 text-slate-450 font-bold text-[9px]">$</span>
                    <input
                      type="text"
                      placeholder="budget"
                      value={targetedBudget > 0 ? targetedBudget : ''}
                      onChange={(e) => {
                        const parsed = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0;
                        if (setTargetedBudget) {
                          setTargetedBudget(parsed);
                        }
                      }}
                      className="w-14 pl-3 pr-1 py-0.5 text-[10px] font-mono font-bold border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] bg-white text-slate-800"
                    />
                  </div>
                </div>

                {targetedBudget > 0 && (
                  <div className="flex items-center justify-between text-[8px] mt-0.5 font-bold">
                    <span className={totalCost > targetedBudget ? 'text-rose-600' : 'text-emerald-600'}>
                      {totalCost > targetedBudget ? 'Over Budget' : 'Within Budget'}
                    </span>
                    <span className="text-slate-400 font-mono">
                      Diff: ${(targetedBudget - totalCost).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Total Feasible Filled percentage */}
            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100 flex flex-col justify-between">
              <div className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Feasibility Filling Rate</div>
              <div className="mt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono tracking-tight text-slate-900">{fillingRate.toFixed(1)}%</span>
                  <span className="text-slate-450 text-[9px]">filled</span>
                </div>
                {/* Custom nice visual progress tracking gauge */}
                <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-550 ${fillingRate >= 99 ? 'bg-emerald-500' : fillingRate >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(fillingRate, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="text-[8px] text-slate-500 mt-1">
                <span>{totalAllocatedSample.toLocaleString()} / {totalTargetSample.toLocaleString()} sample size</span>
              </div>
            </div>

            {/* Operational Profit margin */}
            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100 flex flex-col justify-between">
              <div className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">OP &amp; internalization</div>
              <div className="mt-1 space-y-1.5">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-slate-500 text-[9px] font-semibold">Overall OP %:</span>
                    <span className={`text-md font-bold font-mono tracking-tight ${overallOpPct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {overallOpPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between border-t border-slate-100 pt-1">
                  <span className="text-slate-500 text-[9px] font-semibold" title="Total Internal panel allocated / total needed sample across all countries">Internalization:</span>
                  <span className="text-md font-bold font-mono text-indigo-700">
                    {internalizationPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100 flex flex-col justify-between">
              <div className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Country Options Status</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex flex-col items-center flex-1 bg-emerald-50/70 py-0.5 rounded border border-emerald-100">
                  <span className="text-xs font-bold font-mono text-emerald-800">{fullyFeasibleCount}</span>
                  <span className="text-[7px] text-emerald-600 uppercase font-semibold">Full</span>
                </div>
                <div className="flex flex-col items-center flex-1 bg-amber-50/70 py-0.5 rounded border border-amber-100">
                  <span className="text-xs font-bold font-mono text-amber-800">{partiallyFeasibleCount}</span>
                  <span className="text-[7px] text-amber-600 uppercase font-semibold">Partial</span>
                </div>
                <div className="flex flex-col items-center flex-1 bg-rose-50/70 py-0.5 rounded border border-rose-100">
                  <span className="text-xs font-bold font-mono text-rose-800">{unfeasibleCount}</span>
                  <span className="text-[7px] text-rose-600 uppercase font-semibold">Unfilled</span>
                </div>
              </div>
              <div className="text-[8px] text-slate-500 mt-1 text-right">
                <span>{pitches.length} total options</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Strategy Selector & Allocation Configuration */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2" id="strategy-picker-box">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-1.5 bg-white">
          <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4">
            <div className="flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-[#2b6cb0] shrink-0" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Feasibility Strategy
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-650 font-semibold bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Cheapest First Model:</span>
                <span className="font-mono text-indigo-750 font-bold">${totalCostCostOpt.toLocaleString()}</span>
              </div>
              <span className="text-slate-300 hidden md:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Tier Vetting Model:</span>
                <span className="font-mono text-indigo-750 font-bold">${totalCostTierOpt.toLocaleString()}</span>
              </div>
              <span className="text-slate-300 hidden md:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium font-bold">No internal sample:</span>
                <span className="font-mono text-indigo-750 font-bold">${totalCostNoInternalOpt.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleStrategy}
            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all duration-150 cursor-pointer self-end md:self-auto"
            id="toggle-strategy-btn"
            title={showStrategy ? "Hide Strategy Details" : "Unhide Strategy Details"}
          >
            {showStrategy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {showStrategy && (
          <div className="space-y-2 pt-0.5 animate-fade-in text-[10px]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <div>
                <p className="text-[10px] text-slate-500 font-medium">
                  Select prioritization models to calculate optimal supplier sample size allocations.
                </p>
              </div>

              <div className="flex bg-slate-100 p-0.5 rounded-md self-start">
                <button
                  onClick={() => onChangeStrategy('cost')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition duration-150 cursor-pointer ${activeStrategy === 'cost' ? 'bg-[#2b6cb0] text-white shadow-sm' : 'text-slate-550 hover:text-slate-900'}`}
                >
                  Cost Optimized (Cheapest)
                </button>
                <button
                  onClick={() => onChangeStrategy('tier')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition duration-150 cursor-pointer ${activeStrategy === 'tier' ? 'bg-[#2b6cb0] text-white shadow-sm' : 'text-slate-550 hover:text-slate-900'}`}
                >
                  Tier Priority (Quality)
                </button>
                <button
                  onClick={() => onChangeStrategy('no-internal-cost')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition duration-150 cursor-pointer ${activeStrategy === 'no-internal-cost' ? 'bg-[#2b6cb0] text-white shadow-sm' : 'text-slate-550 hover:text-slate-900'}`}
                >
                  No internal sample
                </button>
              </div>
            </div>

            {/* Detailed strategy instructions - Small compact cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-1.5 bg-slate-50 rounded-lg text-[10px] leading-relaxed text-slate-500">
              <div className={`p-1.5 rounded-md border ${activeStrategy === 'cost' ? 'bg-white border-[#bee3f8] ring-1 ring-[#bee3f8]' : 'border-transparent'}`}>
                <span className="font-bold text-[#2b6cb0] block mb-0.5 uppercase tracking-wider text-[8px]">Cheapest First Model</span>
                Satisfies target using Internal Panel first, sorting external providers purely by CPI rate bids dynamically.
              </div>
              <div className={`p-1.5 rounded-md border ${activeStrategy === 'tier' ? 'bg-white border-[#bee3f8] ring-1 ring-[#bee3f8]' : 'border-transparent'}`}>
                <span className="font-bold text-[#2b6cb0] block mb-0.5 uppercase tracking-wider text-[8px]">Tier Vetting Model</span>
                Uses Internal, then exhausts strictly Vendor 1 (Tier 0), then Vendor 2 (Tier 1) sequentially.
              </div>
              <div className={`p-1.5 rounded-md border ${activeStrategy === 'no-internal-cost' ? 'bg-white border-[#bee3f8] ring-1 ring-[#bee3f8]' : 'border-transparent'}`}>
                <span className="font-bold text-[#2b6cb0] block mb-0.5 uppercase tracking-wider text-[8px]">No internal sample</span>
                Bypasses internal pool completely. Directs sample needs entirely to external panel providers.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Feasibility Allocation Output Grid Table (V to AE with additional columns) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="fe-results-grid-box">
        <div className="p-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Feasibility Overview</h3>
            <p className="text-[11px] text-slate-500">Shows comprehensive overlap calculations, weighted CPI averages, PM fee overrides, and Operational Profit (OP).</p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleDownloadStandardCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2b6cb0] bg-white border border-[#2b6cb0]/30 rounded-lg hover:bg-[#ebf8ff] cursor-pointer transition-all"
              id="download-csv-btn"
            >
              <FileDown className="h-3.5 w-3.5" />
              Download CSV
            </button>

            <button
              onClick={handleDownloadExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-600/30 rounded-lg hover:bg-emerald-50 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              id="download-xlsx-btn"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {exporting ? 'Exporting...' : 'Download Excel'}
            </button>

            <button
              onClick={handleToggleOverview}
              className="p-1 hover:bg-slate-150 text-slate-400 hover:text-slate-700 rounded-lg transition-all duration-150 cursor-pointer"
              id="toggle-overview-btn"
              title={showOverview ? "Hide Feasibility Overview" : "Unhide Feasibility Overview"}
            >
              {showOverview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {showOverview && (
          <div className="animate-fade-in pb-1">
            {/* Dynamic Warning or Success Notices */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border-b border-rose-100 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>Could not generate the Excel file: {errorMsg}</span>
              </div>
            )}

        {!hasChecked && pitches.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 p-3.5 text-xs text-amber-900 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-650 shrink-0 animate-bounce" />
              <span>
                <strong>Needs Feasibility Check</strong>: Loaded or edited specifications need verification. Click <strong>Check Feasibility</strong> to determine correct allocations.
              </span>
            </div>
            <button
              onClick={onStartChecking}
              disabled={isChecking}
              className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition shrink-0 shadow-sm cursor-pointer"
            >
              Check Feasibility
            </button>
          </div>
        )}
        {/* Output table layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold uppercase tracking-wider text-[10px]">
                <th className="p-2 col-static">Country</th>
                <th className="p-2 col-static text-right">Target Size</th>
                <th className="p-2 col-static text-center">LOI</th>
                <th className="p-2 col-static text-center">IR%</th>
                <th className="p-2 col-static text-center">IR Universe</th>
                <th className="p-2 col-static text-center">Quotas</th>
                <th className="p-2 col-static">Feasibility Status</th>
                <th className="p-2 col-output text-right text-[#2b6cb0]">feasible</th>
                <th className="p-2 col-output text-right text-rose-700">missing</th>

                {/* NEW REQUIRED COLUMNS */}
                <th className="p-2 col-output text-right text-[#205080]" title="Un-penalized Specs Potential Max limit">max feasible</th>
                <th className="p-2 col-output text-center text-slate-800" title="Internal % / Vendors %">Internal/Ext Share</th>
                <th className="p-2 col-output text-center text-slate-705 font-bold" title="Number of external vendors utilized">Nr of vendors</th>
                <th className="p-2 col-output text-right text-emerald-850 font-bold" title="Total external vendor spend divided by total external vendor sample">Weighted CPI</th>
                <th className="p-2 col-output text-right text-indigo-950 font-bold">Targeted CPI</th>
                <th className="p-2 col-output text-right text-[#2b6cb0]" title="Project Manager Fee. Double click to override flat fee.">PM Fee</th>
                <th className="p-2 col-output text-center">Comparability</th>
                <th className="p-2 col-output text-right text-[#2b6cb0] font-bold" title="External spend (excluding PM fee)">Total external costs (no markup)</th>
                <th className="p-2 col-output text-right text-emerald-800 font-bold" title="Operational Profit (OP) % = (Revenue - (External + Internal Cost)) / Revenue (excl. PM fees)">OP %</th>
                <th className="p-2 text-center bg-slate-50">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pitches.map((pitch) => {
                const alloc = allocations.find(a => a.rowId === pitch.id) || {
                  status: 'Unfeasible',
                  allocatedInternal: 0,
                  allocatedVendor1: 0,
                  allocatedVendor2: 0,
                  allocatedVendor3: 0,
                  allocatedVendor4: 0,
                  totalAllocated: 0,
                  unfilledSample: pitch.totalSampleSize,
                  externalCost: 0,
                  internalCostRef: 0,
                  totalCost: 0,
                  weightedCpi: 0,
                  overlapPenaltyPct: 0,
                  numPanelsUsed: 0,
                  numVendorsUsed: 0,
                  maxPotential: 0,
                  internalSharePct: 0,
                  externalSharePct: 0,
                  activeVendorsCsv: 'None',
                  operationalProfit: 0,
                  salesCpi: 7.50,
                  pmFee: 150,
                  comparability: 'High'
                } as any;

                const isEditingPmFee = editingCell?.rowId === pitch.id && editingCell?.field === 'pmFee';
                const isEditingSalesCpi = editingCell?.rowId === pitch.id && editingCell?.field === 'salesCpi';
                const isEditingComp = editingCell?.rowId === pitch.id && editingCell?.field === 'comparability';

                return (
                  <tr key={pitch.id} className="hover:bg-slate-50/55 transition text-[11px] group">
                    {/* Country edit */}
                    <td className="p-2 col-static text-slate-800 font-bold">
                      {editingCell?.rowId === pitch.id && editingCell?.field === 'market' ? (
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

                    {/* Target Size */}
                    <td className="p-2 text-right pr-3 font-mono font-bold text-slate-900 col-static">
                      {editingCell?.rowId === pitch.id && editingCell?.field === 'totalSampleSize' ? (
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

                    {/* LOI */}
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

                    {/* IR% */}
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

                    {/* IR Universe */}
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

                    {/* Quotas */}
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

                    <td className="p-2 col-static">
                      {alloc.status === 'Fully Feasible' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200 w-fit">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Secured
                          </span>
                          {alloc.overlapPenaltyPct > 0 && (
                            <span className="text-[9px] text-amber-700 font-bold">
                              -{alloc.overlapPenaltyPct}% Overlap
                            </span>
                          )}
                        </div>
                      ) : alloc.status === 'Oversample' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-800 bg-purple-100/80 px-1.5 py-0.5 rounded border border-purple-200 w-fit">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Oversample
                          </span>
                          {alloc.overlapPenaltyPct > 0 && (
                            <span className="text-[9px] text-amber-700 font-bold">
                              -{alloc.overlapPenaltyPct}% Overlap
                            </span>
                          )}
                        </div>
                      ) : alloc.status === 'Partially Feasible' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100/85 px-1.5 py-0.5 rounded border border-amber-200 w-fit">
                            <AlertCircle className="h-2.5 w-2.5" />
                            Deficit (-{alloc.unfilledSample})
                          </span>
                          {alloc.overlapPenaltyPct > 0 && (
                            <span className="text-[9px] text-amber-700 font-bold">
                              -{alloc.overlapPenaltyPct}% Overlap
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-800 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-200 w-fit">
                          <XCircle className="h-2.5 w-2.5" />
                          Unfilled
                        </span>
                      )}
                    </td>

                    {/* Removed redundant Target column since it is now right after Country */}

                    {/* Allocated totals and deficits */}
                    <td className={`p-2 text-right font-mono font-bold col-output ${
                      alloc.status === 'Oversample' ? 'text-purple-750' : 'text-[#2b6cb0]'
                    }`}>
                      {alloc.totalAllocated.toLocaleString()}
                    </td>

                    <td className={`p-2 text-right font-mono ${alloc.unfilledSample > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'} col-output`}>
                      {alloc.unfilledSample > 0 ? alloc.unfilledSample.toLocaleString() : '0'}
                    </td>

                    {/* NEW METRICS ON THE RIGHT */}
                    {/* 1. Max Specs Potential */}
                    <td className="p-2 text-right font-mono text-indigo-900 col-output font-medium">
                      {alloc.maxPotential.toLocaleString()}
                    </td>

                    {/* 2. Internal / External Share */}
                    <td className="p-2 text-center font-mono text-slate-700 col-output">
                      <span className="font-semibold text-indigo-700">{alloc.internalSharePct}%</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className="font-semibold text-emerald-700">{alloc.externalSharePct}%</span>
                    </td>

                    {/* 3. Used Vendors list (Nr of vendors) */}
                    <td className="p-2 text-center font-mono font-bold text-slate-750 col-output">
                      {alloc.numVendorsUsed}
                    </td>

                    {/* 4. Weighted CPI (replaces average CPI) */}
                    <td className="p-2 text-right font-mono col-output">
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

                    {/* Targeted CPI */}
                    <td className="p-2 text-right font-mono whitespace-nowrap col-output">
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
                           className="cursor-pointer border-b border-dashed border-slate-205 hover:border-[#2b6cb0] font-semibold text-slate-705"
                           title="Double click to edit Targeted CPI"
                        >
                          {pitch.targetedCpi !== undefined && pitch.targetedCpi > 0 ? `$${pitch.targetedCpi.toFixed(2)}` : '-'}
                        </span>
                      )}
                    </td>

                    {/* 6. PM Fee */}
                    <td className="p-2 text-right font-mono text-slate-800 col-output">
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
                           className="cursor-pointer border-b border-dashed border-slate-200 hover:border-[#2b6cb0] font-semibold"
                           title="Double-click to edit PM Fee"
                        >
                           ${pitch.pmFee !== undefined ? pitch.pmFee : 150}
                        </span>
                      )}
                    </td>

                    {/* 7. Comparability state */}
                    <td className="p-2 text-center col-output">
                      {isEditingComp ? (
                        <select
                          value={tempEditValue}
                          onChange={(e) => {
                            setTempEditValue(e.target.value);
                            const updated = pitches.map(p => p.id === pitch.id ? { ...p, comparability: e.target.value } : p);
                            onUpdatePitches(updated);
                            setEditingCell(null);
                          }}
                          onBlur={() => setEditingCell(null)}
                          autoFocus
                          className="px-1 border border-slate-350 rounded bg-white"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      ) : (
                        <span
                          onDoubleClick={() => startEditing(pitch.id, 'comparability', pitch.comparability || 'High')}
                          className={`cursor-pointer px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            (pitch.comparability || 'High') === 'High' ? 'bg-[#ebf8ff] text-[#2b6cb0] border border-[#bee3f8]' :
                            (pitch.comparability === 'Medium') ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-rose-50 text-rose-805 border border-rose-200'
                          }`}
                          title="Double-click to change Comparability"
                        >
                          {pitch.comparability || 'High'}
                        </span>
                      )}
                    </td>

                    {/* Total Cost Column */}
                    <td className="p-2 text-right font-mono text-slate-900 col-output font-semibold">
                      ${alloc.externalCost.toLocaleString()}
                    </td>

                    {/* 8. OP Operational Profit Margin as Percentage */}
                    {(() => {
                      const rowSalesCpi = pitch.salesCpi !== undefined ? pitch.salesCpi : 7.50;
                      const rowRevenue = alloc.totalAllocated * rowSalesCpi;
                      const rowOpCosts = (alloc.externalCost || 0) + (alloc.internalCostRef || 0);
                      const rowOpPct = rowRevenue > 0 ? ((rowRevenue - rowOpCosts) / rowRevenue) * 100 : 0;
                      return (
                        <td className="p-2 text-right font-mono font-bold col-output">
                          <span className={`px-2 py-1 rounded-md ${rowOpPct >= 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                            {rowOpPct.toFixed(1)}%
                          </span>
                        </td>
                      );
                    })()}

                    {/* Actions column with Duplicate Button */}
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleToggleLockRow(pitch.id)}
                          className={`p-1 rounded-md border transition shadow-sm cursor-pointer flex items-center justify-center ${
                            pitch.isLocked
                              ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                          }`}
                          title={pitch.isLocked ? "Row is LOCKED. Click to unlock" : "Row is UNLOCKED. Click to lock"}
                        >
                          {pitch.isLocked ? (
                            <Lock className="h-3 w-3" />
                          ) : (
                            <Unlock className="h-3 w-3" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDuplicateOption(pitch.id)}
                          className="flex items-center gap-1 px-1.5 py-1 text-[10px] bg-slate-50 hover:bg-[#ebf8ff] text-[#2b6cb0] hover:text-[#205080] border border-slate-200 hover:border-[#bee3f8] rounded cursor-pointer transition shadow-sm font-semibold"
                          title="Save and duplicate this scenario with the same parameters"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Duplicate</span>
                        </button>

                        <button
                          onClick={() => handleDeleteRow(pitch.id)}
                          className="p-1 hover:text-rose-600 text-slate-400 hover:bg-rose-50 rounded transition"
                          title="Delete scenario"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          </div>
        )}
      </div>



      {/* Save Choices Modal Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in" id="save-option-modal">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 space-y-4 animate-scale-up">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Save Specifications Option
            </h3>

            <div className="space-y-3 text-xs text-slate-700">
              {savedOptions.length > 0 && (
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSaveMode('create')}
                    className={`flex-1 py-1 text-center font-bold font-sans rounded-md transition ${saveMode === 'create' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Create New
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveMode('override')}
                    className={`flex-1 py-1 text-center font-bold font-sans rounded-md transition ${saveMode === 'override' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    Override Existing
                  </button>
                </div>
              )}

              {saveMode === 'create' ? (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-[10px] text-slate-400 block font-bold uppercase">Option Name</label>
                  <input
                    type="text"
                    value={newSaveName}
                    onChange={(e) => setNewSaveName(e.target.value)}
                    placeholder="E.g., Scenario Option 2"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 italic">This will save a separate option with the current specs.</p>
                </div>
              ) : (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-[10px] text-slate-400 block font-bold uppercase">Select Option to Override</label>
                  <select
                    value={selectedOverrideId}
                    onChange={(e) => setSelectedOverrideId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:outline-none text-slate-800 font-sans font-medium"
                  >
                    {savedOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} ({opt.timestamp})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-rose-500 font-medium">Warning: Overriding will replace that chosen option's entries with the current specifications.</p>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 justify-end text-xs font-bold pt-1.5">
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSaveChoice}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer transition shadow-sm"
              >
                Confirm Save
              </button>
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
