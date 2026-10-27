import React, { useState, useRef, useMemo } from 'react';
import { FeasibilityRow, AllocationResult, StrategyType, VendorTier } from '../types';
import { calculateAllRows } from '../lib/calculator';
import { safeStorage } from '../lib/storage';
import { api, SavedOption } from '../lib/api';
import { ALL_COUNTRIES, isValidCountry, getCanonicalCountryName } from '../data/countries';
import ComboboxCell from './ComboboxCell';
import {
  GLOBAL_ALL_LOIS,
  GLOBAL_ALL_IRS,
  GLOBAL_ALL_UNIVERSES,
  GLOBAL_ALL_QUOTAS,
  ALL_DB_COUNTRIES,
  getDbCountries,
  getCountryPreExistingSpecs,
  getCountrySpecsByUniverse
} from '../data/attachedSpecsData';
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
  RotateCcw,
  Trash2,
  Sparkles,
  Sliders,
  HelpCircle,
  Database,
  X
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
  insertedDatabase?: any;
  feasibilityFontSizeDelta?: number;
  onResetQuote?: () => void;
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
  onToggleLiveFeasibility,
  insertedDatabase,
  feasibilityFontSizeDelta = 0,
  onResetQuote
}: SpecsCalculatorProps) {
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCheckDropdownOpen, setIsCheckDropdownOpen] = useState(false);
  const setToastNotification = (_val: any) => {};
  const [localBudgetInput, setLocalBudgetInput] = useState<string>(() => (targetedBudget && targetedBudget > 0 ? String(targetedBudget) : ''));

  React.useEffect(() => {
    setLocalBudgetInput(targetedBudget && targetedBudget > 0 ? String(targetedBudget) : '');
  }, [targetedBudget]);

  const handleCommitBudget = () => {
    const raw = localBudgetInput.trim();
    if (raw === '' || raw === '0') {
      if (setTargetedBudget) setTargetedBudget(0);
    } else {
      const parsed = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
      if (setTargetedBudget) setTargetedBudget(parsed);
    }
  };

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

  const activeDbCountries = useMemo(() => {
    return getDbCountries(insertedDatabase);
  }, [insertedDatabase]);

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
  const allocations = useMemo(() => passedAllocations || calculateAllRows(pitches, activeStrategy, vendors), [passedAllocations, pitches, activeStrategy, vendors]);

  // 2. Perform alternative strategies for comparative dashboards
  const costAllocations = useMemo(() => calculateAllRows(pitches, 'cost', vendors), [pitches, vendors]);
  const tierAllocations = useMemo(() => calculateAllRows(pitches, 'tier', vendors), [pitches, vendors]);
  const noInternalAllocations = useMemo(() => calculateAllRows(pitches, 'no-internal-cost', vendors), [pitches, vendors]);

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

    onUpdatePitches([...pitches, duplicateRow], true);
    setToastNotification({
      message: `Duplicated audience line "${original.option}" to bottom.`,
      type: 'success'
    });
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

    onUpdatePitches([...pitches, newRow], true);
    setToastNotification({
      message: `Added new audience line #${pitches.length + 1} to bottom.`,
      type: 'success'
    });
  };

  // 1. Clear current specs
  const handleClearSpecs = () => {
    if (pitches.length === 0) {
      setToastNotification({
        message: 'Specification list is already empty.',
        type: 'info'
      });
      return;
    }
    onUpdatePitches([]);
    setHasChecked(false);
    setToastNotification({
      message: 'Cleared all specifications.',
      type: 'info'
    });
  };

  // 4. Trigger Save dialog with choice options
  const handleSaveCurrentOption = () => {
    if (pitches.length === 0) {
      setToastNotification({
        message: "There are no specifications currently loaded to be saved.",
        type: 'info'
      });
      return;
    }

    const defaultName = `Scenario Option ${savedOptions.length + 1}`;
    setNewSaveName(defaultName);
    // Pick up options saved by colleagues since this page was loaded
    api.listSavedOptions().then(setSavedOptions).catch((err) => console.warn('Could not refresh saved options:', err));
    setSaveMode('create');
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

      const target = savedOptions.find(o => o.name.toLowerCase() === finalName.toLowerCase());
      if (target) {
        const overwritten = { ...target, timestamp: nowStamp(), data: JSON.parse(JSON.stringify(pitches)) };
        await api.updateSavedOption(overwritten);
        setSavedOptions(savedOptions.map(opt => opt.id === target.id ? overwritten : opt));
        setShowSaveDialog(false);
        setToastNotification({
          message: `Option "${finalName}" successfully overwritten!`,
          type: 'success'
        });
        return;
      }

      const newSaved = {
        id: `saved-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: finalName,
        timestamp: nowStamp(),
        data: JSON.parse(JSON.stringify(pitches))
      };
      await api.createSavedOption(newSaved);
      setSavedOptions([...savedOptions, newSaved]);
      setToastNotification({
        message: `Option "${finalName}" saved successfully!`,
        type: 'success'
      });
    } else {
      if (!selectedOverrideId) {
        setToastNotification({
          message: "Please select a saved option target to override.",
          type: 'error'
        });
        return;
      }
      const targetOpt = savedOptions.find(o => o.id === selectedOverrideId);
      const name = targetOpt ? targetOpt.name : 'Overridden Option';
      if (targetOpt) {
        const overridden = { ...targetOpt, timestamp: nowStamp(), data: JSON.parse(JSON.stringify(pitches)) };
        await api.updateSavedOption(overridden);
        setSavedOptions(savedOptions.map(opt => opt.id === selectedOverrideId ? overridden : opt));
      }
      setToastNotification({
        message: `Option "${name}" overridden successfully!`,
        type: 'success'
      });
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
          setToastNotification({
            message: `Error uploading file: ${err.message || err}`,
            type: 'error'
          });
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
    onUpdatePitches(updated);
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
      setToastNotification({
        message: `Audience row "${target.option}" is locked. Click the lock icon to unlock it first.`,
        type: 'info'
      });
      return;
    }
    const remaining = pitches.filter(p => p.id !== id);
    onUpdatePitches(remaining, true);
    setToastNotification({
      message: `Audience line deleted (${remaining.length} remaining).`,
      type: 'info'
    });
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

              {/* Add Audience */}
              <button
                onClick={handleAddLine}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm cursor-pointer"
                id="add-line-calc-tab-btn"
                title="Add a new audience specification line at the bottom of the table"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-600" />
                Add Audience
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

            {/* Reset Quote */}
            {onResetQuote && (
              <button
                type="button"
                onClick={onResetQuote}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition shadow-sm cursor-pointer"
                id="reset-quote-calc-btn"
                title="Reset Quote: clear all audiences, set budget to 0, and clear all lines"
              >
                <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
                Reset Quote
              </button>
            )}

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
                      value={localBudgetInput}
                      onChange={(e) => setLocalBudgetInput(e.target.value)}
                      onBlur={handleCommitBudget}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCommitBudget();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-16 pl-3 pr-1 py-0.5 text-[10px] font-mono font-bold border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[#2b6cb0] bg-white text-slate-800"
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
        {/* Output table layout with overflow-x-auto padding to prevent dropdown clipping */}
        <div className="overflow-x-auto pb-44 min-h-[360px]">
          <table
            className="w-full text-left border-collapse text-xs dynamic-feasibility-grid"
            style={{ '--grid-font-size': `${12 + (feasibilityFontSizeDelta || 0) * 1.5}px` } as React.CSSProperties}
          >
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
                <th className="p-2 col-output text-right text-rose-600 font-bold" title="Missing sample as a percentage of target size">missing %</th>

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
              {pitches.length === 0 ? (
                <tr>
                  <td colSpan={25} className="p-8 text-center text-slate-500 bg-slate-50/20">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <Database className="h-8 w-8 text-slate-400" />
                      <span className="font-bold text-slate-700 text-sm">No specifications loaded in quote</span>
                      <span className="text-xs text-slate-500">
                        Go to <strong>Manage Scenario Specifications</strong> to add lines manually, upload an Excel file, or use the <strong>Chat Assistant</strong> to add specs.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pitches.map((pitch) => {
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

                const pitchSpecs = getCountrySpecsByUniverse(pitch.market, pitch.irUniverse, insertedDatabase);

                // Informative helper indicating why a row has deficit / 0 allocation / unfilled status
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
                  <tr key={pitch.id} className="hover:bg-slate-50/55 transition text-[11px] group">
                    {/* Country edit with Autocomplete combobox */}
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
                          onClick={() => startEditing(pitch.id, 'totalSampleSize', pitch.totalSampleSize)}
                          onDoubleClick={() => startEditing(pitch.id, 'totalSampleSize', pitch.totalSampleSize)}
                          className="cursor-pointer border-b border-dashed border-slate-200 hover:border-slate-800"
                        >
                          {pitch.totalSampleSize.toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* LOI (Editable combobox with 1..100 range, green DB ones, grey others) */}
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

                    {/* IR% (Editable combobox with 1%..100% range, green DB ones, grey others) */}
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

                    {/* IR Universe (Editable combobox with country variables) */}
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

                    {/* Quotas (Editable combobox with available quotas & No quotas) */}
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

                    <td className="p-2 col-static">
                      {alloc.status === 'Fully Feasible' ? (
                        <div className="flex flex-col gap-0.5">
                          <InstantTooltip text={alloc.overlapPenaltyPct > 0 ? `Fully feasible (100% covered) with -${alloc.overlapPenaltyPct}% overlap deduplication applied` : 'Fully feasible (100% covered)'}>
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200 w-fit cursor-help">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                              Secured
                            </span>
                          </InstantTooltip>
                          {alloc.overlapPenaltyPct > 0 && (
                            <InstantTooltip text={`Applied -${alloc.overlapPenaltyPct}% cross-panel deduplication friction across ${alloc.numVendorsUsed} active vendors.`}>
                              <span className="text-[9px] text-amber-700 font-bold cursor-help">
                                -{alloc.overlapPenaltyPct}% Overlap
                              </span>
                            </InstantTooltip>
                          )}
                        </div>
                      ) : alloc.status === 'Oversample' ? (
                        <div className="flex flex-col gap-0.5">
                          <InstantTooltip text="Oversample available in database exceeding 100% target requirement">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-800 bg-purple-100/80 px-1.5 py-0.5 rounded border border-purple-200 w-fit cursor-help">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Oversample
                            </span>
                          </InstantTooltip>
                          {alloc.overlapPenaltyPct > 0 && (
                            <InstantTooltip text={`Applied -${alloc.overlapPenaltyPct}% cross-panel deduplication friction across ${alloc.numVendorsUsed} active vendors.`}>
                              <span className="text-[9px] text-amber-700 font-bold cursor-help">
                                -{alloc.overlapPenaltyPct}% Overlap
                              </span>
                            </InstantTooltip>
                          )}
                        </div>
                      ) : alloc.status === 'Partially Feasible' ? (
                        <div className="flex flex-col gap-0.5">
                          <InstantTooltip text={`Deficit (-${alloc.unfilledSample.toLocaleString()} sample): ${unfeasibleReason}`}>
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100/85 px-1.5 py-0.5 rounded border border-amber-200 w-fit cursor-help shadow-2xs"
                              title={`Deficit (-${alloc.unfilledSample}): ${unfeasibleReason}`}
                            >
                              <AlertCircle className="h-2.5 w-2.5" />
                              Deficit (-{alloc.unfilledSample.toLocaleString()})
                              <HelpCircle className="h-2 w-2 opacity-60 ml-0.5" />
                            </span>
                          </InstantTooltip>
                          {alloc.overlapPenaltyPct > 0 && (
                            <InstantTooltip text={`Applied -${alloc.overlapPenaltyPct}% cross-panel deduplication friction across ${alloc.numVendorsUsed} active vendors.`}>
                              <span className="text-[9px] text-amber-700 font-bold cursor-help">
                                -{alloc.overlapPenaltyPct}% Overlap
                              </span>
                            </InstantTooltip>
                          )}
                        </div>
                      ) : (
                        <InstantTooltip text={`Unfilled (0 feasible): ${unfeasibleReason}`}>
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-800 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-200 w-fit cursor-help shadow-2xs"
                            title={unfeasibleReason}
                          >
                            <XCircle className="h-2.5 w-2.5" />
                            Unfilled
                            <HelpCircle className="h-2.5 w-2.5 opacity-70 ml-0.5 text-rose-700" />
                          </span>
                        </InstantTooltip>
                      )}
                    </td>

                    {/* Allocated totals and deficits */}
                    <td
                      className={`p-2 text-right font-mono font-bold col-output ${
                        alloc.status === 'Oversample' ? 'text-purple-750' : 'text-[#2b6cb0]'
                      } ${alloc.totalAllocated === 0 ? 'cursor-help' : ''}`}
                    >
                      {alloc.totalAllocated === 0 ? (
                        <InstantTooltip text={`0 feasible: ${unfeasibleReason}`}>
                          <span className="inline-flex items-center gap-1 justify-end text-rose-500 font-bold cursor-help" title={unfeasibleReason}>
                            0
                            <HelpCircle className="h-2.5 w-2.5 opacity-60 text-rose-400" />
                          </span>
                        </InstantTooltip>
                      ) : (
                        alloc.totalAllocated.toLocaleString()
                      )}
                    </td>

                    <td
                      className={`p-2 text-right font-mono ${alloc.unfilledSample > 0 ? 'text-rose-600 font-bold cursor-help' : 'text-slate-400'} col-output`}
                    >
                      {alloc.unfilledSample > 0 ? (
                        <InstantTooltip text={`Deficit (-${alloc.unfilledSample.toLocaleString()} sample): ${unfeasibleReason}`}>
                          <span className="inline-flex items-center gap-1 justify-end cursor-help" title={unfeasibleReason}>
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
                      className={`p-2 text-right font-mono ${alloc.unfilledSample > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'} col-output`}
                      title={alloc.unfilledSample > 0 ? `${pitch.totalSampleSize > 0 ? Math.round((alloc.unfilledSample / pitch.totalSampleSize) * 100) : 0}% deficit` : '0% missing'}
                    >
                      {pitch.totalSampleSize > 0 ? `${Math.round((alloc.unfilledSample / pitch.totalSampleSize) * 100)}%` : '0%'}
                    </td>

                    {/* NEW METRICS ON THE RIGHT */}
                    {/* 1. Max Specs Potential */}
                    <td className="p-2 text-right font-mono text-indigo-900 col-output font-medium">
                      {alloc.maxPotential.toLocaleString()}
                    </td>

                    {/* 2. Internal / External Share */}
                    <td
                      className="p-2 text-center font-mono text-slate-700 col-output cursor-pointer hover:bg-amber-50"
                      onClick={() => {
                        if (editingCell?.rowId === pitch.id && editingCell?.field === 'internalPctOverride') return;
                        const defaultVal = pitch.internalPctOverride !== undefined ? pitch.internalPctOverride : (alloc.internalSharePct || 0);
                        startEditing(pitch.id, 'internalPctOverride', defaultVal);
                      }}
                      onDoubleClick={() => {
                        const defaultVal = pitch.internalPctOverride !== undefined ? pitch.internalPctOverride : (alloc.internalSharePct || 0);
                        startEditing(pitch.id, 'internalPctOverride', defaultVal);
                      }}
                      title="Click or double click to set custom % internal share override (0-100%). Clear or 'auto' to reset."
                    >
                      {editingCell?.rowId === pitch.id && editingCell?.field === 'internalPctOverride' ? (
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={tempEditValue}
                            onChange={(e) => setTempEditValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={saveInlineEdit}
                            onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                            autoFocus
                            placeholder="auto"
                            className="w-12 text-center border border-[#2b6cb0] rounded bg-white text-slate-900 font-bold text-xs py-0.5"
                          />
                          <span className="text-xs text-slate-500 font-bold">%</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center">
                          <span className={`font-semibold text-indigo-700 border-b border-dashed border-slate-300 hover:border-indigo-600 ${pitch.internalPctOverride !== undefined ? 'bg-indigo-50 px-1 rounded text-indigo-900 font-bold' : ''}`}>
                            {alloc.internalSharePct}%{pitch.internalPctOverride !== undefined ? ' *' : ''}
                          </span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="font-semibold text-emerald-700">{alloc.externalSharePct}%</span>
                        </div>
                      )}
                    </td>

                    {/* 3. Used Vendors list (Nr of vendors) */}
                    <td className="p-2 text-center font-mono font-bold text-slate-750 col-output">
                      {alloc.numVendorsUsed}
                    </td>

                    {/* 4. Weighted CPI (with LOI assumption note if markup applied) */}
                    <td className="p-2 text-right font-mono col-output">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 justify-end">
                          {alloc.hasLoiMarkup && (
                            <InstantTooltip text={alloc.loiMarkupNote || 'Requested LOI is higher than database reference (<= 5m diff). Applied a +10% LOI friction mark-up on Weighted CPI.'}>
                              <span
                                className="text-[8px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-sans font-bold cursor-help"
                                title={alloc.loiMarkupNote}
                              >
                                +10% LOI
                              </span>
                            </InstantTooltip>
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
                          <InstantTooltip text={alloc.loiMarkupNote || 'Requested LOI is higher than database reference (<= 5m diff). Applied a +10% LOI friction mark-up on Weighted CPI.'}>
                            <span
                              className="text-[8px] text-amber-600 italic font-medium cursor-help"
                              title={alloc.loiMarkupNote}
                            >
                              * LOI assumption (+10%)
                            </span>
                          </InstantTooltip>
                        )}
                      </div>
                    </td>

                    {/* Targeted CPI */}
                    <td
                      className="p-2 text-right font-mono whitespace-nowrap col-output cursor-pointer hover:bg-amber-50"
                      onClick={() => {
                        if (editingCell?.rowId === pitch.id && editingCell?.field === 'targetedCpi') return;
                        startEditing(pitch.id, 'targetedCpi', pitch.targetedCpi !== undefined && pitch.targetedCpi > 0 ? pitch.targetedCpi : '');
                      }}
                      onDoubleClick={() => startEditing(pitch.id, 'targetedCpi', pitch.targetedCpi !== undefined && pitch.targetedCpi > 0 ? pitch.targetedCpi : '')}
                      title={alloc.hasLoiMarkup ? alloc.loiMarkupNote : (pitch.targetedCpi ? `Targeted CPI: ${pitch.targetedCpi.toFixed(2)}` : 'Click or double click to edit Targeted CPI')}
                    >
                      {editingCell?.rowId === pitch.id && editingCell?.field === 'targetedCpi' ? (
                        <input
                           type="text"
                           value={tempEditValue}
                           onChange={(e) => setTempEditValue(e.target.value)}
                           onClick={(e) => e.stopPropagation()}
                           onBlur={saveInlineEdit}
                           onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                           autoFocus
                           className="w-16 px-1 text-right border border-[#2b6cb0] rounded bg-white text-slate-900 font-bold"
                        />
                      ) : (
                        <span
                           className="cursor-pointer border-b border-dashed border-slate-205 hover:border-[#2b6cb0] font-semibold text-slate-705"
                        >
                          {pitch.targetedCpi !== undefined && pitch.targetedCpi > 0 ? `${pitch.targetedCpi.toFixed(2)}` : '-'}
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

                    {/* Actions column with Duplicate / Copy and Delete buttons */}
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLockRow(pitch.id);
                          }}
                          className={`p-1 rounded-md border transition shadow-xs cursor-pointer flex items-center justify-center ${
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
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateOption(pitch.id);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-[#2b6cb0] hover:text-[#205080] border border-blue-200 hover:border-blue-300 rounded cursor-pointer transition shadow-xs font-semibold"
                          title="Copy and duplicate this audience line to the bottom"
                        >
                          <Copy className="h-3 w-3 shrink-0" />
                          <span>Copy</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRow(pitch.id);
                          }}
                          className="p-1 hover:text-rose-600 text-slate-400 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Delete audience line"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
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
