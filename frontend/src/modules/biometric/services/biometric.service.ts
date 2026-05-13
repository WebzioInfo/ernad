import { api as apiClient } from '../../../services/api-client';
import { BiometricDevice, AttendanceLog, DailyAttendance, UnmappedLog } from '../types';
import { ENDPOINTS } from '../../../constants/endpoints';

export const biometricService = {
  // Devices
  getDevices: () => apiClient.get<BiometricDevice[]>(ENDPOINTS.BIOMETRIC.DEVICES),
  createDevice: (data: Partial<BiometricDevice>) => apiClient.post(ENDPOINTS.BIOMETRIC.DEVICES, data),
  testConnection: (id: string) => apiClient.post(ENDPOINTS.BIOMETRIC.TEST(id)),
  triggerSync: (id: string) => apiClient.post(ENDPOINTS.BIOMETRIC.SYNC(id)),
  
  // Logs & Unmapped
  getLogs: (params: any) => apiClient.get<AttendanceLog[]>(ENDPOINTS.BIOMETRIC.LOGS, { params }),
  getUnmapped: () => apiClient.get<UnmappedLog[]>(ENDPOINTS.BIOMETRIC.UNMAPPED),
  mapUser: (deviceUserId: string, userId: string) => apiClient.post(ENDPOINTS.BIOMETRIC.MAP_USER, { deviceUserId, userId }),

  // Attendance
  getDailyAttendance: (params: any) => apiClient.get<DailyAttendance[]>(ENDPOINTS.BIOMETRIC.ATTENDANCE_TODAY, { params }),
  updateAttendance: (id: string, data: any) => apiClient.patch(ENDPOINTS.BIOMETRIC.ATTENDANCE(id), data),

  // Shifts
  getShifts: () => apiClient.get(ENDPOINTS.BIOMETRIC.SHIFTS),
  createShift: (data: any) => apiClient.post(ENDPOINTS.BIOMETRIC.SHIFTS, data),
  assignShift: (data: any) => apiClient.post(ENDPOINTS.BIOMETRIC.ASSIGN_SHIFT, data),

  // Reports
  getMonthlyReport: (month: number, year: number) => 
    apiClient.get(ENDPOINTS.BIOMETRIC.REPORT_MONTHLY, { params: { month, year } }),
};
