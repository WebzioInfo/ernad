import { useQuery } from '@tanstack/react-query';
import { 
  Clock
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  userName: string;
  userRole: string;
  clockIn: string;
  clockOut?: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';
  shift: string;
}

export default function AttendanceRecordsPage() {
  const { isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance'],
    queryFn: async () => {
      // For now, returning dummy data as the backend only has minimal stubs
      return [
        { id: '1', userName: 'Sarah Chen', userRole: 'SUPER_ADMIN', clockIn: new Date().toISOString(), status: 'PRESENT', shift: 'Morning' },
        { id: '2', userName: 'David Kim', userRole: 'OPERATOR', clockIn: new Date().toISOString(), status: 'LATE', shift: 'Morning' },
        { id: '3', userName: 'Elena Rossi', userRole: 'OPERATOR', clockIn: new Date().toISOString(), status: 'PRESENT', shift: 'Morning' },
      ] as AttendanceRecord[];
    }
  });

  if (isLoading) return <div className="p-20 text-center text-slate-400 animate-pulse font-bold">Loading records...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] bg-white rounded-[2.5rem] border border-slate-100 shadow-sm text-center p-20">
      <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-10 border border-slate-100 shadow-xl shadow-slate-100/50">
        <Clock className="w-14 h-14 text-indigo-400 animate-pulse" />
      </div>
      <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Attendance</h2>
      <p className="text-slate-500 max-w-lg mx-auto text-lg font-medium leading-relaxed">
        We are working on connecting the fingerprint scanner. This will be ready soon.
      </p>
      
      <div className="mt-12 flex items-center gap-4">
        <div className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-600/20">
          Coming Q3 2026
        </div>
        <div className="px-8 py-3 bg-slate-50 text-slate-400 rounded-2xl font-black text-sm border border-slate-100">
          Phase 4: Hardware Bridge
        </div>
      </div>
    </div>
  );
}
