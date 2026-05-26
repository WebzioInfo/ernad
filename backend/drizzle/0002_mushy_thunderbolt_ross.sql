CREATE TABLE "inventory_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stock_id" uuid NOT NULL,
	"batch_id" uuid,
	"user_id" uuid,
	"type" varchar(50) NOT NULL,
	"quantity_change" numeric(12, 4) NOT NULL,
	"balance_after" numeric(12, 4) NOT NULL,
	"remarks" varchar(255),
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" uuid,
	"deleted_reason" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "raw_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "batch_totals" ADD COLUMN "bags_total" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "cap_box_usage" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "raw_material_id" uuid;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "bags_used" numeric(8, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_stock_id_inventory_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."inventory_stock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ledger_stock" ON "inventory_ledger" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_batch" ON "inventory_ledger" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_time" ON "inventory_ledger" USING btree ("occurred_at");--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_raw_material_id_raw_materials_id_fk" FOREIGN KEY ("raw_material_id") REFERENCES "public"."raw_materials"("id") ON DELETE no action ON UPDATE no action;