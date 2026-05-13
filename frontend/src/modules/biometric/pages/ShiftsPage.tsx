import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { biometricService } from '../services/biometric.service';
import { api } from '../../../services/api-client';
import { ENDPOINTS } from '../../../constants/endpoints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  UserPlus,
  Calendar,
  Settings2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const ShiftsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Assignment State
  const [assignment, setAssignment] = useState({
    userId: '',
    shiftId: '',
    effectiveFrom: format(new Date(), 'yyyy-MM-dd')
  });

  // Queries
  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ['biometric', 'shifts'],
    queryFn: async () => (await biometricService.getShifts()).data
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get(ENDPOINTS.USERS.LIST)).data
  });
  const users = (usersData?.data || []) as any[];

  // Mutations
  const createShiftMutation = useMutation({
    mutationFn: (data: any) => biometricService.createShift(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biometric', 'shifts'] });
      toast.success('Shift policy created');
      setIsShiftModalOpen(false);
    }
  });

  const assignShiftMutation = useMutation({
    mutationFn: (data: any) => biometricService.assignShift(data),
    onSuccess: () => {
      toast.success('Shift assigned successfully');
      setIsAssignModalOpen(false);
    }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Scheduling</h1>
          <p className="text-muted-foreground">Manage shifts, grace periods, and employee assignments</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={() => setIsAssignModalOpen(true)}>
            <UserPlus className="h-4 w-4" /> Assign Shift
          </Button>
          <Button className="gap-2 bg-indigo-600" onClick={() => setIsShiftModalOpen(true)}>
            <Plus className="h-4 w-4" /> Create Shift
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {shiftsLoading ? (
          [1, 2, 3].map((i) => (
            <Card key={i} className="border-none shadow-sm bg-white animate-pulse">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4 rounded-lg" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 py-2">
                  <Skeleton className="h-10 w-20 rounded-xl" />
                  <ArrowRight className="h-4 w-4 text-slate-100" />
                  <Skeleton className="h-10 w-20 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Skeleton className="h-8 w-full rounded-lg" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : shifts?.map((shift: any) => (
          <Card key={shift.id} className="relative overflow-hidden group hover:shadow-lg transition-all border-none shadow-sm bg-white">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-bold">{shift.name}</CardTitle>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">
                  {shift.shiftType}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 py-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-black">Start</span>
                  <span className="font-mono text-lg font-bold text-slate-700">{shift.startTime.slice(0, 5)}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-black">End</span>
                  <span className="font-mono text-lg font-bold text-slate-700">{shift.endTime.slice(0, 5)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">Grace Period</span>
                  <span className="text-xs font-bold">{shift.graceMinutes} Minutes</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">OT After</span>
                  <span className="text-xs font-bold">{shift.overtimeAfter} Minutes</span>
                </div>
              </div>

              <Button variant="ghost" size="sm" className="w-full mt-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-2">
                <Settings2 className="h-3 w-3" /> Policy Settings
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-500" />
            Active Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-20 bg-slate-50/50 rounded-xl border border-dashed">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 opacity-20" />
              <p className="font-bold">Automated Scheduling Active</p>
              <p className="text-sm">Attendance is being calculated based on active shift policies.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Shift Modal */}
      <Dialog open={isShiftModalOpen} onOpenChange={setIsShiftModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Shift Policy</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            createShiftMutation.mutate(Object.fromEntries(formData));
          }} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Shift Name</Label>
              <Input name="name" placeholder="e.g., Morning Shift A" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input name="startTime" type="time" step="1" required />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input name="endTime" type="time" step="1" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grace Period (Min)</Label>
                <Input name="graceMinutes" type="number" defaultValue="15" />
              </div>
              <div className="space-y-2">
                <Label>Shift Type</Label>
                <Select name="shiftType" defaultValue="DAY">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAY">Day Shift</SelectItem>
                    <SelectItem value="NIGHT">Night Shift</SelectItem>
                    <SelectItem value="GENERAL">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full bg-indigo-600">Save Policy</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Shift Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Employee Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Employee</Label>
              <Select onValueChange={(val) => setAssignment({ ...assignment, userId: val })}>
                <SelectTrigger><SelectValue placeholder="Choose employee..." /></SelectTrigger>
                <SelectContent>
                  {users?.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.username})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Select Shift</Label>
              <Select onValueChange={(val) => setAssignment({ ...assignment, shiftId: val })}>
                <SelectTrigger><SelectValue placeholder="Choose shift..." /></SelectTrigger>
                <SelectContent>
                  {shifts?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input 
                type="date" 
                value={assignment.effectiveFrom} 
                onChange={(e) => setAssignment({ ...assignment, effectiveFrom: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-indigo-600" 
              disabled={!assignment.userId || !assignment.shiftId || assignShiftMutation.isPending}
              onClick={() => assignShiftMutation.mutate(assignment)}
            >
              {assignShiftMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftsPage;
