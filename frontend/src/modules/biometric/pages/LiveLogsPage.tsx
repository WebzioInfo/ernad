import React from 'react';
import { useAttendanceLogs } from '../hooks/useBiometric';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Activity, Fingerprint } from 'lucide-react';

const LiveLogsPage: React.FC = () => {
  const { data: logs, isLoading } = useAttendanceLogs({ limit: 50 });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Attendance Feed</h1>
          <p className="text-muted-foreground">Real-time punch activity from all biometric terminals</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold animate-pulse">
          <Activity className="h-3 w-3" />
          LIVE MONITORING ACTIVE
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="w-[100px]">Time</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Hardware ID</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => (
                <TableRow key={log.id} className="group hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-mono text-xs">
                    {format(new Date(log.punchTime), 'HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{log.employeeName || 'Unknown Employee'}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{log.employeeCode || 'UNMAPPED'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      #{log.deviceUserId}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                      <Fingerprint className="h-3 w-3 text-slate-400" />
                      {log.deviceId.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.punchType === 0 ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">IN</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-600">OUT</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">
                      {log.source} SDK
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {logs?.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                    Waiting for punches...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveLogsPage;
