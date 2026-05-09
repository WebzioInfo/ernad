import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { biometricService } from '../services/biometric.service';
import { BiometricDevice, AttendanceLog, UnmappedLog, DailyAttendance } from '../types';
import { toast } from 'sonner';

export const useDevices = () => {
  return useQuery({
    queryKey: ['biometric', 'devices'],
    queryFn: () => biometricService.getDevices(),
    select: (res) => res.data as BiometricDevice[],
    refetchInterval: 30000, // 30s
  });
};

export const useAttendanceLogs = (filters: any) => {
  return useQuery({
    queryKey: ['biometric', 'logs', filters],
    queryFn: () => biometricService.getLogs(filters),
    select: (res) => res.data as AttendanceLog[],
    refetchInterval: 5000, // 5s for live feed
  });
};

export const useUnmappedLogs = () => {
  return useQuery({
    queryKey: ['biometric', 'unmapped'],
    queryFn: () => biometricService.getUnmapped(),
    select: (res) => res.data as UnmappedLog[],
  });
};

export const useDailyAttendance = (filters: any) => {
  return useQuery({
    queryKey: ['attendance', 'daily', filters],
    queryFn: () => biometricService.getDailyAttendance(filters),
    select: (res) => res.data as DailyAttendance[],
  });
};

export const useTestConnection = () => {
  return useMutation({
    mutationFn: (id: string) => biometricService.testConnection(id),
  });
};

export const useTriggerSync = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => biometricService.triggerSync(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biometric', 'devices'] });
      queryClient.invalidateQueries({ queryKey: ['biometric', 'logs'] });
    },
  });
};

export const useCreateDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BiometricDevice>) => biometricService.createDevice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biometric', 'devices'] });
      toast.success('Device registered successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to register device');
    }
  });
};

export const useBiometricMapping = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { deviceUserId: string; userId: string }) => 
      biometricService.mapUser(data.deviceUserId, data.userId),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['biometric', 'unmapped'] });
      queryClient.invalidateQueries({ queryKey: ['biometric', 'logs'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'daily'] });
      toast.success(res.data.message || 'Mapping successful');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Mapping failed');
    }
  });
};
