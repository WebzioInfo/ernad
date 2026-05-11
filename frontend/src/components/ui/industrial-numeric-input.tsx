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
      <div className={cn("flex flex-col gap-1.5 w-full", className)}>
        {label && (
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
            {label}
          </label>
        )}
        <div className="relative group">
          <button
            type="button"
            onClick={handleDecrement}
            className="absolute left-1 top-1 bottom-1 px-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all active:scale-95 z-10"
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <input
            type="number"
            value={value || ''}
            onChange={handleInputChange}
            className={cn(
              "flex h-14 w-full rounded-2xl border border-white/10 bg-black/40 px-14 py-2 text-xl font-black text-center ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            )}
            ref={ref}
            {...props}
          />

          {suffix && (
            <span className="absolute right-14 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
              {suffix}
            </span>
          )}

          <button
            type="button"
            onClick={handleIncrement}
            className="absolute right-1 top-1 bottom-1 px-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all active:scale-95 z-10"
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
