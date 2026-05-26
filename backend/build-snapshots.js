const fs = require('fs');

const snap003 = JSON.parse(fs.readFileSync('drizzle/meta/0003_snapshot.json', 'utf8'));

// ====== 0004 SNAPSHOT ======
const snap004 = JSON.parse(JSON.stringify(snap003));
snap004.prevId = snap003.id;
snap004.id = 'a4b1c2d3-e5f6-7890-abcd-ef1234567004';

snap004.enums['public.terminal_type'] = { name: 'terminal_type', schema: 'public', values: ['PRODUCTION','QC','MAINTENANCE','SUPERVISOR','KIOSK'] };
snap004.enums['public.terminal_status'] = { name: 'terminal_status', schema: 'public', values: ['OFFLINE','ONLINE','MAINTENANCE','LOCKED'] };

snap004.tables['public.operator_sessions'].columns['terminal_id'] = { name: 'terminal_id', type: 'uuid', primaryKey: false, notNull: false };
snap004.tables['public.operator_sessions'].indexes['idx_operator_sessions_terminal'] = { name: 'idx_operator_sessions_terminal', columns: [{ expression: 'terminal_id', isExpression: false, asc: true, nulls: 'last' }], isUnique: false, concurrently: false, method: 'btree', with: {} };
snap004.tables['public.operator_sessions'].foreignKeys['operator_sessions_terminal_id_terminals_id_fk'] = { name: 'operator_sessions_terminal_id_terminals_id_fk', tableFrom: 'operator_sessions', columnsFrom: ['terminal_id'], tableTo: 'terminals', columnsTo: ['id'], onDelete: 'no action', onUpdate: 'no action' };

snap004.tables['public.production_logs'].columns['terminal_id'] = { name: 'terminal_id', type: 'uuid', primaryKey: false, notNull: false };
snap004.tables['public.production_logs'].foreignKeys['production_logs_terminal_id_terminals_id_fk'] = { name: 'production_logs_terminal_id_terminals_id_fk', tableFrom: 'production_logs', columnsFrom: ['terminal_id'], tableTo: 'terminals', columnsTo: ['id'], onDelete: 'no action', onUpdate: 'no action' };

snap004.tables['public.terminals'] = {
  name: 'terminals', schema: 'public',
  columns: {
    id: { name: 'id', type: 'uuid', primaryKey: true, notNull: true },
    code: { name: 'code', type: 'varchar(20)', primaryKey: false, notNull: true },
    name: { name: 'name', type: 'varchar(100)', primaryKey: false, notNull: true },
    type: { name: 'type', type: 'terminal_type', primaryKey: false, notNull: true },
    line_id: { name: 'line_id', type: 'uuid', primaryKey: false, notNull: false },
    department: { name: 'department', type: 'varchar(50)', primaryKey: false, notNull: false },
    mac_address: { name: 'mac_address', type: 'varchar(50)', primaryKey: false, notNull: false },
    ip_address: { name: 'ip_address', type: 'varchar(50)', primaryKey: false, notNull: false },
    status: { name: 'status', type: 'terminal_status', primaryKey: false, notNull: true },
    is_active: { name: 'is_active', type: 'boolean', primaryKey: false, notNull: true },
    last_seen_at: { name: 'last_seen_at', type: 'timestamp', primaryKey: false, notNull: false },
    created_at: { name: 'created_at', type: 'timestamp', primaryKey: false, notNull: true },
    updated_at: { name: 'updated_at', type: 'timestamp', primaryKey: false, notNull: true }
  },
  indexes: {},
  foreignKeys: {
    terminals_line_id_production_lines_id_fk: { name: 'terminals_line_id_production_lines_id_fk', tableFrom: 'terminals', columnsFrom: ['line_id'], tableTo: 'production_lines', columnsTo: ['id'], onDelete: 'no action', onUpdate: 'no action' }
  },
  uniqueConstraints: { terminals_code_unique: { name: 'terminals_code_unique', nullsNotDistinct: false, columns: ['code'] } },
  compositePrimaryKeys: {}, checkConstraints: {}, policies: {}, isRLSEnabled: false
};

snap004.tables['public.terminal_sessions'] = {
  name: 'terminal_sessions', schema: 'public',
  columns: {
    id: { name: 'id', type: 'uuid', primaryKey: true, notNull: true },
    terminal_id: { name: 'terminal_id', type: 'uuid', primaryKey: false, notNull: true },
    supervisor_id: { name: 'supervisor_id', type: 'uuid', primaryKey: false, notNull: true },
    shift_id: { name: 'shift_id', type: 'uuid', primaryKey: false, notNull: true },
    start_time: { name: 'start_time', type: 'timestamp', primaryKey: false, notNull: true },
    end_time: { name: 'end_time', type: 'timestamp', primaryKey: false, notNull: false },
    is_active: { name: 'is_active', type: 'boolean', primaryKey: false, notNull: true },
    auth_metadata: { name: 'auth_metadata', type: 'varchar(500)', primaryKey: false, notNull: false }
  },
  indexes: { idx_terminal_session_active: { name: 'idx_terminal_session_active', columns: [{ expression: 'terminal_id', isExpression: false, asc: true, nulls: 'last' }, { expression: 'is_active', isExpression: false, asc: true, nulls: 'last' }], isUnique: false, concurrently: false, method: 'btree', with: {} } },
  foreignKeys: {
    terminal_sessions_terminal_id_terminals_id_fk: { name: 'terminal_sessions_terminal_id_terminals_id_fk', tableFrom: 'terminal_sessions', columnsFrom: ['terminal_id'], tableTo: 'terminals', columnsTo: ['id'], onDelete: 'no action', onUpdate: 'no action' },
    terminal_sessions_supervisor_id_users_id_fk: { name: 'terminal_sessions_supervisor_id_users_id_fk', tableFrom: 'terminal_sessions', columnsFrom: ['supervisor_id'], tableTo: 'users', columnsTo: ['id'], onDelete: 'no action', onUpdate: 'no action' }
  },
  uniqueConstraints: {}, compositePrimaryKeys: {}, checkConstraints: {}, policies: {}, isRLSEnabled: false
};

fs.writeFileSync('drizzle/meta/0004_snapshot.json', JSON.stringify(snap004, null, 2));

// ====== 0005 SNAPSHOT ======
const snap005 = JSON.parse(JSON.stringify(snap004));
snap005.id = 'b5c2d3e4-f6a7-8901-bcde-f12345678905';
snap005.prevId = snap004.id;
snap005.enums['public.terminal_trust_mode'] = { name: 'terminal_trust_mode', schema: 'public', values: ['STRICT_KIOSK','FLEXIBLE_AUTH','TEMPORARY_SESSION','MOBILE_OPERATOR'] };
snap005.tables['public.terminals'].columns['device_id'] = { name: 'device_id', type: 'varchar(255)', primaryKey: false, notNull: false };
snap005.tables['public.terminals'].columns['trust_mode'] = { name: 'trust_mode', type: 'terminal_trust_mode', primaryKey: false, notNull: true };

fs.writeFileSync('drizzle/meta/0005_snapshot.json', JSON.stringify(snap005, null, 2));
console.log('Snapshots written. 0005 tables:', Object.keys(snap005.tables).length, '| enums:', Object.keys(snap005.enums).length);
