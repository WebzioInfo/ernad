import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDevices, useAttendanceLogs, useDailyAttendance } from '../hooks/useBiometric';
import {
  Activity,
  Fingerprint,
  Users,
  Clock,
  RefreshCcw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { BiometricDevice, DailyAttendance } from '../types';

const DashboardPage: React.FC = () => {
  const { data: devices, isLoading: devicesLoading } = useDevices();
  const { data: logs, isLoading: logsLoading } = useAttendanceLogs({ limit: 100 });
  const { data: attendance, isLoading: attendanceLoading } = useDailyAttendance({});

  const stats = {
    totalDevices: devices?.length || 0,
    onlineDevices: devices?.filter(d => d.status === 'ONLINE').length || 0,
    offlineDevices: devices?.filter(d => d.status === 'OFFLINE').length || 0,
    todayPunches: logs?.length || 0,
    presentCount: attendance?.filter((a: DailyAttendance) => a.status === 'PRESENT').length || 0,
    lateCount: attendance?.filter((a: DailyAttendance) => a.status === 'LATE').length || 0,
    unmapped: 0, // Placeholder
  };

  // Deriving chart data from real logs for hourly distribution
  const hourlyPunches = (logs || []).reduce((acc: any, log: any) => {
    const hour = new Date(log.punchTime).getHours();
    const label = `${hour.toString().padStart(2, '0')}:00`;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(hourlyPunches)
    .map(([name, punches]) => ({ name, punches }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Attendance Dashboard</h1>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 animate-spin-slow" />
          Live Auto-refresh enabled
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Devices"
          value={stats.totalDevices}
          icon={<Fingerprint className="h-4 w-4 text-primary" />}
          description="Hardware terminals on LAN"
          loading={devicesLoading}
        />
        <StatCard
          title="Live Status"
          value={`${stats.onlineDevices} / ${stats.totalDevices}`}
          icon={<Activity className="h-4 w-4 text-emerald-500" />}
          description="Terminals reachable over TCP"
          loading={devicesLoading}
        />
        <StatCard
          title="Today's Punches"
          value={stats.todayPunches}
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          description="Gross logs synchronized"
          loading={logsLoading}
        />
        <StatCard
          title="Present Today"
          value={stats.presentCount}
          icon={<Users className="h-4 w-4 text-indigo-500" />}
          description="Employees checked in"
          loading={attendanceLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Hourly Punch Heatmap</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="punches" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Device Connectivity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devices?.map((device: BiometricDevice) => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    {device.status === 'ONLINE' ? (
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{device.name}</p>
                      <p className="text-xs text-muted-foreground">{device.ipAddress}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold ${device.status === 'ONLINE' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {device.status}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Port: {device.port}
                    </p>
                  </div>
                </div>
              ))}
              {devicesLoading && <Skeleton className="h-[200px] w-full" />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, description, loading }) => (
  <Card className="overflow-hidden border-none shadow-md bg-white">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="text-2xl font-bold">{value}</div>
      )}
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </CardContent>
  </Card>
);

export default DashboardPage;
