import * as React from "react"
import { cn } from "../../lib/utils"
import { Minus, Plus } from "lucide-react"

export interface IndustrialNumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number
  onChange: (value: number) => void
  label?: string
  suffix?: string
  step?: number
  min?: number
  max?: number
  compact?: boolean
}

const IndustrialNumericInput = React.forwardRef<HTMLInputElement, IndustrialNumericInputProps>(
  ({ className, value, onChange, label, suffix, step = 1, min = 0, max, compact = false, ...props }, ref) => {
    const handleIncrement = () => {
      const newValue = value + step
      if (max === undefined || newValue <= max) {
        onChange(newValue)
      }
    }

    const handleDecrement = () => {
      const newValue = value - step
      if (min === undefined || newValue >= min) {
        onChange(newValue)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value === '' ? 0 : parseFloat(e.target.value)
      if (!isNaN(val)) {
        if ((min === undefined || val >= min) && (max === undefined || val <= max)) {
          onChange(val)
        }
      }
    }

    return (
      <div className={cn("flex flex-col gap-2 w-full", className)}>
        {label && (
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 leading-tight select-none">
            {label}
          </label>
        )}
        <div className={cn(
          "flex items-center w-full rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/30",
          compact ? "h-14" : "h-16",
          props.readOnly && "bg-slate-50 border-slate-150"
        )}>
          <button
            type="button"
            onClick={handleDecrement}
            disabled={props.disabled || props.readOnly}
            className="h-full px-4 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 disabled:opacity-50 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 rounded-xl transition-all active:scale-95 border border-slate-100 flex items-center justify-center shrink-0 min-w-[44px]"
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <input
            type="number"
            value={value || ''}
            onChange={handleInputChange}
            className={cn(
              "flex-1 min-w-0 bg-transparent text-center font-mono font-black text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-2 tabular-nums",
              compact ? "text-xl" : "text-2xl"
            )}
            ref={ref}
            {...props}
          />

          {suffix && !value && (
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none select-none px-1 shrink-0">
              {suffix}
            </span>
          )}

          <button
            type="button"
            onClick={handleIncrement}
            disabled={props.disabled || props.readOnly}
            className="h-full px-4 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 disabled:opacity-50 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 rounded-xl transition-all active:scale-95 border border-slate-100 flex items-center justify-center shrink-0 min-w-[44px]"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }
)
IndustrialNumericInput.displayName = "IndustrialNumericInput"

export { IndustrialNumericInput }
