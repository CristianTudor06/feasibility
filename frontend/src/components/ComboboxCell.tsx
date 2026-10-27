import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Sparkles, RotateCcw } from 'lucide-react';
import { getCanonicalCountryName, COUNTRY_ALIASES } from '../data/countries';

export interface ComboboxCellProps {
  value: string | number;
  onSave: (val: string) => void;
  options: (string | number)[];
  preExistingOptions: (string | number)[];
  specType: 'loi' | 'ir' | 'universe' | 'quota' | 'country';
  displayValue?: React.ReactNode;
  widthClass?: string;
  isEditing?: boolean;
  onStartEditing?: () => void;
  onStopEditing?: () => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  placeholder?: string;
  dropdownDirection?: 'down' | 'up' | 'auto';
  dropdownAlign?: 'left' | 'right' | 'auto';
}

export default function ComboboxCell({
  value,
  onSave,
  options,
  preExistingOptions,
  specType,
  displayValue,
  widthClass = 'w-28',
  isEditing: controlledIsEditing,
  onStartEditing,
  onStopEditing,
  align = 'center',
  className = '',
  placeholder,
  dropdownDirection = 'auto',
  dropdownAlign = 'auto'
}: ComboboxCellProps) {
  const [internalEditing, setInternalEditing] = useState(false);
  const isEditing = controlledIsEditing !== undefined ? controlledIsEditing : internalEditing;

  const defaultPlaceholder = placeholder || (
    specType === 'loi' ? 'Insert LOI' :
    specType === 'ir' ? 'Insert incidence' :
    specType === 'universe' ? 'Insert universe' :
    specType === 'quota' ? 'Insert quotas' :
    'Insert country'
  );

  const [inputValue, setInputValue] = useState<string>(
    value !== undefined && value !== null && value !== 0 && value !== '' && !String(value).startsWith('Insert')
      ? String(value)
      : ''
  );
  // Tracks if the user has actively typed/edited the text in this session
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [alignRight, setAlignRight] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);


  // Sync initial string
  useEffect(() => {
    if (value !== undefined && value !== null && value !== 0 && value !== '' && !String(value).startsWith('Insert')) {
      setInputValue(String(value));
    } else {
      setInputValue('');
    }
  }, [value]);

  // When editing starts, calculate available screen space to prevent clipping, focus input and reset typed state
  useEffect(() => {
    if (isEditing) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        // If row is near bottom and more space above, open upwards only if there is sufficient space above to not clip the top
        if (dropdownDirection === 'down') {
          setOpenUpwards(false);
        } else if (dropdownDirection === 'up') {
          setOpenUpwards(true);
        } else {
          // Default to opening downwards so the user sees the dropdown first from the top.
          // Only open upwards if space below is strictly constrained (< 140px) AND space above is at least 340px
          setOpenUpwards(spaceBelow < 140 && spaceAbove >= 340);
        }

        // If near right window edge, align to right
        if (dropdownAlign === 'right') {
          setAlignRight(true);
        } else if (dropdownAlign === 'left') {
          setAlignRight(false);
        } else {
          setAlignRight(window.innerWidth - rect.left < 280);
        }
      }

      const initialText = value !== undefined && value !== null && value !== 0 && value !== '' && !String(value).startsWith('Insert')
        ? String(value)
        : '';
      setInputValue(initialText);
      setHasUserTyped(false);
      setHighlightedIndex(0);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
        // Always reset scroll to the top so user sees the dropdown first from the top
        if (dropdownRef.current) {
          dropdownRef.current.scrollTop = 0;
        }
      }, 30);
    }
  }, [isEditing, value]);

  // Close on outside click
  useEffect(() => {
    if (!isEditing) return;

    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleCommit(inputValue);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isEditing, inputValue]);

  const handleStart = () => {
    setHasUserTyped(false);
    if (onStartEditing) {
      onStartEditing();
    } else {
      setInternalEditing(true);
    }
  };

  const handleCommit = (valToCommit: string) => {
    let clean = valToCommit.trim();
    // Normalize aliases for country
    if (specType === 'country' && clean) {
      clean = getCanonicalCountryName(clean) || clean;
    }
    onSave(clean);
    if (onStopEditing) {
      onStopEditing();
    } else {
      setInternalEditing(false);
    }
  };

  // Pre-existing set for fast checking (case/number insensitive)
  const preExistingSet = new Set(
    preExistingOptions.map(opt => String(opt).toLowerCase().replace(/%/g, '').trim())
  );

  const isPreExisting = (opt: string | number) => {
    const cleaned = String(opt).toLowerCase().replace(/%/g, '').trim();
    if (!cleaned || cleaned.startsWith('insert') || cleaned === 'noquotas') return false;
    return preExistingSet.has(cleaned);
  };

  // Build unique options list
  // For LOI: numeric order 1..100
  // For IR: numeric order 1%..100%
  // For Country / Universe / Quota: preserve list
  let baseOptions: (string | number)[] = Array.from(
    new Set([...preExistingOptions, ...options])
  ).filter(opt => {
    const s = String(opt).toLowerCase().trim();
    return s && !s.startsWith('insert');
  });

  if (specType === 'loi') {
    baseOptions.sort((a, b) => Number(a) - Number(b));
  } else if (specType === 'ir') {
    baseOptions.sort((a, b) => {
      const numA = parseFloat(String(a).replace(/[^0-9.-]/g, ''));
      const numB = parseFloat(String(b).replace(/[^0-9.-]/g, ''));
      return numA - numB;
    });
  } else if (specType === 'country') {
    baseOptions.sort((a, b) => {
      const aPre = isPreExisting(a);
      const bPre = isPreExisting(b);
      if (aPre && !bPre) return -1;
      if (!aPre && bPre) return 1;
      return String(a).localeCompare(String(b));
    });
  } else if (specType === 'quota') {
    baseOptions.sort((a, b) => {
      const aNoQ = String(a).toLowerCase().includes('no');
      const bNoQ = String(b).toLowerCase().includes('no');
      if (aNoQ && !bNoQ) return -1;
      if (!aNoQ && bNoQ) return 1;
      return String(a).localeCompare(String(b));
    });
  } else {
    baseOptions.sort((a, b) => String(a).localeCompare(String(b)));
  }

  // Prepend placeholder option at the very top so user can easily clear/see all variables
  const allAvailableOptions: (string | number)[] = [defaultPlaceholder, ...baseOptions];

  // Filtering based on input typing
  const sIn = inputValue.toLowerCase().trim();
  const shouldFilter = hasUserTyped && sIn.length > 0;

  const filteredOptions = shouldFilter
    ? allAvailableOptions.filter(opt => {
        const sOpt = String(opt).toLowerCase();
        if (sOpt === defaultPlaceholder.toLowerCase()) {
          return defaultPlaceholder.toLowerCase().includes(sIn);
        }
        if (sOpt.includes(sIn)) return true;
        // For country, also check aliases (e.g. typing "uae" matches "United Arab Emirates")
        if (specType === 'country') {
          for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
            if (alias.includes(sIn) && canonical.toLowerCase() === sOpt) {
              return true;
            }
          }
        }
        return false;
      })
    : allAvailableOptions;

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredOptions.length ? prev + 1 : prev));
      if (dropdownRef.current) {
        const items = dropdownRef.current.querySelectorAll('[data-item-index]');
        const target = items[highlightedIndex + 1] as HTMLElement;
        if (target) target.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
      if (dropdownRef.current) {
        const items = dropdownRef.current.querySelectorAll('[data-item-index]');
        const target = items[highlightedIndex - 1] as HTMLElement;
        if (target) target.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleCommit(String(filteredOptions[highlightedIndex]));
      } else {
        handleCommit(inputValue);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (onStopEditing) {
        onStopEditing();
      } else {
        setInternalEditing(false);
      }
    }
  };

  const isValueEmpty = value === undefined || value === null || value === '' || value === 0 || String(value).startsWith('Insert');
  const currentIsPreExisting = !isValueEmpty && isPreExisting(value);

  if (!isEditing) {
    return (
      <div
        onClick={handleStart}
        onDoubleClick={handleStart}
        className={`group cursor-pointer inline-flex items-center gap-1 py-0.5 px-1 rounded transition-colors hover:bg-slate-100 ${className}`}
        title="Click to edit or choose from dropdown"
      >
        {isValueEmpty ? (
          <span className="border-b border-dashed border-slate-300 text-slate-400 italic font-normal text-[10.5px]">
            {defaultPlaceholder}
          </span>
        ) : (
          <span className={`border-b border-dashed ${currentIsPreExisting ? 'border-emerald-400 text-emerald-950 font-bold' : 'border-slate-300 hover:border-slate-800 text-slate-800'}`}>
            {displayValue !== undefined ? displayValue : String(value)}
          </span>
        )}
        <ChevronDown className="w-2.5 h-2.5 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    );
  }

  const dropdownWidthClass = specType === 'universe' 
    ? 'min-w-[280px] max-w-[460px] max-h-72' 
    : specType === 'country'
    ? 'min-w-[240px] max-w-[360px] max-h-68'
    : specType === 'quota'
    ? 'min-w-[240px] max-w-[380px] max-h-64'
    : 'min-w-[190px] max-w-[280px] max-h-64';

  const inDbOptions = baseOptions.filter(opt => isPreExisting(opt));

  return (
    <div ref={containerRef} className={`relative text-left z-50 ${widthClass.includes('w-full') ? 'w-full block' : 'inline-block'}`}>
      <div className="flex items-center relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setHasUserTyped(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={defaultPlaceholder}
          className={`px-1.5 py-1 text-xs border-2 border-[#2b6cb0] rounded-md bg-white text-slate-900 font-semibold focus:outline-none shadow-md ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${widthClass} ${hasUserTyped && inputValue ? 'pr-5' : ''}`}
        />
        {hasUserTyped && inputValue && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setInputValue('');
              setHasUserTyped(false);
              setHighlightedIndex(0);
              inputRef.current?.focus();
            }}
            className="absolute right-1 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            title="Clear search to view all options"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dropdown popover with smart positioning preventing overflow clipping */}
      <div
        ref={dropdownRef}
        className={`absolute ${alignRight ? 'right-0' : 'left-0'} ${
          openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        } overflow-y-auto bg-white rounded-lg shadow-2xl border border-slate-200 z-[999] text-xs py-1 ${dropdownWidthClass}`}
      >
        {/* Sticky top container with info, DB count and quick milestone pickers */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 border-b border-slate-100 shadow-xs">
          <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
            <span>{hasUserTyped ? 'Matching options' : 'Pick or write to search'}</span>
            <span className="flex items-center gap-1 text-emerald-700 normal-case font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              In database ({inDbOptions.length})
            </span>
          </div>

          {/* Quick database pills for fast picking if LOI or IR */}
          {(specType === 'loi' || specType === 'ir') && inDbOptions.length > 0 && !hasUserTyped && (
            <div className="px-2 py-1.5 bg-emerald-50/80 border-t border-emerald-100">
              <div className="text-[9px] font-bold text-emerald-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                In Database ({inDbOptions.length}):
              </div>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {inDbOptions.map((dbOpt) => (
                  <button
                    key={`quick-${dbOpt}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCommit(String(dbOpt));
                    }}
                    className="px-1.5 py-0.5 rounded bg-emerald-200/90 hover:bg-emerald-300 text-emerald-950 font-bold text-[10px] border border-emerald-300 cursor-pointer transition-colors shadow-2xs"
                  >
                    {specType === 'loi' ? `${dbOpt}m` : String(dbOpt)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Custom typed option if not exact match */}
        {hasUserTyped && inputValue.trim() !== '' && !filteredOptions.some(o => String(o).toLowerCase() === inputValue.trim().toLowerCase()) && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              handleCommit(inputValue);
            }}
            className="px-2.5 py-1.5 cursor-pointer bg-blue-50/70 hover:bg-blue-100 text-blue-900 border-b border-blue-100 flex items-center justify-between font-medium"
            title="Use custom written value"
          >
            <span className="truncate">Use custom: <strong className="font-bold">"{inputValue.trim()}"</strong></span>
            <span className="text-[10px] text-blue-600 font-bold shrink-0 ml-1.5">Custom</span>
          </div>
        )}

        {filteredOptions.length === 0 ? (
          <div className="px-3 py-3 text-slate-400 text-center italic text-xs">
            No matching options found. Press Enter to use "{inputValue}".
          </div>
        ) : (
          filteredOptions.map((opt, idx) => {
            const isPlaceholder = String(opt) === defaultPlaceholder;
            const preExisting = !isPlaceholder && isPreExisting(opt);
            const isSelected = !isValueEmpty && !isPlaceholder && String(opt).toLowerCase().replace(/%/g, '').trim() === String(value).toLowerCase().replace(/%/g, '').trim();
            const isHighlighted = idx === highlightedIndex;

            if (isPlaceholder) {
              return (
                <div
                  key="opt-placeholder"
                  data-item-index={idx}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCommit(defaultPlaceholder);
                  }}
                  className={`px-2.5 py-1.5 cursor-pointer flex items-center justify-between transition-colors border-b border-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-50 italic ${
                    isHighlighted ? 'bg-slate-100' : ''
                  }`}
                  title="Clear / reset this spec to view all variables"
                >
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>-- {defaultPlaceholder} --</span>
                  </div>
                  <span className="text-[9px] text-slate-400 normal-case not-italic">Reset</span>
                </div>
              );
            }

            return (
              <div
                key={`${opt}-${idx}`}
                data-item-index={idx}
                data-selected={isSelected ? 'true' : 'false'}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCommit(String(opt));
                }}
                className={`px-2.5 py-1.5 cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-blue-50/90 text-blue-950 font-bold border-l-[3px] border-[#2b6cb0]'
                    : isHighlighted
                    ? 'bg-slate-100/90'
                    : ''
                } ${
                  preExisting
                    ? 'bg-emerald-50/70 hover:bg-emerald-100/90 text-emerald-950 font-semibold border-l-[3px] border-emerald-500'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-[3px] border-transparent font-normal'
                }`}
                title={String(opt)}
              >
                <div className="flex items-center gap-1.5 truncate pr-2">
                  {isSelected ? (
                    <Check className="w-3.5 h-3.5 text-[#2b6cb0] shrink-0" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <span className={preExisting ? 'text-emerald-950 font-bold truncate' : 'text-slate-700 truncate'}>
                    {specType === 'loi' ? `${opt} min` : String(opt)}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1.5">
                  {preExisting ? (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-blue-200/80 text-blue-900' : 'bg-emerald-200/80 text-emerald-800'
                    }`}>
                      ✓ In DB
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
