CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FILLING_OPERATOR', 'BLOWING_OPERATOR', 'LABELING_OPERATOR', 'PACKING_OPERATOR', 'OPERATOR');--> statement-breakpoint
CREATE TYPE "public"."batch_status" AS ENUM('RUNNING', 'CHANGEOVER', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE', 'NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END');--> statement-breakpoint
CREATE TYPE "public"."station_type" AS ENUM('BLOWING', 'FILLING', 'LABELING', 'PACKING');--> statement-breakpoint
CREATE TABLE "attendance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"clock_in" timestamp DEFAULT now() NOT NULL,
	"clock_out" timestamp,
	"shift_name" varchar(50),
	"status" varchar(20) DEFAULT 'PRESENT' NOT NULL,
	"external_sync_id" varchar(255),
	"remarks" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone_number" varchar(20),
	"department" varchar(100),
	"job_title" varchar(100),
	"password_hash" varchar(255),
	"pin_code" varchar(255),
	"role" "user_role" DEFAULT 'OPERATOR' NOT NULL,
	"operator_type" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"avatar_url" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "batch_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"snapshot_type" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changeover_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"from_product_id" uuid NOT NULL,
	"to_product_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"leftover_materials" jsonb NOT NULL,
	"wasted_materials" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_flows" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"material_name" varchar(100) NOT NULL,
	"issued" integer DEFAULT 0 NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"wasted" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_code" varchar(50),
	"production_date" timestamp,
	"line_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" "batch_status" DEFAULT 'RUNNING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" varchar(255) NOT NULL,
	"entity_type" varchar(100),
	"entity_id" varchar(100),
	"payload" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_totals" (
	"batch_id" uuid PRIMARY KEY NOT NULL,
	"line_id" uuid NOT NULL,
	"blowing_total" integer DEFAULT 0 NOT NULL,
	"filling_total" integer DEFAULT 0 NOT NULL,
	"labeling_total" integer DEFAULT 0 NOT NULL,
	"packing_total" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"platform" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "factory_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"station" "station_type" NOT NULL,
	"primary_count" integer DEFAULT 0 NOT NULL,
	"split_values" jsonb DEFAULT '[]'::jsonb,
	"wastage_count" integer DEFAULT 0 NOT NULL,
	"event_type" "event_type" DEFAULT 'NORMAL_PRODUCTION' NOT NULL,
	"is_rework" boolean DEFAULT false NOT NULL,
	"remarks" varchar(500),
	"logged_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "factory_logs_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "materials_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"log_id" bigserial NOT NULL,
	"batch_id" uuid NOT NULL,
	"material_name" varchar(100) NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"waste" numeric(12, 4) DEFAULT '0',
	"logged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" varchar(1000) NOT NULL,
	"severity" varchar(20) DEFAULT 'INFO',
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "production_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"status" varchar(50) DEFAULT 'IDLE' NOT NULL,
	"current_efficiency" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"sku" varchar(50),
	"brand_id" uuid,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"login_time" timestamp DEFAULT now() NOT NULL,
	"logout_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_snapshots" ADD CONSTRAINT "batch_snapshots_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changeover_logs" ADD CONSTRAINT "changeover_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changeover_logs" ADD CONSTRAINT "changeover_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_flows" ADD CONSTRAINT "material_flows_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_brand_id_product_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."product_brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_totals" ADD CONSTRAINT "batch_totals_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_totals" ADD CONSTRAINT "batch_totals_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_logs" ADD CONSTRAINT "factory_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_logs" ADD CONSTRAINT "factory_logs_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_logs" ADD CONSTRAINT "factory_logs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_logs" ADD CONSTRAINT "factory_logs_brand_id_product_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."product_brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_logs" ADD CONSTRAINT "factory_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_logs" ADD CONSTRAINT "factory_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials_usage" ADD CONSTRAINT "materials_usage_log_id_factory_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."factory_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials_usage" ADD CONSTRAINT "materials_usage_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_product_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."product_brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attendance_user_date" ON "attendance_logs" USING btree ("user_id","clock_in");--> statement-breakpoint
CREATE INDEX "idx_attendance_sync_id" ON "attendance_logs" USING btree ("external_sync_id");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_material_flows_batch" ON "material_flows" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_batches_line_status" ON "production_batches" USING btree ("line_id","status");--> statement-breakpoint
CREATE INDEX "idx_batches_product" ON "production_batches" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_factory_logs_batch" ON "factory_logs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_factory_logs_brand_product" ON "factory_logs" USING btree ("brand_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_factory_logs_line_shift" ON "factory_logs" USING btree ("line_id","shift_id","brand_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_factory_logs_station" ON "factory_logs" USING btree ("station");--> statement-breakpoint
CREATE INDEX "idx_factory_logs_request" ON "factory_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "operator_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_active" ON "operator_sessions" USING btree ("user_id","logout_time");