import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Monitor, 
  CheckCircle2, 
  ChevronRight, 
  Settings2,
} from 'lucide-react';
import { api } from '../../services/api-client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function TerminalSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    lineId: '',
    department: 'BLOWING'
  });

  const { data: lines } = useQuery({
    queryKey: ['production-lines'],
    queryFn: async () => (await api.get('/master-data/lines')).data
  });

  const registerMutation = useMutation({
    mutationFn: (data: any) => api.post('/production-management/terminal/register', data),
    onSuccess: (res) => {
      localStorage.setItem('mes-terminal-id', res.data.id);
      localStorage.setItem('mes-terminal-code', res.data.code);
      toast.success('Terminal Registered Successfully');
      setStep(3);
    }
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-10">
      <div className="max-w-xl w-full bg-white/5 border border-white/10 rounded-[3rem] p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -mr-32 -mt-32" />
        
        {step === 1 && (
          <div className="relative z-10 text-center">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-500/20">
              <Monitor className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight italic mb-4">Register Terminal</h1>
            <p className="text-slate-500 text-sm mb-10">Assign this tablet to a specific factory station to enable the Industrial MES Terminal mode.</p>
            
            <button 
              onClick={() => setStep(2)}
              className="w-full py-6 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-4 hover:bg-slate-200 transition-all"
            >
              Start Provisioning <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-10">
              <Settings2 className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-black uppercase italic">Device Configuration</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Terminal Code (e.g. T-BLW-01)</label>
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full h-14 bg-black/40 border border-white/10 rounded-xl px-6 font-bold focus:border-indigo-500 transition-all outline-none"
                  placeholder="Enter unique device code"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Display Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full h-14 bg-black/40 border border-white/10 rounded-xl px-6 font-bold focus:border-indigo-500 transition-all outline-none"
                  placeholder="e.g. Blowing Station A"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Assigned Line</label>
                  <select 
                    value={formData.lineId}
                    onChange={(e) => setFormData({...formData, lineId: e.target.value})}
                    className="w-full h-14 bg-black/40 border border-white/10 rounded-xl px-6 font-bold focus:border-indigo-500 transition-all outline-none"
                  >
                    <option value="">Select Line</option>
                    {lines?.map((line: any) => (
                      <option key={line.id} value={line.id}>{line.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Department</label>
                  <select 
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="w-full h-14 bg-black/40 border border-white/10 rounded-xl px-6 font-bold focus:border-indigo-500 transition-all outline-none"
                  >
                    <option value="BLOWING">BLOWING</option>
                    <option value="FILLING">FILLING</option>
                    <option value="LABELING">LABELING</option>
                    <option value="PACKING">PACKING</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={() => registerMutation.mutate(formData)}
                disabled={registerMutation.isPending}
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-4 transition-all mt-6 shadow-xl shadow-indigo-500/20"
              >
                {registerMutation.isPending ? 'Registering...' : 'Complete Registration'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="relative z-10 text-center">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 text-black" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight italic mb-4 text-emerald-500">Ready to Go!</h1>
            <p className="text-slate-500 text-sm mb-10">This device is now registered as <span className="text-white font-bold">{formData.name}</span>. It will now enter high-performance terminal mode.</p>
            
            <button 
              onClick={() => navigate('/terminal')}
              className="w-full py-6 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-4 hover:bg-slate-200 transition-all"
            >
              Enter Terminal Dashboard <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
