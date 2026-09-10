-- 001 - allow LOCATION as an Evidence.document_category
--
-- WHY THIS IS NEEDED
--
-- Evidence.documentCategory is mapped @Enumerated(EnumType.STRING). Hibernate 6
-- generates a CHECK constraint enumerating the enum's values when it first
-- creates the table. spring.jpa.hibernate.ddl-auto=update adds new tables and
-- columns but never ALTERs an existing constraint - so after LOCATION was added
-- to the Java enum, the database still enforced the original six values and
-- rejected the insert:
--
--   ERROR: new row for relation "evidence"
--          violates check constraint "evidence_document_category_check"
--
-- There is no Flyway or Liquibase in this project, so this has to be applied by
-- hand (Supabase SQL editor, or psql).
--
-- THE SAME TRAP APPLIES TO EVERY OTHER STRING ENUM
--
-- Each of these columns carries its own generated CHECK constraint, and adding a
-- value to any of them will fail the same way until the constraint is altered:
--
--   alert.severity            (CRITICAL, HIGH, WARNING, INFO)
--   case_record.status        (ACTIVE, CLOSED)
--   case_record.priority      (CRITICAL, HIGH, MEDIUM, LOW)
--   evidence.document_category
--   evidence.status           (QUEUED, PROCESSING, EXTRACTED, FAILED)
--   report.type               (FULL_REPORT, GRAPH_EXPORT, FINANCIAL)
--   users.role                (ADMIN, SENIOR, FIELD)


-- Inspect the current constraint first (optional, for confirmation):
--
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'evidence'::regclass AND contype = 'c';


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
        'OTHER'
    ));

COMMIT;


-- Verify it took:
--
--   SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conname = 'evidence_document_category_check';
--
-- No redeploy is required - the constraint is enforced by the database, not the
-- application, so the next upload picks this up immediately.
