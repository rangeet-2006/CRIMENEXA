-- 002 - allow FORENSIC as an Evidence.document_category
--
-- Consolidating the two repositories brought in a FORENSIC category (the AI
-- service's /ingestion/forensic now accepts a file rather than raw text), so
-- the CHECK constraint has to be widened again for the same reason as 001:
-- Hibernate generates the constraint from the enum when it first creates the
-- table, and ddl-auto=update never ALTERs an existing one.
--
-- Migration 001 is append-only history at this point, so this is a separate
-- file rather than an edit to it. Running 002 alone is sufficient - it
-- redefines the whole constraint, it does not add to it.
--
-- Note: the new storage_path and processing_error columns need no migration.
-- ddl-auto=update adds nullable columns on its own; only constraints are the
-- problem.

BEGIN;

ALTER TABLE evidence
    DROP CONSTRAINT IF EXISTS evidence_document_category_check;

ALTER TABLE evidence
    ADD CONSTRAINT evidence_document_category_check
    CHECK (document_category IN (
        'FIR',
        'CALL_RECORDS',
        'BANK_RECORDS',
        'LOCATION',
        'SOCIAL_MEDIA',
        'SURVEILLANCE',
        'FORENSIC',
        'OTHER'
    ));

COMMIT;


-- Verify:
--
--   SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname = 'evidence_document_category_check';
