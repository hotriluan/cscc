import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Plus, Check, X } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: 'blue' | 'emerald' | 'amber' | 'slate';
  keywords?: string;
}

interface SearchableComboboxProps {
  value: string;
  options: ComboboxOption[];
  onChange: (newValue: string, option?: ComboboxOption) => void;
  onCreateNew?: (customValue: string) => void;
  createNewLabel?: (customValue: string) => string;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  popoverWidthClass?: string;
  align?: 'left' | 'right';
  monoLabel?: boolean;
  compact?: boolean;
  highlightEmpty?: boolean;
}

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  value,
  options,
  onChange,
  onCreateNew,
  createNewLabel,
  placeholder = '-- Hãy chọn... --',
  searchPlaceholder = 'Gõ để tìm nhanh...',
  disabled = false,
  className = '',
  popoverWidthClass = 'w-80',
  align = 'left',
  monoLabel = false,
  compact = false,
  highlightEmpty = true
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlightIdx, setHighlightIdx] = React.useState(0);
  const [portalStyle, setPortalStyle] = React.useState<React.CSSProperties>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  // Filter options by query (max 80 rendered in DOM for 60fps performance)
  const filteredOptions = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      // Ensure currently selected option is always visible at the top if beyond 80
      const top = options.slice(0, 80);
      if (selectedOption && !top.some((o) => o.value === selectedOption.value)) {
        return [selectedOption, ...top.slice(0, 79)];
      }
      return top;
    }
    const matches: ComboboxOption[] = [];
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const hay = `${opt.label} ${opt.value} ${opt.sublabel || ''} ${opt.badge || ''} ${opt.keywords || ''}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push(opt);
        if (matches.length >= 80) break;
      }
    }
    return matches;
  }, [options, query, selectedOption]);

  const exactMatchExists = React.useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return true;
    return options.some(
      (o) => o.value.toUpperCase() === q || o.label.toUpperCase() === q
    );
  }, [options, query]);

  const updatePopoverPosition = React.useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const widthMap: Record<string, number> = {
      'w-60': 240,
      'w-72': 288,
      'w-80': 320,
      'w-96': 384
    };
    const desiredWidth = Math.max(
      rect.width,
      widthMap[popoverWidthClass] || 320
    );
    const maxAllowedWidth = Math.max(220, window.innerWidth - 16);
    const finalWidth = Math.min(desiredWidth, maxAllowedWidth);

    let left = align === 'right' ? rect.right - finalWidth : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - finalWidth - 8));

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 290 && spaceAbove > spaceBelow;

    if (openUpward) {
      setPortalStyle({
        position: 'fixed',
        left: `${left}px`,
        bottom: `${Math.max(8, window.innerHeight - rect.top + 4)}px`,
        width: `${finalWidth}px`,
        zIndex: 9999
      });
    } else {
      setPortalStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${rect.bottom + 4}px`,
        width: `${finalWidth}px`,
        zIndex: 9999
      });
    }
  }, [align, popoverWidthClass]);

  // Close when clicking outside & keep position synced on scroll/resize
  React.useEffect(() => {
    if (!open) return;
    updatePopoverPosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!popoverRef.current || !popoverRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePopoverPosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, updatePopoverPosition]);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setHighlightIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const handleSelect = (opt: ComboboxOption) => {
    onChange(opt.value, opt);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) =>
        Math.min(prev + 1, Math.max(0, filteredOptions.length - 1))
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightIdx]) {
        handleSelect(filteredOptions[highlightIdx]);
      } else if (onCreateNew && query.trim() && !exactMatchExists) {
        onCreateNew(query.trim());
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const badgeColors = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const isEmpty = !value || value.trim() === '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        title={
          selectedOption
            ? `${selectedOption.label} ${selectedOption.sublabel ? `— ${selectedOption.sublabel}` : ''}`
            : value || placeholder
        }
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg border text-left transition focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed ${
          isEmpty && highlightEmpty
            ? 'border-amber-400 bg-amber-50/60 hover:border-amber-500 focus:border-blue-600'
            : 'border-slate-300 bg-white hover:border-blue-400 focus:border-blue-600'
        } ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}
      >
        <span
          className={`truncate ${
            isEmpty
              ? 'italic font-medium text-amber-800'
              : `font-semibold ${monoLabel ? 'font-mono text-blue-950' : 'text-slate-900'}`
          }`}
        >
          {selectedOption ? selectedOption.label : value || placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 ${
            isEmpty ? 'text-amber-600' : 'text-slate-400'
          }`}
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={portalStyle}
            className="rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 rounded-t-xl">
              <Search className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightIdx(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="max-h-64 overflow-y-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-slate-500">
                  Không tìm thấy kết quả phù hợp cho "{query}"
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === highlightIdx;
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      type="button"
                      onMouseEnter={() => setHighlightIdx(idx)}
                      onClick={() => handleSelect(opt)}
                      className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                        isHighlighted
                          ? 'bg-blue-50 text-blue-950'
                          : isSelected
                            ? 'bg-slate-100/80 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`truncate font-bold ${
                              monoLabel ? 'font-mono text-blue-950' : 'text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </span>
                          {opt.badge && (
                            <span
                              className={`shrink-0 rounded border px-1.5 py-0.2 text-[10px] font-semibold ${
                                badgeColors[opt.badgeColor || 'slate']
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.sublabel && (
                          <div className="mt-0.5 truncate text-[11px] text-slate-500">
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Quick-Create Option if user typed a new value */}
            {onCreateNew && query.trim() && !exactMatchExists && (
              <div className="border-t border-slate-200 bg-blue-50/50 p-1.5 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => {
                    onCreateNew(query.trim());
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {createNewLabel
                      ? createNewLabel(query.trim())
                      : `+ Thêm mới "${query.trim().toUpperCase()}"`}
                  </span>
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
