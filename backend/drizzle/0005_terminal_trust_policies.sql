-- Custom SQL Migration: Add Terminal Trust Policies & Device Identity
-- Eliminates hardware ID dependency in favor of flexible browser UUIDs and trust modes.

DO $$ BEGIN
 CREATE TYPE "public"."terminal_trust_mode" AS ENUM('STRICT_KIOSK', 'FLEXIBLE_AUTH', 'TEMPORARY_SESSION', 'MOBILE_OPERATOR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "terminals" ADD COLUMN IF NOT EXISTS "device_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "terminals" ADD COLUMN IF NOT EXISTS "trust_mode" "public"."terminal_trust_mode" DEFAULT 'STRICT_KIOSK' NOT NULL;
