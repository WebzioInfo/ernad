export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'SYNCING';

export interface BiometricDevice {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  location?: string;
  isActive: boolean;
  status: DeviceStatus;
  lastConnectedAt?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceLog {
  id: string;
  deviceId: string;
  deviceUserId: string;
  punchTime: string;
  punchType: number;
  rawData?: any;
  source: string;
  createdAt: string;
  employeeName?: string;
  employeeCode?: string;
}

export interface DailyAttendance {
  id: string;
  userId: string;
  userName: string;
  userCode: string;
  department?: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  workedHours: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';
  lateMinutes: number;
  overtimeMinutes: number;
  remarks?: string;
}

export interface UnmappedLog {
  deviceUserId: string;
  punchCount: number;
  lastPunch: string;
}

export interface AttendanceCorrection {
  id: string;
  userId: string;
  date: string;
  originalIn?: string;
  originalOut?: string;
  requestedIn?: string;
  requestedOut?: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  createdAt: string;
}
