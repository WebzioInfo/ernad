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
   * Helper to wrap a promise with a hard timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`[TIMEOUT_${timeoutMs}ms] ${errorMessage}`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  /**
   * Connects to a biometric device.
   * Caches the connection instance for performance.
   */
  async connect(ip: string, port: number = 4370): Promise<any> {
    if (this.activeConnections.has(ip)) {
      try {
        const instance = this.activeConnections.get(ip);
        return instance;
      } catch (e) {
        this.activeConnections.delete(ip);
      }
    }

    const maxRetries = 3;
    let lastError = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        this.logger.log(`[BIOMETRIC_CONNECTING] Attempt ${i + 1} to ${ip}:${port}...`);
        const zkInstance = new ZKLib(ip, port, 10000, 4000);
        
        await this.withTimeout(
          zkInstance.createSocket(),
          8000,
          `Device at ${ip} failed to establish TCP link within 8s.`
        );

        this.activeConnections.set(ip, zkInstance);
        this.logger.log(`[BIOMETRIC_CONNECTED] Successfully established link to ${ip}:${port}`);
        return zkInstance;
      } catch (error) {
        lastError = error;
        this.logger.warn(`[BIOMETRIC_RETRY] Attempt ${i + 1} failed for ${ip}: ${error.message}`);
        await new Promise(res => setTimeout(res, 2000 * (i + 1))); // Backoff
      }
    }

    this.logger.error(`[BIOMETRIC_CONNECTION_FAILED] All ${maxRetries} attempts failed for ${ip}: ${lastError.message}`);
    throw new Error(`Connection failed: Device at ${ip} is likely offline or network blocked.`);
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
    let zkInstance;
    try {
      zkInstance = await this.connect(ip, port);
      await this.withTimeout(
        zkInstance.getTime(),
        5000,
        `Device at ${ip} failed to respond to ping (getTime) within 5s.`
      );
      return true;
    } catch (err) {
      this.logger.warn(`[BIOMETRIC_PING_FAILED] ${ip}: ${err.message}`);
      return false;
    }
  }

  /**
   * Pulls all attendance logs from the device.
   */
  async fetchAttendances(ip: string, port: number = 4370): Promise<any[]> {
    let zkInstance;
    let fetchError = null;
    try {
      zkInstance = await this.connect(ip, port);
      this.logger.log(`[BIOMETRIC_SYNC_STARTED] Pulling attendance ledger from ${ip}...`);
      
      const logsData = (await this.withTimeout(
        zkInstance.getAttendances(),
        15000, // 15s max for full log fetch
        `Device at ${ip} timed out while fetching attendance logs.`
      )) as any;

      const attendanceData = logsData?.data || [];
      this.logger.log(`[BIOMETRIC_SYNC_SUCCESS] Retrieved ${attendanceData.length} records from ${ip}`);
      return attendanceData;
    } catch (error: any) {
      fetchError = error;
      this.logger.error(`[BIOMETRIC_SYNC_FAILED] Critical error syncing with ${ip}: ${error.message}`);
      return [];
    } finally {
      if (fetchError) {
        this.activeConnections.delete(ip);
      }
    }
  }

  /**
   * WARNING: Clears logs from device memory. 
   * Use only after successful DB persistence.
   */
  async clearDeviceLogs(ip: string, port: number = 4370) {
     try {
       const zkInstance = await this.connect(ip, port);
       await this.withTimeout(
         zkInstance.clearAttendanceLog(),
         10000,
         `Device at ${ip} failed to clear logs within 10s.`
       );
       this.logger.warn(`[BIOMETRIC_MEMORY_CLEARED] Attendance logs wiped on device ${ip}`);
     } catch (err) {
       this.logger.error(`Failed to clear logs on ${ip}: ${err.message}`);
     }
  }
}

