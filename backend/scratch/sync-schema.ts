import 'dotenv/config';
import postgres from 'postgres';

async function syncSchema() {
    const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } });
    
    console.log('🚀 Manually Synchronizing Personnel Makeover Schema...');
    try {
        await sql.unsafe(`
            -- Types
            DO $$ BEGIN
                CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FILLING_OPERATOR', 'BLOWING_OPERATOR', 'LABELING_OPERATOR', 'PACKING_OPERATOR', 'OPERATOR');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;

            DO $$ BEGIN
                CREATE TYPE batch_status AS ENUM ('RUNNING', 'CHANGEOVER', 'CLOSED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;

            -- Tables
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(150) NOT NULL,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                phone_number VARCHAR(20),
                department VARCHAR(100),
                job_title VARCHAR(100),
                password_hash VARCHAR(255),
                pin_code VARCHAR(255),
                role user_role DEFAULT 'OPERATOR' NOT NULL,
                operator_type VARCHAR(50),
                is_active BOOLEAN DEFAULT true NOT NULL,
                avatar_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT now() NOT NULL,
                updated_at TIMESTAMP DEFAULT now() NOT NULL,
                deleted_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS production_lines (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                description VARCHAR(255),
                status VARCHAR(50) DEFAULT 'IDLE' NOT NULL,
                current_efficiency DECIMAL(5, 2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT now() NOT NULL,
                updated_at TIMESTAMP DEFAULT now() NOT NULL
            );

            CREATE TABLE IF NOT EXISTS shifts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(50) NOT NULL,
                start_time VARCHAR(5) NOT NULL,
                end_time VARCHAR(5) NOT NULL,
                created_at TIMESTAMP DEFAULT now() NOT NULL
            );

            CREATE TABLE IF NOT EXISTS product_brands (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT now() NOT NULL
            );

            CREATE TABLE IF NOT EXISTS products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                sku VARCHAR(50) UNIQUE,
                brand_id UUID REFERENCES product_brands(id),
                category VARCHAR(50),
                created_at TIMESTAMP DEFAULT now() NOT NULL
            );

            CREATE TABLE IF NOT EXISTS production_batches (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                line_id UUID REFERENCES production_lines(id),
                brand_id UUID REFERENCES product_brands(id),
                product_id UUID REFERENCES products(id),
                shift_id UUID REFERENCES shifts(id),
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                status batch_status DEFAULT 'RUNNING',
                created_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS operator_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id),
                line_id UUID REFERENCES production_lines(id),
                shift_id UUID REFERENCES shifts(id),
                login_time TIMESTAMP DEFAULT now() NOT NULL,
                logout_time TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS operator_filling_logs (
                id BIGSERIAL PRIMARY KEY,
                batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
                operator_id UUID REFERENCES users(id),
                bottle_count INTEGER DEFAULT 0 NOT NULL,
                cap_wastage INTEGER DEFAULT 0 NOT NULL,
                boxes_used INTEGER DEFAULT 0 NOT NULL,
                logged_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS operator_blowing_logs (
                id BIGSERIAL PRIMARY KEY,
                batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
                operator_id UUID REFERENCES users(id),
                preform_count INTEGER DEFAULT 0 NOT NULL,
                bags_used INTEGER DEFAULT 0 NOT NULL,
                damaged INTEGER DEFAULT 0 NOT NULL,
                logged_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS operator_labeling_logs (
                id BIGSERIAL PRIMARY KEY,
                batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
                operator_id UUID REFERENCES users(id),
                label_count INTEGER DEFAULT 0 NOT NULL,
                ink_used_ml INTEGER DEFAULT 0 NOT NULL,
                makeup_used_ml INTEGER DEFAULT 0 NOT NULL,
                cleaning_solution_used_ml INTEGER DEFAULT 0 NOT NULL,
                logged_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS operator_packing_logs (
                id BIGSERIAL PRIMARY KEY,
                batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
                operator_id UUID REFERENCES users(id),
                shrink_roll_used_kg DECIMAL(10, 2) DEFAULT 0 NOT NULL,
                shrink_wastage_kg DECIMAL(10, 2) DEFAULT 0 NOT NULL,
                packed_count INTEGER DEFAULT 0 NOT NULL,
                logged_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS material_flows (
                id BIGSERIAL PRIMARY KEY,
                batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
                material_name VARCHAR(100) NOT NULL,
                issued INTEGER DEFAULT 0 NOT NULL,
                used INTEGER DEFAULT 0 NOT NULL,
                wasted INTEGER DEFAULT 0 NOT NULL,
                logged_at TIMESTAMP DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS changeover_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE,
                line_id UUID REFERENCES production_lines(id),
                from_product_id UUID REFERENCES products(id),
                to_product_id UUID REFERENCES products(id),
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                leftover_materials JSONB NOT NULL,
                wasted_materials JSONB NOT NULL,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT now()
            );
        `);
        console.log('✅ Schema synchronization complete.');
    } catch (e: any) {
        console.error('❌ Schema sync failed:', e.message);
    } finally {
        await sql.end();
    }
}

syncSchema();
