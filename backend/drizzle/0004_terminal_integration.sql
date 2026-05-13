CREATE TYPE "public"."terminal_type" AS ENUM('PRODUCTION', 'QC', 'MAINTENANCE', 'SUPERVISOR', 'KIOSK');--> statement-breakpoint
CREATE TYPE "public"."terminal_status" AS ENUM('OFFLINE', 'ONLINE', 'MAINTENANCE', 'LOCKED');--> statement-breakpoint
CREATE TABLE "terminals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "terminal_type" DEFAULT 'PRODUCTION' NOT NULL,
	"factory_id" uuid NOT NULL,
	"line_id" uuid,
	"department" varchar(50),
	"mac_address" varchar(50),
	"ip_address" varchar(50),
	"status" "terminal_status" DEFAULT 'OFFLINE' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "terminals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "terminal_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"terminal_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"auth_metadata" varchar(500)
);
--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD COLUMN "terminal_id" uuid;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "terminal_id" uuid;--> statement-breakpoint
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_terminal_id_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_sessions" ADD CONSTRAINT "terminal_sessions_supervisor_id_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_sessions" ADD CONSTRAINT "operator_sessions_terminal_id_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_terminal_id_terminals_id_fk" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_terminal_session_active" ON "terminal_sessions" USING btree ("terminal_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_operator_sessions_terminal" ON "operator_sessions" USING btree ("terminal_id");
