import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SpecDropdownInputProps {
  value: string;
  onChange: (val: string) => void;
  onCommit: (val: string) => void;
  onCancel?: () => void;
  preExistingOptions: (string | number)[];
  allOptions?: (string | number)[];
  placeholder?: string;
  unit?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  countryName?: string;
}

export default function SpecDropdownInput({
  value,
  onChange,
  onCommit,
  onCancel,
  preExistingOptions = [],
  allOptions = [],
  placeholder = '',
  unit = '',
  align = 'center',
  className = '',
  countryName = ''
}: SpecDropdownInputProps) {
  const [isOpen, setIsOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onCommit(value);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [value, onCommit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  // Convert all items to string for comparison and display
  const preExistingStrSet = new Set(preExistingOptions.map(o => String(o).trim().toLowerCase()));

  // Deduplicate and filter options
  const preExistingUnique = Array.from(
    new Set(preExistingOptions.map(o => String(o).trim()))
  ).filter(Boolean);

  const otherUnique = Array.from(
    new Set(allOptions.map(o => String(o).trim()))
  ).filter(o => !preExistingStrSet.has(o.toLowerCase()) && Boolean(o));

  const handleSelectOption = (opt: string) => {
    onChange(opt);
    onCommit(opt);
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full text-left" style={{ minWidth: '110px' }}>
      <div className="relative flex items-center bg-white border border-[#2b6cb0] rounded shadow-sm">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full px-1.5 py-1 text-xs font-bold text-slate-900 bg-transparent focus:outline-none ${
            align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
          } ${className}`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 text-slate-500 hover:text-slate-800 focus:outline-none cursor-pointer"
          title="Toggle dropdown list"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {isOpen && (
        <div 
          className="absolute left-0 mt-1 w-64 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 text-xs py-1 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
          style={{ minWidth: '180px' }}
        >
          {/* Pre-existing for selected Country */}
          {preExistingUnique.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50/70 uppercase tracking-wider flex items-center justify-between">
                <span>Existing for {countryName || 'Country'}</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-mono">In DB</span>
              </div>
              <div className="p-0.5 space-y-0.5">
                {preExistingUnique.map((opt) => {
                  const isCurrent = String(value).trim().toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={`pre-${opt}`}
                      type="button"
                      onClick={() => handleSelectOption(opt)}
                      className="w-full text-left px-2.5 py-1 rounded bg-emerald-50 text-emerald-900 font-semibold hover:bg-emerald-100 hover:text-emerald-950 flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="truncate">{opt}{unit ? ` ${unit}` : ''}</span>
                      {isCurrent && <Check className="h-3 w-3 text-emerald-700 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other options */}
          {otherUnique.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 bg-slate-50 uppercase tracking-wider">
                Other Standard Values
              </div>
              <div className="p-0.5 space-y-0.5 max-h-36 overflow-y-auto">
                {otherUnique.map((opt) => {
                  const isCurrent = String(value).trim().toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={`other-${opt}`}
                      type="button"
                      onClick={() => handleSelectOption(opt)}
                      className="w-full text-left px-2.5 py-1 rounded text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="truncate">{opt}{unit ? ` ${unit}` : ''}</span>
                      {isCurrent && <Check className="h-3 w-3 text-indigo-600 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {preExistingUnique.length === 0 && otherUnique.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-slate-400 italic text-center">
              Type any manual value
            </div>
          )}
        </div>
      )}
    </div>
  );
}
