import { api as apiClient } from '../../../services/api-client';
import { BiometricDevice, AttendanceLog, DailyAttendance, UnmappedLog } from '../types';

export const biometricService = {
  // Devices
  getDevices: () => apiClient.get<BiometricDevice[]>('/biometric/devices'),
  createDevice: (data: Partial<BiometricDevice>) => apiClient.post('/biometric/devices', data),
  testConnection: (id: string) => apiClient.post(`/biometric/devices/${id}/test`),
  triggerSync: (id: string) => apiClient.post(`/biometric/devices/${id}/sync`),
  
  // Logs & Unmapped
  getLogs: (params: any) => apiClient.get<AttendanceLog[]>('/biometric/logs', { params }),
  getUnmapped: () => apiClient.get<UnmappedLog[]>('/biometric/unmapped'),
  mapUser: (deviceUserId: string, userId: string) => apiClient.post('/biometric/map-user', { deviceUserId, userId }),

  // Attendance
  getDailyAttendance: (params: any) => apiClient.get<DailyAttendance[]>('/biometric/attendance/today', { params }),
  updateAttendance: (id: string, data: any) => apiClient.patch(`/biometric/attendance/${id}`, data),

  // Shifts
  getShifts: () => apiClient.get('/biometric/shifts'),
  createShift: (data: any) => apiClient.post('/biometric/shifts', data),
  assignShift: (data: any) => apiClient.post('/biometric/shifts/assign', data),

  // Reports
  getMonthlyReport: (month: number, year: number) => 
    apiClient.get('/biometric/reports/monthly', { params: { month, year } }),
};
