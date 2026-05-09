import React, { useState } from 'react';
import { useDailyAttendance } from '../hooks/useBiometric';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  UserMinus
} from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyAttendance } from '../types';

const AttendancePage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: attendance, isLoading } = useDailyAttendance({ date: format(new Date(), 'yyyy-MM-dd') });

  const filteredData = attendance?.filter((a: DailyAttendance) => 
    a.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.userCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Attendance</h1>
          <p className="text-muted-foreground">Monitor employee check-ins and total worked hours</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button variant="outline" className="gap-2">
            <CalendarIcon className="h-4 w-4" /> {format(new Date(), 'MMM dd, yyyy')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search employee by name or ID..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="secondary" className="gap-2">
          <Filter className="h-4 w-4" /> Filters
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-[250px]">Employee</TableHead>
                <TableHead>Check-In</TableHead>
                <TableHead>Check-Out</TableHead>
                <TableHead>Worked Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                filteredData?.map((item: DailyAttendance) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{item.userName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{item.userCode}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-emerald-50 text-emerald-600">
                          <UserCheck className="h-3 w-3" />
                        </div>
                        <span className="text-sm font-mono">{item.checkIn ? format(new Date(item.checkIn), 'HH:mm:ss') : '--:--:--'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-slate-100 text-slate-600">
                          <UserMinus className="h-3 w-3" />
                        </div>
                        <span className="text-sm font-mono">{item.checkOut ? format(new Date(item.checkOut), 'HH:mm:ss') : '--:--:--'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-semibold">{item.workedHours} hrs</span>
                        </div>
                        {item.lateMinutes > 0 && (
                          <span className="text-[10px] text-red-500 font-medium">Late: {item.lateMinutes}m</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-xs">Edit</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'PRESENT':
      return <Badge className="bg-emerald-500 hover:bg-emerald-600">PRESENT</Badge>;
    case 'LATE':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">LATE</Badge>;
    case 'HALF_DAY':
      return <Badge variant="outline" className="text-blue-600 border-blue-600">HALF DAY</Badge>;
    case 'ABSENT':
      return <Badge variant="destructive">ABSENT</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default AttendancePage;
