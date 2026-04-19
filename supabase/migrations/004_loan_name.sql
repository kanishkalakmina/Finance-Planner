-- Migration 004: Add name field to loans
ALTER TABLE loans ADD COLUMN IF NOT EXISTS name text;
