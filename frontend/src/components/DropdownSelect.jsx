import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const DropdownSelect = ({
  value,
  options = [],
  onChange,
  placeholder = 'Select',
  className = '',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  useEffect(() => {
    const handleOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full h-12 px-4 rounded-xl border border-white/15 bg-white/5 text-sm text-white flex items-center justify-between gap-3 hover:border-primary/50 hover:bg-white/[0.07] focus:outline-none focus:border-primary/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate text-left">{selectedOption?.label || placeholder}</span>
        <ChevronDown size={16} className={`text-white/60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-40 mt-2 w-full rounded-xl border border-white/15 bg-[#0e1624] shadow-[0_18px_45px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="max-h-72 overflow-y-auto custom-scrollbar py-1">
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange?.(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                    active ? 'bg-primary/20 text-primary' : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  <span className="truncate text-left">{opt.label}</span>
                  {active ? <Check size={14} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownSelect;
