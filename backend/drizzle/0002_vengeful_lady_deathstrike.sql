ALTER TYPE "public"."event_type" ADD VALUE 'DOWNTIME_PAUSE';--> statement-breakpoint
CREATE TABLE "finished_goods_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factory_id" uuid NOT NULL,
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
	"factory_id" uuid NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_number" varchar(100) NOT NULL,
	"supplier_name" varchar(255),
	"received_at" timestamp DEFAULT now() NOT NULL,
	"expiry_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "warehouse_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factory_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(50) DEFAULT 'RAW_MATERIAL' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_batches_code_global";--> statement-breakpoint
ALTER TABLE "batch_totals" ADD COLUMN "cap_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_totals" ADD COLUMN "preform_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_totals" ADD COLUMN "bop_roll_total" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_totals" ADD COLUMN "shrink_weight_total" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_totals" ADD COLUMN "finished_goods_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "batch_totals" ADD COLUMN "cases_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "cap_usage" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "cap_rejection" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "preform_usage" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "preform_rejection" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "bop_roll_usage" numeric(8, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "bop_rejection" numeric(8, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "shrink_weight_used" numeric(8, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "shrink_weight_rejected" numeric(8, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "cases_produced" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "packing_type_id" uuid;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "finished_goods_produced" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "material_cost" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "box_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "finished_goods_inventory" ADD CONSTRAINT "finished_goods_inventory_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods_inventory" ADD CONSTRAINT "finished_goods_inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods_inventory" ADD CONSTRAINT "finished_goods_inventory_warehouse_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_warehouse_id_warehouse_locations_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_stock_id_inventory_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."inventory_stock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_configurations" ADD CONSTRAINT "packaging_configurations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_inventory_sku" ON "inventory_stock" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_batches_code_factory" ON "production_batches" USING btree ("batch_code","factory_id");--> statement-breakpoint
ALTER TABLE "operator_sessions" DROP COLUMN "login_time";--> statement-breakpoint
ALTER TABLE "operator_sessions" DROP COLUMN "logout_time";--> statement-breakpoint
ALTER TABLE "production_batches" DROP COLUMN "production_date";