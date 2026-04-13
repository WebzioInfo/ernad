-- ENUMS
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'BLOWING_OPERATOR', 'FILLING_OPERATOR', 'LABELING_OPERATOR', 'PACKING_OPERATOR');
CREATE TYPE batch_status AS ENUM ('RUNNING', 'CHANGEOVER', 'CLOSED');

-- USERS & ROLES
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    form_schema JSONB NOT NULL, -- Dynamic UI permissions based on Role/Manager
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MASTER DATA (Prisma Admin Area)
CREATE TABLE lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    volume_ml INT NOT NULL
);

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_cross_day BOOLEAN DEFAULT FALSE
);

-- PRODUCTION CORE (Drizzle Fast Inserts Area)
CREATE TABLE production_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES lines(id),
    brand_id UUID REFERENCES brands(id),
    product_id UUID REFERENCES products(id),
    shift_id UUID REFERENCES shifts(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status batch_status DEFAULT 'RUNNING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_production_batches_line_status ON production_batches(line_id, status);

CREATE TABLE changeover_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
    line_id UUID REFERENCES lines(id),
    from_product_id UUID REFERENCES products(id),
    to_product_id UUID REFERENCES products(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    leftover_materials JSONB NOT NULL, -- Extracted dynamically from Material flows
    wasted_materials JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OPERATOR LOGS (Separated for speed and no heavy nulls)
CREATE TABLE operator_blowing_logs (
    id BIGSERIAL PRIMARY KEY, -- Using bigserial for time-series logging
    batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES users(id),
    preform_count INT NOT NULL DEFAULT 0,
    bags_used INT NOT NULL DEFAULT 0,
    damaged INT NOT NULL DEFAULT 0,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_op_blowing_batch ON operator_blowing_logs(batch_id);

CREATE TABLE operator_filling_logs (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES users(id),
    bottle_count INT NOT NULL DEFAULT 0,
    cap_wastage INT NOT NULL DEFAULT 0,
    boxes_used INT NOT NULL DEFAULT 0,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_op_filling_batch ON operator_filling_logs(batch_id);

CREATE TABLE operator_labeling_logs (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES users(id),
    label_count INT NOT NULL DEFAULT 0,
    ink_used_ml INT NOT NULL DEFAULT 0,
    makeup_used_ml INT NOT NULL DEFAULT 0,
    cleaning_solution_used_ml INT NOT NULL DEFAULT 0,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_op_labeling_batch ON operator_labeling_logs(batch_id);

CREATE TABLE operator_packing_logs (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES users(id),
    shrink_roll_used_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    shrink_wastage_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    packed_count INT NOT NULL DEFAULT 0,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_op_packing_batch ON operator_packing_logs(batch_id);

-- MATERIAL FLOWS
CREATE TABLE material_flows (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
    material_name VARCHAR(100) NOT NULL,
    issued INT NOT NULL DEFAULT 0,
    used INT NOT NULL DEFAULT 0,
    wasted INT NOT NULL DEFAULT 0,
    -- Carry forward / Remaining calculation done via Generated Columns or Views
    remaining INT GENERATED ALWAYS AS (issued - used - wasted) STORED,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_material_flows_batch ON material_flows(batch_id);

-- INVENTORY & TALLY
CREATE TABLE system_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_name VARCHAR(100) UNIQUE NOT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tally_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date TIMESTAMP NOT NULL,
    inventory_data JSONB NOT NULL,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    entity_id UUID,
    entity_table VARCHAR(50),
    changes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VIEWS FOR REPORTS
CREATE MATERIALIZED VIEW shift_production_report AS
SELECT 
    b.id as batch_id,
    s.name as shift_name,
    l.name as line_name,
    p.name as product_name,
    SUM(f.bottle_count) as total_bottles,
    SUM(pk.packed_count) as total_packed
FROM production_batches b
JOIN shifts s ON b.shift_id = s.id
JOIN lines l ON b.line_id = l.id
JOIN products p ON b.product_id = p.id
LEFT JOIN operator_filling_logs f ON f.batch_id = b.id
LEFT JOIN operator_packing_logs pk ON pk.batch_id = b.id
GROUP BY b.id, s.name, l.name, p.name;

CREATE UNIQUE INDEX idx_mv_shift_batch ON shift_production_report(batch_id);
