import { Delete } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface VirtualNumpadProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  className?: string;
}

export function VirtualNumpad({ onKeyPress, onBackspace, onClear, className }: VirtualNumpadProps) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'];

  return (
    <div className={cn("grid grid-cols-3 gap-4", className)}>
      {keys.map((key) => (
        <motion.button
          whileTap={{ scale: 0.95, backgroundColor: 'rgba(99, 102, 241, 0.2)' }}
          key={key}
          type="button"
          onClick={() => onKeyPress(key)}
          className="h-20 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-2xl text-3xl font-mono font-black text-white transition-all shadow-xl flex items-center justify-center relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative z-10">{key}</span>
        </motion.button>
      ))}
      <motion.button
        whileTap={{ scale: 0.95, backgroundColor: 'rgba(245, 158, 11, 0.2)' }}
        type="button"
        onClick={onClear}
        className="h-20 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 rounded-2xl text-2xl font-mono font-black text-amber-500 transition-all shadow-xl"
      >
        CLR
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.95, backgroundColor: 'rgba(244, 63, 94, 0.2)' }}
        type="button"
        onClick={onBackspace}
        className="h-20 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 transition-all shadow-xl"
      >
        <Delete className="w-8 h-8" />
      </motion.button>
    </div>
  );
}
