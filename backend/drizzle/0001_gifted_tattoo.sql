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
DROP INDEX "idx_sessions_user";--> statement-breakpoint
DROP INDEX "idx_sessions_active";--> statement-breakpoint
ALTER TABLE "operator_sessions" ALTER COLUMN "shift_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_sessions" ALTER COLUMN "factory_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_sessions" ALTER COLUMN "login_time" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "operator_sessions" ALTER COLUMN "login_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD COLUMN "shift_id" uuid;--> statement-breakpoint
ALTER TABLE "production_batches" ADD COLUMN "material_return" jsonb;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "target_bpm" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "station_type" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "start_time" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "end_time" timestamp;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "ended_by" uuid;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "end_reason" varchar(100);--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "last_activity_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_archive_sessions_user" ON "operator_sessions_archive" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_archive_batch_code" ON "production_batches_archive" USING btree ("batch_code");--> statement-breakpoint
CREATE INDEX "idx_archive_batch_date" ON "production_batches_archive" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_archive_logs_batch" ON "production_logs_archive" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_archive_logs_date" ON "production_logs_archive" USING btree ("logged_at");--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_session_id_operator_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."operator_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_batch_id_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."production_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_ended_by_users_id_fk" FOREIGN KEY ("ended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_production_logs_session" ON "production_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_operator_sessions_user" ON "operator_sessions" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_operator_sessions_line" ON "operator_sessions" USING btree ("line_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_operator_sessions_batch" ON "operator_sessions" USING btree ("batch_id");