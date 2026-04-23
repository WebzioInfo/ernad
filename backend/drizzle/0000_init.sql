CREATE TYPE "public"."batch_status" AS ENUM('RUNNING', 'CHANGEOVER', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FILLING_OPERATOR', 'BLOWING_OPERATOR', 'LABELING_OPERATOR', 'PACKING_OPERATOR', 'OPERATOR');--> statement-breakpoint
CREATE TABLE "changeover_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"line_id" uuid,
	"from_product_id" uuid,
	"to_product_id" uuid,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"leftover_materials" jsonb NOT NULL,
	"wasted_materials" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "material_flows" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid,
	"material_name" varchar(100) NOT NULL,
	"issued" integer DEFAULT 0 NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"wasted" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "operator_blowing_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid,
	"operator_id" uuid,
	"preform_count" integer DEFAULT 0 NOT NULL,
	"bags_used" integer DEFAULT 0 NOT NULL,
	"damaged" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "operator_filling_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid,
	"operator_id" uuid,
	"bottle_count" integer DEFAULT 0 NOT NULL,
	"cap_wastage" integer DEFAULT 0 NOT NULL,
	"boxes_used" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "operator_labeling_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid,
	"operator_id" uuid,
	"label_count" integer DEFAULT 0 NOT NULL,
	"ink_used_ml" integer DEFAULT 0 NOT NULL,
	"makeup_used_ml" integer DEFAULT 0 NOT NULL,
	"cleaning_solution_used_ml" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "operator_packing_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid,
	"operator_id" uuid,
	"shrink_roll_used_kg" numeric(10, 2) DEFAULT '0' NOT NULL,
	"shrink_wastage_kg" numeric(10, 2) DEFAULT '0' NOT NULL,
	"packed_count" integer DEFAULT 0 NOT NULL,
	"logged_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'OPERATOR' NOT NULL,
	"operator_type" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "operators_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "production_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_id" uuid,
	"brand_id" uuid,
	"product_id" uuid,
	"shift_id" uuid,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" "batch_status" DEFAULT 'RUNNING',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "changeover_logs" ADD CONSTRAINT "changeover_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_flows" ADD CONSTRAINT "material_flows_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_blowing_logs" ADD CONSTRAINT "operator_blowing_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_filling_logs" ADD CONSTRAINT "operator_filling_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_labeling_logs" ADD CONSTRAINT "operator_labeling_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_packing_logs" ADD CONSTRAINT "operator_packing_logs_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE cascade ON UPDATE no action;