import { Injectable, Logger, InternalServerErrorException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { db } from '../../database/db';
import { users } from '../../database/schema';
import { sql, eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';

const execAsync = promisify(exec);

export interface BackupMetadata {
  filename: string;
  size: string;
  createdAt: string;
  userId: string;
  userName: string;
  status: 'SUCCESS' | 'FAILED';
}

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = path.resolve(process.cwd(), 'backups');
  private readonly metadataFile = path.join(this.backupDir, 'backups.json');

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit() {
    // Ensure backups directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    // Initialize metadata file
    if (!fs.existsSync(this.metadataFile)) {
      fs.writeFileSync(this.metadataFile, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private readMetadata(): BackupMetadata[] {
    try {
      if (!fs.existsSync(this.metadataFile)) return [];
      const content = fs.readFileSync(this.metadataFile, 'utf-8');
      return JSON.parse(content);
    } catch (err: any) {
      this.logger.error(`Failed to read backup metadata: ${err.message}`);
      return [];
    }
  }

  private writeMetadata(metadata: BackupMetadata[]) {
    try {
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.error(`Failed to write backup metadata: ${err.message}`);
    }
  }

  async getBackupHistory(userId: string) {
    const backups = this.readMetadata();
    
    // Estimate Database Size
    let dbSize = '0 Bytes';
    try {
      const sizeResult = await db.execute(sql`
        SELECT pg_database_size(current_database()) AS size_bytes
      `);
      if (sizeResult && sizeResult[0]) {
        dbSize = this.formatBytes(Number(sizeResult[0].size_bytes));
      }
    } catch (err: any) {
      this.logger.warn(`Failed to retrieve database size: ${err.message}`);
    }

    // Get last restore date from audit log
    let lastRestoreDate = '—';
    try {
      const [lastRestore] = await db.execute(sql`
        SELECT occurred_at 
        FROM audit_logs 
        WHERE action = 'BACKUP_RESTORED' 
        ORDER BY occurred_at DESC 
        LIMIT 1
      `);
      if (lastRestore && (lastRestore as any).occurred_at) {
        lastRestoreDate = new Date((lastRestore as any).occurred_at).toISOString();
      }
    } catch (err: any) {
      this.logger.warn(`Failed to query last restore date: ${err.message}`);
    }

    // Calculate Backup Storage Used
    let backupStorageUsed = 0;
    backups.forEach((b) => {
      const filePath = path.join(this.backupDir, b.filename);
      if (fs.existsSync(filePath)) {
        backupStorageUsed += fs.statSync(filePath).size;
      }
    });

    const successBackups = backups.filter(b => b.status === 'SUCCESS');
    const lastBackupDate = successBackups.length > 0
      ? successBackups[successBackups.length - 1].createdAt
      : '—';

    return {
      backups: backups.reverse(),
      databaseSize: dbSize,
      totalBackups: successBackups.length,
      lastBackupDate,
      backupStorageUsed: this.formatBytes(backupStorageUsed),
      lastRestoreDate,
    };
  }

  async createBackup(userId: string): Promise<BackupMetadata> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = new Date();
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    
    const baseName = `ERNAD_BACKUP_${ts}`;
    const sqlFilename = `${baseName}.sql`;
    const zipFilename = `${baseName}.zip`;
    const sqlPath = path.join(this.backupDir, sqlFilename);
    const zipPath = path.join(this.backupDir, zipFilename);

    let userName = 'System Admin';
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user) {
        userName = user.name;
      }
    } catch (err) {
      this.logger.warn(`Failed to fetch user name for backup audit: ${err}`);
    }

    this.logger.log(`Starting database backup: ${zipFilename} (Triggered by user ${userId})`);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new InternalServerErrorException('DATABASE_URL is not configured.');
    }

    let backupSuccess = false;
    let sqlContent = '';

    // Primary Strategy: pg_dump
    try {
      this.logger.log(`Attempting database dump using pg_dump...`);
      // Run pg_dump command (SQL format)
      await execAsync(`pg_dump "${databaseUrl}" -Fp -f "${sqlPath}"`);
      backupSuccess = true;
    } catch (err: any) {
      this.logger.warn(`pg_dump failed (executable not found or connection error): ${err.message}. Rolling back to Custom SQL Query Exporter...`);
      
      // Fallback Strategy: Drizzle SQL Query Fallback
      try {
        sqlContent = await this.generateQueryBackupSql();
        fs.writeFileSync(sqlPath, sqlContent, 'utf-8');
        backupSuccess = true;
        this.logger.log(`Custom SQL Query Exporter completed successfully!`);
      } catch (fallbackErr: any) {
        this.logger.error(`Custom SQL Query Exporter failed: ${fallbackErr.message}`);
        
        // Log Failure Metadata
        const failedMeta: BackupMetadata = {
          filename: zipFilename,
          size: '0 Bytes',
          createdAt: new Date().toISOString(),
          userId,
          userName,
          status: 'FAILED',
        };
        const history = this.readMetadata();
        history.push(failedMeta);
        this.writeMetadata(history);

        throw new InternalServerErrorException(`Database backup failed. ${fallbackErr.message}`);
      }
    }

    // If backup succeeded, compress it into ZIP using native tar
    if (backupSuccess && fs.existsSync(sqlPath)) {
      try {
        this.logger.log(`Compressing ${sqlFilename} into ${zipFilename} using tar...`);
        // Use native tar (cross platform on modern Windows and Linux)
        await execAsync(`tar -a -cf "${zipFilename}" "${sqlFilename}"`, { cwd: this.backupDir });
        
        // Delete raw SQL file to save space
        fs.unlinkSync(sqlPath);
      } catch (compressErr: any) {
        this.logger.error(`Compression failed: ${compressErr.message}`);
        // Fall back to keeping raw sql inside backups, renaming it to zip if zip failed or throwing error
        throw new InternalServerErrorException(`Failed to compress backup file: ${compressErr.message}`);
      }
    }

    const fileSize = fs.existsSync(zipPath) ? fs.statSync(zipPath).size : 0;
    const newBackup: BackupMetadata = {
      filename: zipFilename,
      size: this.formatBytes(fileSize),
      createdAt: new Date().toISOString(),
      userId,
      userName,
      status: 'SUCCESS',
    };

    // Save metadata
    const history = this.readMetadata();
    history.push(newBackup);
    this.writeMetadata(history);

    // Audit Logging
    await this.auditService.logAction({
      userId,
      action: 'BACKUP_CREATED',
      entityType: 'database_backups',
      entityId: zipFilename,
      category: 'GENERAL',
      payload: {
        filename: zipFilename,
        size: newBackup.size,
        method: sqlContent ? 'query_fallback' : 'pg_dump',
      },
    });

    return newBackup;
  }

  async deleteBackup(filename: string, userId: string) {
    const filePath = path.join(this.backupDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const history = this.readMetadata();
    const updated = history.filter(b => b.filename !== filename);
    this.writeMetadata(updated);

    // Audit Logging
    await this.auditService.logAction({
      userId,
      action: 'BACKUP_DELETED',
      entityType: 'database_backups',
      entityId: filename,
      category: 'GENERAL',
      payload: { filename },
    });

    return { success: true };
  }

  async restoreBackupFromFile(filePath: string, filename: string, userId: string) {
    this.logger.log(`Initiating database restore from uploaded file: ${filename} (Triggered by user ${userId})`);
    
    // Move uploaded file to backups dir
    const targetPath = path.join(this.backupDir, filename);
    fs.renameSync(filePath, targetPath);

    return await this.executeRestore(filename, userId);
  }

  async restoreBackupFromHistory(filename: string, userId: string) {
    this.logger.log(`Initiating database restore from history: ${filename} (Triggered by user ${userId})`);
    return await this.executeRestore(filename, userId);
  }

  private async executeRestore(filename: string, userId: string) {
    const zipPath = path.join(this.backupDir, filename);
    if (!fs.existsSync(zipPath)) {
      throw new NotFoundException(`Backup file ${filename} not found.`);
    }

    const tempExtractDir = path.join(this.backupDir, `temp_restore_${Date.now()}`);
    fs.mkdirSync(tempExtractDir, { recursive: true });

    try {
      // 1. Extract ZIP file
      this.logger.log(`Extracting ZIP archive ${filename} to temp directory...`);
      await execAsync(`tar -xf "${zipPath}" -C "${tempExtractDir}"`);

      // 2. Locate SQL file
      const files = fs.readdirSync(tempExtractDir);
      const sqlFilename = files.find(f => f.endsWith('.sql'));
      if (!sqlFilename) {
        throw new Error('No database SQL dump file found inside the zip archive.');
      }
      const sqlPath = path.join(tempExtractDir, sqlFilename);

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL is not configured.');
      }

      // 3. Execute Restore: psql or direct Drizzle SQL queries client-side
      this.logger.log(`Restoring database content from ${sqlFilename}...`);
      
      let restoreSuccess = false;
      try {
        this.logger.log(`Attempting restore via psql CLI...`);
        await execAsync(`psql -f "${sqlPath}" "${databaseUrl}"`);
        restoreSuccess = true;
      } catch (err: any) {
        this.logger.warn(`psql CLI restore failed: ${err.message}. Falling back to Database Client execution...`);
        
        // Fallback SQL Client execution
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
        await db.execute(sql.raw(sqlContent));
        restoreSuccess = true;
        this.logger.log(`Database Client restore completed successfully!`);
      }

      if (!restoreSuccess) {
        throw new Error('Restore failed across both psql and client query methods.');
      }

      // 4. Trigger inventory recalculation in the background
      setTimeout(() => {
        this.inventoryService.recalculateInventory().catch((err) => {
          this.logger.error(`Background recalculateInventory after restore failed: ${err.message}`);
        });
      }, 50);

      // Audit Logging
      await this.auditService.logAction({
        userId,
        action: 'BACKUP_RESTORED',
        entityType: 'database_backups',
        entityId: filename,
        category: 'GENERAL',
        payload: { filename },
      });

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Database restore failed: ${err.message}`);
      throw new InternalServerErrorException(`Database restore failed: ${err.message}`);
    } finally {
      // Clean up extraction temp directory
      try {
        if (fs.existsSync(tempExtractDir)) {
          fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
      } catch (cleanupErr) {
        this.logger.warn(`Failed to clean up temp restore directory: ${cleanupErr}`);
      }
    }
  }

  private async generateQueryBackupSql(): Promise<string> {
    this.logger.log('Generating database query dump (SQL formatting)...');
    
    // Get all tables in public schema
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('drizzle_migrations')
    `);
    
    const tables: string[] = tablesResult.map((t: any) => t.table_name);
    let dumpSql = '';

    // Header settings: Disable constraints & triggers
    dumpSql += `-- ERNAD ERP SYSTEM DATABASE DUMP\n`;
    dumpSql += `-- Created At: ${new Date().toISOString()}\n\n`;
    dumpSql += `SET session_replication_role = 'replica';\n\n`;

    // 1. Generate Truncate commands
    dumpSql += `-- CLEAR EXISTING DATA\n`;
    for (const table of tables) {
      dumpSql += `TRUNCATE TABLE "${table}" CASCADE;\n`;
    }
    dumpSql += `\n`;

    // 2. Generate Insert statements table by table
    dumpSql += `-- EXPORT TABLE DATA\n`;
    for (const table of tables) {
      const rows = await db.execute(sql.raw(`SELECT * FROM "${table}"`));
      
      if (rows && rows.length > 0) {
        dumpSql += `-- Table: ${table} (${rows.length} rows)\n`;
        const columns = Object.keys(rows[0]);
        
        for (const row of rows) {
          const escapedValues = columns.map((col) => {
            const val = row[col];
            return this.escapeSqlValue(val);
          });
          
          dumpSql += `INSERT INTO "${table}" ("${columns.join('", "')}") VALUES (${escapedValues.join(', ')});\n`;
        }
        dumpSql += `\n`;
      }
    }

    // Footer settings: Re-enable constraints & triggers
    dumpSql += `SET session_replication_role = 'origin';\n`;
    
    return dumpSql;
  }

  private escapeSqlValue(val: any): string {
    if (val === null || val === undefined) {
      return 'NULL';
    }
    if (typeof val === 'boolean') {
      return val ? 'TRUE' : 'FALSE';
    }
    if (typeof val === 'number') {
      return String(val);
    }
    if (val instanceof Date) {
      return `'${val.toISOString()}'`;
    }
    if (typeof val === 'object') {
      return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
