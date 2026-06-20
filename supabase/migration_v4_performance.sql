-- ============================================================
-- FusionFit Gym Management System — Performance Optimization Indexes
-- Run this in your Supabase SQL Editor to speed up database queries
-- ============================================================

-- Index on invoices member_id for fast foreign key lookups
CREATE INDEX IF NOT EXISTS idx_invoices_member_id ON public.invoices(member_id);

-- Index on invoices status for rapid collections aggregation
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- Index on invoices created_at for fast monthly trend calculations
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);

-- Index on parq_responses member_id for fast questionnaire retrieval
CREATE INDEX IF NOT EXISTS idx_parq_responses_member_id ON public.parq_responses(member_id);

-- Index on health_assessments member_id for fast medical assessment retrieval
CREATE INDEX IF NOT EXISTS idx_health_assessments_member_id ON public.health_assessments(member_id);

-- Index on members created_at for quick recent registration audits
CREATE INDEX IF NOT EXISTS idx_members_created_at ON public.members(created_at DESC);
