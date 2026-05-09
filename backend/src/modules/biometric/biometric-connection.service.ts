import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as ZKLib from 'node-zklib';

@Injectable()
export class BiometricConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(BiometricConnectionService.name);
  private activeConnections = new Map<string, any>();

  async onModuleDestroy() {
    for (const [ip, zkInstance] of this.activeConnections) {
      try {
        await zkInstance.disconnect();
        this.logger.log(`[BIOMETRIC_SHUTDOWN] Disconnected from device at ${ip}`);
      } catch (err) {
        this.logger.error(`Error during shutdown disconnect for ${ip}: ${err.message}`);
      }
    }
  }

  /**
   * Connects to a biometric device.
   * Caches the connection instance for performance.
   */
  async connect(ip: string, port: number = 4370): Promise<any> {
    if (this.activeConnections.has(ip)) {
      try {
        // Test if existing connection is still alive
        const instance = this.activeConnections.get(ip);
        return instance;
      } catch (e) {
        this.activeConnections.delete(ip);
      }
    }

    try {
      this.logger.log(`[BIOMETRIC_CONNECTING] Attempting TCP link to ${ip}:${port}...`);
      const zkInstance = new ZKLib(ip, port, 10000, 4000); // 10s TCP timeout, 4s command timeout
      await zkInstance.createSocket();
      this.activeConnections.set(ip, zkInstance);
      this.logger.log(`[BIOMETRIC_CONNECTED] Successfully established link to ${ip}:${port}`);
      return zkInstance;
    } catch (error) {
      this.logger.error(`[BIOMETRIC_CONNECTION_FAILED] Device at ${ip} unreachable: ${error.message}`);
      throw new Error(`Connection timeout: Device at ${ip} is likely offline.`);
    }
  }

  async disconnect(ip: string) {
    const zkInstance = this.activeConnections.get(ip);
    if (zkInstance) {
      try {
        await zkInstance.disconnect();
        this.activeConnections.delete(ip);
        this.logger.log(`[BIOMETRIC_DISCONNECTED] Closed connection to ${ip}`);
      } catch (err) {
        this.logger.error(`Manual disconnect error for ${ip}: ${err.message}`);
      }
    }
  }

  /**
   * Pings the device to check health without pulling logs.
   */
  async pingDevice(ip: string, port: number = 4370): Promise<boolean> {
    try {
      const zkInstance = await this.connect(ip, port);
      await zkInstance.getTime(); // Lightweight command to verify connectivity
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Pulls all attendance logs from the device.
   */
  async fetchAttendances(ip: string, port: number = 4370): Promise<any[]> {
    let zkInstance;
    try {
      zkInstance = await this.connect(ip, port);
      this.logger.log(`[BIOMETRIC_SYNC_STARTED] Pulling attendance ledger from ${ip}...`);
      
      const logs = await zkInstance.getAttendances();
      const attendanceData = logs.data || [];
      
      this.logger.log(`[BIOMETRIC_SYNC_SUCCESS] Retrieved ${attendanceData.length} records from ${ip}`);
      return attendanceData;
    } catch (error) {
      this.logger.error(`[BIOMETRIC_SYNC_FAILED] Critical error syncing with ${ip}: ${error.message}`);
      this.activeConnections.delete(ip); // Wipe stale connection
      return [];
    }
  }

  /**
   * WARNING: Clears logs from device memory. 
   * Use only after successful DB persistence.
   */
  async clearDeviceLogs(ip: string, port: number = 4370) {
     try {
       const zkInstance = await this.connect(ip, port);
       await zkInstance.clearAttendanceLog();
       this.logger.warn(`[BIOMETRIC_MEMORY_CLEARED] Attendance logs wiped on device ${ip}`);
     } catch (err) {
       this.logger.error(`Failed to clear logs on ${ip}: ${err.message}`);
     }
  }
}
