-- Migration: 0006_operator_session_unique_constraint.sql
-- Adds a conditional unique index to operator_sessions to enforce that each
-- operator (user_id) can only have ONE active session at a time.
-- This prevents duplicate session race conditions at the database level.
-- Safe: Only applies to rows where is_active = true. Historical inactive rows are unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS "idx_operator_sessions_unique_active"
  ON "operator_sessions" ("user_id")
  WHERE "is_active" = true;
