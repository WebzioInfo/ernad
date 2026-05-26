import React, { useState } from 'react';
import { useDevices, useTestConnection, useTriggerSync, useCreateDevice } from '../hooks/useBiometric';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCcw, 
  Settings, 
  Wifi, 
  Database, 
  Plus,
  Play,
  XCircle,
  Network
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAuthStore from '../../auth/auth.store';

const DevicesPage: React.FC = () => {
  const { user } = useAuthStore();
  const { data: devices, isLoading, refetch } = useDevices();
  const testConn = useTestConnection();
  const sync = useTriggerSync();
  const createDevice = useCreateDevice();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    port: 4370,
    location: ''
  });

  const isAdmin = user?.roles?.includes('ADMIN') || user?.role === 'ADMIN';

  const handleTest = async (id: string) => {
    try {
      const res = await testConn.mutateAsync(id);
      if (res.data.success) {
        toast.success('Device is ONLINE and reachable');
      } else {
        toast.error(`Connection failed: ${res.data.message}`);
      }
      refetch();
    } catch (err) {
      toast.error('TCP Timeout - Check LAN connectivity');
    }
  };

  const handleSync = async (id: string) => {
    toast.promise(sync.mutateAsync(id), {
      loading: 'Pulling logs from biometric buffer...',
      success: (res: any) => `Sync complete! ${res.data.imported} new logs imported.`,
      error: 'Sync failed - Device might be busy or offline'
    });
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    await createDevice.mutateAsync(formData);
    setIsDialogOpen(false);
    setFormData({ name: '', ipAddress: '', port: 4370, location: '' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Biometric Terminals</h1>
          <p className="text-muted-foreground">Manage hardware devices connected over LAN</p>
        </div>
        
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4" /> Add Device
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-indigo-600" />
                  Register New Terminal
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddDevice} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Friendly Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g., Main Entrance Gate" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ip">IP Address</Label>
                    <Input 
                      id="ip" 
                      placeholder="192.168.1.201" 
                      value={formData.ipAddress}
                      onChange={e => setFormData({...formData, ipAddress: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">TCP Port</Label>
                    <Input 
                      id="port" 
                      type="number" 
                      value={formData.port}
                      onChange={e => setFormData({...formData, port: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Physical Location</Label>
                  <Input 
                    id="location" 
                    placeholder="e.g., Block A, Ground Floor" 
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full bg-indigo-600" disabled={createDevice.isPending}>
                    {createDevice.isPending ? 'Registering...' : 'Complete Registration'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Network Device Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Name</TableHead>
                <TableHead>Network Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices?.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-slate-400" />
                      {device.name}
                      <Badge variant="outline" className="text-[10px] uppercase">{device.location || 'Factory'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-mono">{device.ipAddress}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">Port: {device.port}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {device.status === 'ONLINE' ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1">
                          <Wifi className="h-3 w-3" /> ONLINE
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" /> OFFLINE
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      {device.lastSyncAt ? format(new Date(device.lastSyncAt), 'MMM dd, HH:mm') : 'Never'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 gap-1"
                        onClick={() => handleTest(device.id)}
                        disabled={testConn.isPending}
                      >
                        <Play className="h-3 w-3" /> Test
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 gap-1"
                        onClick={() => handleSync(device.id)}
                        disabled={sync.isPending}
                      >
                        <RefreshCcw className={`h-3 w-3 ${sync.isPending ? 'animate-spin' : ''}`} /> Sync
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {devices?.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No biometric devices configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-900 text-white border-none">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-400" /> Synchronization Logic
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2 opacity-80">
            <p>• Automated sync runs every 1 minute for all active devices.</p>
            <p>• Deduplication ensures duplicate punches are discarded.</p>
            <p>• First-In / Last-Out rules apply for daily attendance calculation.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DevicesPage;
