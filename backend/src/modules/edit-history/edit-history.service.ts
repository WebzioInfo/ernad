import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import { recordEditHistory } from '../../database/schema/history';
import { sql, eq, and, gte, lte, ilike, or, desc, count } from 'drizzle-orm';

export interface RecordEditOptions {
  module: string;
  tableName: string;
  recordId: string | number;
  oldRecord: Record<string, any>;
  newRecord: Record<string, any>;
  user?: any;
  req?: any;
  reason?: string;
}

export interface HistoryQueryOptions {
  startDate?: string;
  endDate?: string;
  module?: string;
  employee?: string;
  role?: string;
  field?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const IGNORED_FIELDS = new Set([
  'id',
  '_id',
  'updatedAt',
  'updated_at',
  'createdAt',
  'created_at',
  'createdBy',
  'created_by',
  'updatedBy',
  'updated_by',
  'deletedAt',
  'deleted_at',
  'version',
  '__v',
  'tenantId',
  'tenant_id',
  'requestId',
  'request_id',
  'sessionId',
  'session_id',
  'passwordHash',
  'password_hash',
  'pinCode',
  'pin_code',
  'password',
]);

@Injectable()
export class EditHistoryService {
  private readonly logger = new Logger(EditHistoryService.name);

  /**
   * Fail-safe diff generator & append-only log recorder.
   * NEVER throws an error to the caller to prevent business operations from failing.
   */
  async recordEdit(options: RecordEditOptions): Promise<void> {
    try {
      const { module, tableName, recordId, oldRecord, newRecord, user, req, reason } = options;

      if (!oldRecord || !newRecord || !recordId) return;

      const rowsToInsert: any[] = [];
      const keysToCompare = Object.keys(newRecord);

      for (const key of keysToCompare) {
        if (IGNORED_FIELDS.has(key)) continue;

        const rawOld = oldRecord[key];
        const rawNew = newRecord[key];

        const strOld = this.formatFieldValue(rawOld);
        const strNew = this.formatFieldValue(rawNew);

        // Skip if values are equal
        if (strOld === strNew) continue;

        rowsToInsert.push({
          tenantId: user?.tenantId || null,
          module,
          tableName,
          recordId: String(recordId),
          fieldName: key,
          oldValue: strOld,
          newValue: strNew,
          editedByUserId: user?.sub || user?.id || null,
          editedByName: user?.name || user?.username || user?.email || 'System User',
          editedByRole: user?.role || (Array.isArray(user?.roles) ? user.roles.join(', ') : 'OPERATOR'),
          editedAt: new Date(),
          reason: reason || req?.headers?.['x-edit-reason'] || req?.body?.reason || null,
          ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || null,
          userAgent: req?.headers?.['user-agent'] || null,
          sessionId: req?.headers?.['x-session-id'] || user?.sessionId || null,
        });
      }

      if (rowsToInsert.length > 0) {
        await db.insert(recordEditHistory).values(rowsToInsert);
        this.logger.log(`[EditHistory] Recorded ${rowsToInsert.length} field edit(s) for ${module} record ${recordId}`);
      }
    } catch (err: any) {
      this.logger.error(`[EditHistory] Fail-safe error recording edit history: ${err.message}`, err.stack);
    }
  }

  private formatFieldValue(val: any): string | null {
    if (val === undefined || val === null) return null;
    if (val instanceof Date) return val.toISOString();
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch {
        return String(val);
      }
    }
    return String(val);
  }

  async getEditHistory(options: HistoryQueryOptions) {
    const page = Math.max(Number(options.page) || 1, 1);
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    try {
      const conditions: any[] = [];

      if (options.startDate && !isNaN(Date.parse(options.startDate))) {
        conditions.push(gte(recordEditHistory.editedAt, new Date(`${options.startDate}T00:00:00.000Z`)));
      }
      if (options.endDate && !isNaN(Date.parse(options.endDate))) {
        conditions.push(lte(recordEditHistory.editedAt, new Date(`${options.endDate}T23:59:59.999Z`)));
      }
      if (options.module && options.module.trim() !== '') {
        conditions.push(eq(recordEditHistory.module, options.module.trim()));
      }
      if (options.employee && options.employee.trim() !== '') {
        conditions.push(
          or(
            ilike(recordEditHistory.editedByName, `%${options.employee.trim()}%`),
            eq(recordEditHistory.editedByUserId, options.employee.trim())
          )
        );
      }
      if (options.role && options.role.trim() !== '') {
        conditions.push(eq(recordEditHistory.editedByRole, options.role.trim()));
      }
      if (options.field && options.field.trim() !== '') {
        conditions.push(ilike(recordEditHistory.fieldName, `%${options.field.trim()}%`));
      }
      if (options.search && options.search.trim() !== '') {
        const q = `%${options.search.trim()}%`;
        conditions.push(
          or(
            ilike(recordEditHistory.recordId, q),
            ilike(recordEditHistory.module, q),
            ilike(recordEditHistory.fieldName, q),
            ilike(recordEditHistory.oldValue, q),
            ilike(recordEditHistory.newValue, q),
            ilike(recordEditHistory.editedByName, q)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Total Items count
      const [countRes] = await db
        .select({ total: count() })
        .from(recordEditHistory)
        .where(whereClause);

      const totalItems = Number(countRes?.total || 0);
      const totalPages = Math.ceil(totalItems / limit) || 1;

      // Paginated Items
      const items = await db
        .select()
        .from(recordEditHistory)
        .where(whereClause)
        .orderBy(desc(recordEditHistory.editedAt))
        .limit(limit)
        .offset(offset);

      // Available Distinct Metadata for Filters
      const modulesRes = await db
        .selectDistinct({ name: recordEditHistory.module })
        .from(recordEditHistory);
      const rolesRes = await db
        .selectDistinct({ name: recordEditHistory.editedByRole })
        .from(recordEditHistory);

      return {
        items,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        },
        availableModules: modulesRes.map(m => m.name).filter(Boolean),
        availableRoles: rolesRes.map(r => r.name).filter(Boolean),
      };
    } catch (err: any) {
      this.logger.error(`[EditHistory] Error retrieving edit history: ${err.message}`, err.stack);
      return {
        items: [],
        pagination: {
          page,
          limit,
          totalItems: 0,
          totalPages: 1,
        },
        availableModules: [],
        availableRoles: [],
      };
    }
  }

  async getRecordHistory(module: string, recordId: string) {
    try {
      return await db
        .select()
        .from(recordEditHistory)
        .where(
          and(
            eq(recordEditHistory.module, module),
            eq(recordEditHistory.recordId, recordId)
          )
        )
        .orderBy(desc(recordEditHistory.editedAt));
    } catch (err: any) {
      this.logger.error(`[EditHistory] Error retrieving record history: ${err.message}`, err.stack);
      return [];
    }
  }
}
