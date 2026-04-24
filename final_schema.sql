-- 🏭 ERNAD MES: FINAL INDUSTRIAL SCHEMA
-- Optimized for high-concurrency production environments

-- 1. ENUMS
CREATE TYPE station_type AS ENUM ('BLOWING', 'FILLING', 'LABELING', 'PACKING');
CREATE TYPE event_type AS ENUM ('POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE', 'NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END');
CREATE TYPE batch_status AS ENUM ('RUNNING', 'CHANGEOVER', 'CLOSED');

-- 2. MASTER DATA
CREATE TABLE production_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'IDLE',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    brand_id UUID REFERENCES product_brands(id)
);

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

-- 3. CORE PRODUCTION
CREATE TABLE production_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_code VARCHAR(50) NOT NULL,
    line_id UUID REFERENCES production_lines(id) NOT NULL,
    brand_id UUID REFERENCES product_brands(id) NOT NULL,
    product_id UUID REFERENCES products(id) NOT NULL,
    shift_id UUID REFERENCES shifts(id) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status batch_status DEFAULT 'RUNNING' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. THE LEDGER (PARTITIONED)
CREATE TABLE factory_logs (
    id BIGSERIAL NOT NULL,
    request_id UUID NOT NULL UNIQUE,
    batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE NOT NULL,
    line_id UUID REFERENCES production_lines(id) NOT NULL,
    shift_id UUID REFERENCES shifts(id) NOT NULL,
    user_id UUID NOT NULL,
    station station_type NOT NULL,
    primary_count INTEGER DEFAULT 0 NOT NULL,
    wastage_count INTEGER DEFAULT 0 NOT NULL,
    is_rework BOOLEAN DEFAULT false NOT NULL,
    event_type event_type DEFAULT 'NORMAL_PRODUCTION' NOT NULL,
    logged_at TIMESTAMP NOT NULL,
    received_at TIMESTAMP DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id, logged_at)
) PARTITION BY RANGE (logged_at);

-- 5. AGGREGATES & TRACKING
CREATE TABLE batch_totals (
    batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE PRIMARY KEY,
    line_id UUID REFERENCES production_lines(id) NOT NULL,
    blowing_total INTEGER DEFAULT 0 NOT NULL,
    filling_total INTEGER DEFAULT 0 NOT NULL,
    labeling_total INTEGER DEFAULT 0 NOT NULL,
    packing_total INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. SECURITY & AUDIT
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID,
    action VARCHAR(255) NOT NULL,
    payload JSONB,
    occurred_at TIMESTAMP DEFAULT NOW()
);

-- 7. PERFORMANCE INDEXES
CREATE INDEX idx_logs_performance ON factory_logs (line_id, station, logged_at DESC);
CREATE INDEX idx_batches_active ON production_batches (line_id, status) WHERE status = 'RUNNING';

-- 8. RLS POLICIES
ALTER TABLE factory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can only log" ON factory_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Everyone can view logs" ON factory_logs
FOR SELECT USING (true);
