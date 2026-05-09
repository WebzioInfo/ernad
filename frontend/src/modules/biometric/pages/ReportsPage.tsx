import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { biometricService } from '../services/biometric.service';
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
  FileText,
  Download,
  Calendar,
  Users,
  Clock,
  TrendingUp,
  Filter
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AttendanceReportsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const { data: report, isLoading } = useQuery({
    queryKey: ['biometric', 'reports', 'monthly', selectedMonth, selectedYear],
    queryFn: async () => (await biometricService.getMonthlyReport(Number(selectedMonth), Number(selectedYear))).data
  });

  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  const years = ['2024', '2025', '2026'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Reports</h1>
          <p className="text-muted-foreground">Enterprise attendance aggregation and payroll ledgers</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button className="gap-2 bg-indigo-600">
            <FileText className="h-4 w-4" /> Full Audit Log
          </Button>
        </div>
      </div>

      <div className="flex gap-4 p-4 bg-white rounded-2xl border shadow-sm items-end">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Period Month</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px] rounded-xl border-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Period Year</label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px] rounded-xl border-slate-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" className="gap-2 rounded-xl h-[40px]">
          <Filter className="h-4 w-4" /> Apply Filters
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <ReportSummaryCard
          title="Avg. Attendance"
          value="94.2%"
          icon={<Users className="h-4 w-4 text-emerald-500" />}
          trend="+2.1% from last month"
        />
        <ReportSummaryCard
          title="Total OT Hours"
          value="142.5"
          icon={<Clock className="h-4 w-4 text-indigo-500" />}
          trend="Peak on Production Line A"
        />
        <ReportSummaryCard
          title="Punctuality Score"
          value="8.4/10"
          icon={<TrendingUp className="h-4 w-4 text-blue-500" />}
          trend="Top 5% employees perfect"
        />
        <ReportSummaryCard
          title="Absenteeism"
          value="4.1%"
          icon={<Calendar className="h-4 w-4 text-rose-500" />}
          trend="-0.5% improved"
        />
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-slate-50/50 border-b">
          <CardTitle className="text-lg">Monthly Payroll Attendance Ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-[250px]">Employee</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Half Days</TableHead>
                <TableHead>Lates</TableHead>
                <TableHead>OT (Min)</TableHead>
                <TableHead className="text-right">Net Payable Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report?.map((row: any) => (
                <TableRow key={row.id} className="hover:bg-slate-50/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{row.userName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{row.userCode} | {row.department}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-emerald-600">{row.totalPresent}d</TableCell>
                  <TableCell className="text-rose-500">{row.totalAbsent}d</TableCell>
                  <TableCell>{row.totalHalfDays}d</TableCell>
                  <TableCell>
                    {row.totalLates > 3 ? (
                      <Badge variant="destructive" className="text-[10px]">{row.totalLates} Lates</Badge>
                    ) : (
                      <span>{row.totalLates} Lates</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-indigo-600 font-bold">{row.totalOvertimeMinutes}m</TableCell>
                  <TableCell className="text-right">
                    <span className="text-lg font-black text-slate-900">{row.netPayableDays}</span>
                  </TableCell>
                </TableRow>
              ))}
              {report?.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                    No records found for the selected period.
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

const ReportSummaryCard: React.FC<{ title: string; value: string; icon: React.ReactNode; trend: string }> = ({ title, value, icon, trend }) => (
  <Card className="border-none shadow-sm bg-white">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{title}</CardTitle>
      <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <p className="text-[10px] font-bold text-slate-400 mt-1">{trend}</p>
    </CardContent>
  </Card>
);

export default AttendanceReportsPage;
