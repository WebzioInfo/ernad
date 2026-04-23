export default function Watermark() {
  return (
    <div className="fixed inset-0 pointer-events-none opacity-[0.015] z-[9999] overflow-hidden select-none">
      <div className="absolute inset-0 flex flex-wrap gap-32 p-20 rotate-[-15deg]">
        {Array.from({ length: 100 }).map((_, i) => (
          <div key={i} className="text-xs font-medium uppercase tracking-widest text-slate-400 whitespace-nowrap">
            Webzio International • Webzio Technology
          </div>
        ))}
      </div>
    </div>
  );
}


