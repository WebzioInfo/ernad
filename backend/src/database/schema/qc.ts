import { pgTable, uuid, varchar, timestamp, decimal, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { productionBatches } from './production';
import { users } from './users';
import { factories } from './master-data';

export const qcStatusEnum = pgEnum('qc_status', ['PENDING', 'PASSED', 'FAILED', 'ON_HOLD', 'RELEASED']);

