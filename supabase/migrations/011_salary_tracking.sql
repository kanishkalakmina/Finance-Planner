-- Migration 011: Add next_salary_date to profiles for salary countdown
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS next_salary_date date;
