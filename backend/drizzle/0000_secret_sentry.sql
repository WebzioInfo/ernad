CREATE TYPE "public"."batch_status" AS ENUM('PLANNING', 'RUNNING', 'CHANGEOVER', 'WAITING_APPROVAL', 'QC_PENDING', 'APPROVED', 'COMPLETED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('POWER_FAILURE', 'MACHINE_BREAKDOWN', 'LOW_SPEED', 'MATERIAL_SHORTAGE', 'NORMAL_PRODUCTION', 'BATCH_START', 'BATCH_END', 'DOWNTIME_PAUSE');--> statement-breakpoint
CREATE TYPE "public"."log_status" AS ENUM('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'CORRECTED', 'OVERRIDDEN');--> statement-breakpoint
CREATE TYPE "public"."qc_status" AS ENUM('PENDING', 'PASSED', 'FAILED', 'ON_HOLD', 'RELEASED');--> statement-breakpoint
CREATE TYPE "public"."station_type" AS ENUM('BLOWING', 'FILLING', 'LABELING', 'PACKING', 'QC');--> statement-breakpoint
CREATE TYPE "public"."note_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('GENERAL', 'PRODUCTION', 'MAINTENANCE', 'QUALITY', 'SHIFT_HANDOVER', 'INCIDENT', 'BREAKDOWN', 'ALERT', 'STOCK');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PARTIAL', 'PAID', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."grn_status" AS ENUM('DRAFT', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name"),
	CONSTRAINT "roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_lines" (
	"user_id" uuid NOT NULL,
	"line_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL
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
	"reason" varchar(100),
	"notes" varchar(500),
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downtime_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"station" varchar(50) NOT NULL,
	"reason" varchar(100) NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"duration_minutes" integer,
	"remarks" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	"deleted_reason" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "machine_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_id" uuid NOT NULL,
	"station" varchar(50) NOT NULL,
	"state" varchar(50) DEFAULT 'STOPPED' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"batch_id" uuid,
	"station_type" varchar(50) NOT NULL,
	"shift_id" uuid,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"ended_by" uuid,
	"end_reason" varchar(100),
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_code" varchar(50) NOT NULL,
	"line_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"target_quantity" integer,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"adjusted_start_time" timestamp,
	"adjusted_by" uuid,
	"status" "batch_status" DEFAULT 'RUNNING' NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"closed_by" uuid,
	"closed_at" timestamp,
	"remarks" varchar(500),
	"material_return" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	"deleted_reason" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "shift_handovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_id" uuid NOT NULL,
	"station" varchar(50) NOT NULL,
	"batch_id" uuid NOT NULL,
	"outgoing_operator_id" uuid NOT NULL,
	"incoming_operator_id" uuid NOT NULL,
	"handover_time" timestamp DEFAULT now() NOT NULL,
	"outgoing_session_id" uuid,
	"incoming_session_id" uuid,
	"notes" text,
	"pending_issues" text,
	"machine_state_snapshot" varchar(50),
	"production_count_snapshot" integer DEFAULT 0 NOT NULL,
	"waste_count_snapshot" integer DEFAULT 0 NOT NULL,
	"material_state_confirmed" boolean DEFAULT false NOT NULL,
	"machine_status_acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" varchar(255) NOT NULL,
	"entity_type" varchar(100),
	"entity_id" varchar(100),
	"category" varchar(50) DEFAULT 'GENERAL' NOT NULL,
	"request_id" uuid DEFAULT NULL,
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
	"scrap_total" integer DEFAULT 0 NOT NULL,
	"cap_total" integer DEFAULT 0 NOT NULL,
	"preform_total" integer DEFAULT 0 NOT NULL,
	"bop_roll_total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"shrink_weight_total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"finished_goods_total" integer DEFAULT 0 NOT NULL,
	"cases_total" integer DEFAULT 0 NOT NULL,
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
CREATE TABLE "dispatch_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"dispatch_manager_id" uuid NOT NULL,
	"destination" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"vehicle_number" varchar(50),
	"remarks" varchar(500),
	"dispatched_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "packaging_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"pack_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"units_per_pack" integer NOT NULL,
	"remarks" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"station" "station_type" NOT NULL,
	"primary_count" integer DEFAULT 0 NOT NULL,
	"split_values" jsonb DEFAULT '[]'::jsonb,
	"wastage_count" integer DEFAULT 0 NOT NULL,
	"event_type" "event_type" DEFAULT 'NORMAL_PRODUCTION' NOT NULL,
	"is_rework" boolean DEFAULT false NOT NULL,
	"status" "log_status" DEFAULT 'SUBMITTED' NOT NULL,
	"remarks" varchar(500),
	"verified_by" uuid,
	"verified_at" timestamp,
	"verification_reason" varchar(500),
	"cap_usage" integer DEFAULT 0,
	"cap_rejection" integer DEFAULT 0,
	"preform_usage" integer DEFAULT 0,
	"preform_rejection" integer DEFAULT 0,
	"bop_roll_usage" numeric(8, 2) DEFAULT '0',
	"bop_rejection" numeric(8, 2) DEFAULT '0',
	"shrink_weight_used" numeric(8, 2) DEFAULT '0',
	"shrink_weight_rejected" numeric(8, 2) DEFAULT '0',
	"ink_usage" numeric(8, 2) DEFAULT '0',
	"solvent_usage" numeric(8, 2) DEFAULT '0',
	"label_usage" integer DEFAULT 0,
	"cases_produced" integer DEFAULT 0,
	"packing_type_id" uuid,
	"finished_goods_produced" integer DEFAULT 0,
	"material_cost" numeric(12, 2) DEFAULT '0',
	"box_count" integer DEFAULT 0,
	"secondary_packaging_count" integer DEFAULT 0 NOT NULL,
	"shrink_waste_weight" numeric(8, 2),
	"source_batch_number" varchar(100),
	"label_sticker_weight" numeric(10, 2),
	"damaged_label_weight" numeric(10, 2),
	"ink_changed" boolean DEFAULT false,
	"ink_usage_ml" numeric(8, 2),
	"makeup_changed" boolean DEFAULT false,
	"makeup_usage_ml" numeric(8, 2),
	"ph_value" numeric(4, 2),
	"tds_value" numeric(6, 2),
	"test_result" "qc_status",
	"logged_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	"deleted_reason" varchar(500),
	CONSTRAINT "production_logs_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "quality_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"inspector_id" uuid NOT NULL,
	"check_type" varchar(100) NOT NULL,
	"result" varchar(20) NOT NULL,
	"parameters" jsonb NOT NULL,
	"report_url" varchar(255),
	"remarks" varchar(500),
	"checked_at" timestamp DEFAULT now() NOT NULL
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
	"target_bpm" integer DEFAULT 120 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_time" varchar(10) NOT NULL,
	"end_time" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_lifecycle_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"status" varchar(20) NOT NULL,
	"row_count" integer DEFAULT 0,
	"details" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_sessions_archive" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"station" varchar(50) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	"original_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_batches_archive" (
	"id" uuid PRIMARY KEY NOT NULL,
	"batch_code" varchar(50) NOT NULL,
	"line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" varchar(50) NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	"original_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_logs_archive" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"station" varchar(50) NOT NULL,
	"primary_count" integer NOT NULL,
	"logged_at" timestamp NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	"original_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_of_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"quantity_per_unit" numeric(12, 6) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finished_goods_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'AVAILABLE' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"category_id" uuid,
	"item_name" varchar(150) NOT NULL,
	"sku" varchar(100),
	"unit" varchar(20) NOT NULL,
	"quantity" numeric(12, 2) DEFAULT '0' NOT NULL,
	"minimum_stock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"valuation_rate" numeric(12, 2) DEFAULT '0',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"quantity_change" numeric(12, 2) NOT NULL,
	"balance_after" numeric(12, 2) NOT NULL,
	"reference_id" varchar(150),
	"remarks" text,
	"performed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "material_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "packaging_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"bottles_per_case" integer NOT NULL,
	"shrink_weight_per_case_kg" numeric(6, 4) NOT NULL,
	"cartons_per_case" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_warehouse_id" uuid NOT NULL,
	"to_warehouse_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"transferred_by" uuid,
	"received_by" uuid,
	"transferred_at" timestamp DEFAULT now() NOT NULL,
	"received_at" timestamp,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(50) DEFAULT 'RAW_MATERIAL' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"type" "note_type" DEFAULT 'GENERAL' NOT NULL,
	"priority" "note_priority" DEFAULT 'LOW' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_by_role" varchar(50) NOT NULL,
	"department_id" uuid,
	"line_id" uuid,
	"machine_id" varchar(100),
	"production_batch_id" uuid,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(20),
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"credit_limit" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sales_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'DRAFT' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"total_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"order_date" timestamp DEFAULT now() NOT NULL,
	"delivery_date" timestamp,
	"created_by" uuid,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "sales_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"reference_number" varchar(100),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grn_id" uuid NOT NULL,
	"po_item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"batch_number" varchar(100),
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grn_number" varchar(50) NOT NULL,
	"po_id" uuid,
	"vendor_id" uuid NOT NULL,
	"received_date" timestamp DEFAULT now() NOT NULL,
	"status" "grn_status" DEFAULT 'COMPLETED' NOT NULL,
	"received_by" uuid,
	"invoice_number" varchar(100),
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipts_grn_number_unique" UNIQUE("grn_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"received_quantity" numeric(12, 3) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_number" varchar(50) NOT NULL,
	"vendor_id" uuid NOT NULL,
	"status" "po_status" DEFAULT 'DRAFT' NOT NULL,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"expected_delivery" timestamp,
	"total_amount" numeric(15, 2) DEFAULT '0',
	"created_by" uuid,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(50),
	"contact_person" varchar(100),
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"tax_id" varchar(50),
	"payment_terms" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lines" ADD CONSTRAINT "user_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lines" ADD CONSTRAINT "user_lines_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changeover_logs" ADD CONSTRAINT "changeover_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changeover_logs" ADD CONSTRAINT "changeover_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_states" ADD CONSTRAINT "machine_states_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_ended_by_users_id_fk" FOREIGN KEY ("ended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_brand_id_product_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."product_brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_adjusted_by_users_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_outgoing_operator_id_users_id_fk" FOREIGN KEY ("outgoing_operator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_incoming_operator_id_users_id_fk" FOREIGN KEY ("incoming_operator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_outgoing_session_id_operator_sessions_id_fk" FOREIGN KEY ("outgoing_session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_handovers" ADD CONSTRAINT "shift_handovers_incoming_session_id_operator_sessions_id_fk" FOREIGN KEY ("incoming_session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_totals" ADD CONSTRAINT "batch_totals_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_totals" ADD CONSTRAINT "batch_totals_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD CONSTRAINT "dispatch_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_logs" ADD CONSTRAINT "dispatch_logs_dispatch_manager_id_users_id_fk" FOREIGN KEY ("dispatch_manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials_usage" ADD CONSTRAINT "materials_usage_log_id_production_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."production_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials_usage" ADD CONSTRAINT "materials_usage_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_logs" ADD CONSTRAINT "packaging_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_logs" ADD CONSTRAINT "packaging_logs_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_brand_id_product_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."product_brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_session_id_operator_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_product_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."product_brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_stock_id_inventory_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."inventory_stock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods_inventory" ADD CONSTRAINT "finished_goods_inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods_inventory" ADD CONSTRAINT "finished_goods_inventory_warehouse_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_warehouse_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_stock_id_inventory_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."inventory_stock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_configurations" ADD CONSTRAINT "packaging_configurations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_warehouse_locations_id_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_warehouse_locations_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_stock_id_inventory_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."inventory_stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_transferred_by_users_id_fk" FOREIGN KEY ("transferred_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_production_batch_id_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."production_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_grn_id_goods_receipts_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_po_item_id_purchase_order_items_id_fk" FOREIGN KEY ("po_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_role_permissions" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "idx_user_lines" ON "user_lines" USING btree ("user_id","line_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_changeover_batch" ON "changeover_logs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_changeover_line" ON "changeover_logs" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "idx_downtime_batch" ON "downtime_logs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_downtime_line" ON "downtime_logs" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "idx_downtime_active" ON "downtime_logs" USING btree ("batch_id","end_time");--> statement-breakpoint
CREATE INDEX "idx_downtime_time" ON "downtime_logs" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_downtime_deleted" ON "downtime_logs" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_machine_states_line_station" ON "machine_states" USING btree ("line_id","station");--> statement-breakpoint
CREATE INDEX "idx_operator_sessions_user" ON "operator_sessions" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_operator_sessions_line" ON "operator_sessions" USING btree ("line_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_operator_sessions_batch" ON "operator_sessions" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_operator_sessions_unique_active"
ON "operator_sessions"
USING btree ("user_id","line_id","station_type")
WHERE "operator_sessions"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_batches_line_status" ON "production_batches" USING btree ("line_id","status");--> statement-breakpoint
CREATE INDEX "idx_batches_product" ON "production_batches" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_batches_code" ON "production_batches" USING btree ("batch_code");--> statement-breakpoint
CREATE INDEX "idx_batches_deleted" ON "production_batches" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_shift_handovers_line_station" ON "shift_handovers" USING btree ("line_id","station");--> statement-breakpoint
CREATE INDEX "idx_shift_handovers_batch" ON "shift_handovers" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_batch" ON "dispatch_logs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("is_read","created_at");--> statement-breakpoint
CREATE INDEX "idx_packaging_batch" ON "packaging_logs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_production_logs_batch" ON "production_logs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_production_logs_brand_product" ON "production_logs" USING btree ("brand_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_production_logs_line_shift" ON "production_logs" USING btree ("line_id","shift_id","brand_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_production_logs_station" ON "production_logs" USING btree ("station");--> statement-breakpoint
CREATE INDEX "idx_production_logs_request" ON "production_logs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_production_logs_date" ON "production_logs" USING btree ("logged_at");--> statement-breakpoint
CREATE INDEX "idx_production_logs_session" ON "production_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_production_logs_deleted" ON "production_logs" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_production_logs_status" ON "production_logs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lines_name" ON "production_lines" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_lines_status" ON "production_lines" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_archive_sessions_user" ON "operator_sessions_archive" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_archive_batch_code" ON "production_batches_archive" USING btree ("batch_code");--> statement-breakpoint
CREATE INDEX "idx_archive_batch_date" ON "production_batches_archive" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_archive_logs_batch" ON "production_logs_archive" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_archive_logs_date" ON "production_logs_archive" USING btree ("logged_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_inventory_sku" ON "inventory_stock" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "idx_notes_created_by" ON "notes" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_notes_type" ON "notes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_notes_priority" ON "notes" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_notes_line" ON "notes" USING btree ("line_id");--> statement-breakpoint
CREATE INDEX "idx_notes_batch" ON "notes" USING btree ("production_batch_id");--> statement-breakpoint
CREATE INDEX "idx_notes_created_at" ON "notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_customer" ON "sales_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_date" ON "sales_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_status" ON "sales_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_po_vendor" ON "purchase_orders" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_po_status" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_po_number" ON "purchase_orders" USING btree ("po_number");