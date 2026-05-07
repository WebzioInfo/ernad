export function LoadingScreen({ message = "Booting MES Shell..." }: { message?: string }) {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-black tracking-widest uppercase text-[10px]">{message}</p>
      </div>
    </div>
  );
}
