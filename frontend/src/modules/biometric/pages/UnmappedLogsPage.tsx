import React, { useState } from 'react';
import { useUnmappedLogs, useBiometricMapping } from '../hooks/useBiometric';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Link as LinkIcon,
  Search,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const UnmappedLogsPage: React.FC = () => {
  const { data: logs, isLoading, refetch } = useUnmappedLogs();
  const mappingMutation = useBiometricMapping();

  const [selectedDeviceUser, setSelectedDeviceUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch users for mapping
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data
  });

  const filteredUsers = users?.filter((u: any) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5); // Limit for UI performance

  const handleMap = async (userId: string) => {
    if (!selectedDeviceUser) return;

    await mappingMutation.mutateAsync({
      deviceUserId: selectedDeviceUser,
      userId
    });

    setSelectedDeviceUser(null);
    setSearchTerm('');
    refetch();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Biometric Mapping Resolver</h1>
          <p className="text-muted-foreground">Link hardware IDs to ERP employee accounts</p>
        </div>
      </div>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-bold">Identification Pipeline</p>
          <p>Hardware IDs below have punched on terminals but are not yet identified in the ERP. Attendance for these users will not be processed until they are mapped.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Unidentified Hardware Pulse</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Hardware ID</TableHead>
                <TableHead>Activity Volume</TableHead>
                <TableHead>Last Pulse</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                  </TableCell>
                </TableRow>
              ) : logs?.map((log) => (
                <TableRow key={log.deviceUserId} className="hover:bg-slate-50/50">
                  <TableCell className="font-mono font-bold text-indigo-600 text-lg">
                    #{log.deviceUserId}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="px-3 py-1">
                      {log.punchCount} Gross Punches
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {log.lastPunch ? format(new Date(log.lastPunch), 'MMM dd, HH:mm:ss') : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                      onClick={() => setSelectedDeviceUser(log.deviceUserId)}
                    >
                      <LinkIcon className="h-3 w-3" /> Map Employee
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {logs?.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 text-emerald-500 opacity-50" />
                      <p className="font-bold text-slate-900">All Clear!</p>
                      <p className="text-sm">Every hardware ID is correctly mapped to an employee.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDeviceUser} onOpenChange={() => setSelectedDeviceUser(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Resolve Hardware ID #{selectedDeviceUser}</DialogTitle>
            <DialogDescription>
              Select the ERP employee who owns this biometric ID.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or code..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
              {filteredUsers?.map((user: any) => (
                <button
                  key={user.id}
                  className="w-full flex items-center justify-between p-4 border rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all text-left"
                  onClick={() => handleMap(user.id)}
                  disabled={mappingMutation.isPending}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">Code: {user.username}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{user.department || 'Staff'}</Badge>
                </button>
              ))}
              {filteredUsers?.length === 0 && searchTerm && (
                <p className="text-center py-4 text-sm text-muted-foreground">No matching employees found.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedDeviceUser(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnmappedLogsPage;
