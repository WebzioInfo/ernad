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
}

const IndustrialNumericInput = React.forwardRef<HTMLInputElement, IndustrialNumericInputProps>(
  ({ className, value, onChange, label, suffix, step = 1, min = 0, max, ...props }, ref) => {
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
      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
      if (!isNaN(val)) {
        if ((min === undefined || val >= min) && (max === undefined || val <= max)) {
          onChange(val)
        }
      }
    }

    return (
      <div className={cn("flex flex-col gap-2 w-full", className)}>
        {label && (
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 leading-none">
            {label}
          </label>
        )}
        <div className="relative group">
          <button
            type="button"
            onClick={handleDecrement}
            className="absolute left-1.5 top-1.5 bottom-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl transition-all active:scale-95 z-10 border border-slate-100"
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <input
            type="number"
            value={value || ''}
            onChange={handleInputChange}
            className={cn(
              "flex h-16 w-full rounded-2xl border border-slate-200 bg-white px-14 py-2 text-2xl font-mono font-black text-center text-slate-900 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm",
            )}
            ref={ref}
            {...props}
          />

          {suffix && !value && (
            <span className="absolute right-16 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest pointer-events-none">
              {suffix}
            </span>
          )}

          <button
            type="button"
            onClick={handleIncrement}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-xl transition-all active:scale-95 z-10 border border-slate-100"
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
