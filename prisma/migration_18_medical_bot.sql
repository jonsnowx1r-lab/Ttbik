-- MEDICAL_BOT — clinics, hospitals (with departments), pharmacies,
-- appointment booking, and a location-based directory (owner spec,
-- 2026-09-04). Fully independent tables from every other bot. Run once
-- in Supabase's SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS "MedUser" (
    "id"            TEXT NOT NULL,
    "botId"         TEXT NOT NULL,
    "role"          TEXT NOT NULL DEFAULT 'PATIENT',
    "fullName"      TEXT,
    "phone"         TEXT,
    "pendingAction" JSONB,
    "isBanned"      BOOLEAN NOT NULL DEFAULT false,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MedPatientProfile" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "gender"     TEXT NOT NULL,
    "country"    TEXT NOT NULL,
    "province"   TEXT NOT NULL,
    "city"       TEXT NOT NULL,
    "area"       TEXT NOT NULL,
    "latitude"   DOUBLE PRECISION NOT NULL,
    "longitude"  DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedPatientProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MedPatientProfile_userId_key" ON "MedPatientProfile"("userId");

CREATE TABLE IF NOT EXISTS "MedFacility" (
    "id"         TEXT NOT NULL,
    "ownerId"    TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "phone"      TEXT NOT NULL,
    "country"    TEXT NOT NULL,
    "province"   TEXT NOT NULL,
    "city"       TEXT NOT NULL,
    "area"       TEXT NOT NULL,
    "address"    TEXT NOT NULL,
    "latitude"   DOUBLE PRECISION NOT NULL,
    "longitude"  DOUBLE PRECISION NOT NULL,
    "isDuty"     BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedFacility_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MedFacility_ownerId_key" ON "MedFacility"("ownerId");

CREATE TABLE IF NOT EXISTS "MedDepartment" (
    "id"         TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MedDoctor" (
    "id"           TEXT NOT NULL,
    "facilityId"   TEXT,
    "departmentId" TEXT,
    "name"         TEXT NOT NULL,
    "specialty"    TEXT NOT NULL,
    "workingDays"  TEXT NOT NULL,
    "workingHours" TEXT NOT NULL,
    "feeUsd"       DOUBLE PRECISION,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedDoctor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MedAppointment" (
    "id"              TEXT NOT NULL,
    "patientId"       TEXT NOT NULL,
    "doctorId"        TEXT NOT NULL,
    "appointmentAt"   TIMESTAMP(3) NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'PENDING',
    "notes"           TEXT,
    "reminder24hSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder1hSent"  BOOLEAN NOT NULL DEFAULT false,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedAppointment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MedPrescriptionQuery" (
    "id"             TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "facilityId"     TEXT NOT NULL,
    "patientMessage" TEXT NOT NULL,
    "reply"          TEXT,
    "status"         TEXT NOT NULL DEFAULT 'PENDING',
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedPrescriptionQuery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MedActivationCode" (
    "id"         TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "role"       TEXT NOT NULL,
    "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedBy" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedActivationCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MedActivationCode_code_key" ON "MedActivationCode"("code");

-- Foreign keys (IF NOT EXISTS via DO-block since Postgres has no native
-- "ADD CONSTRAINT IF NOT EXISTS"). Only the structural ownership relations
-- get a hard FK, same selective approach as migration_16_jobs_bot.sql —
-- the transactional/log tables (MedAppointment, MedPrescriptionQuery)
-- stay plain string references, consistent with StoreOrder/JobsDispute/
-- JobsReport there.
DO $$ BEGIN
    ALTER TABLE "MedPatientProfile" ADD CONSTRAINT "MedPatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MedUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MedFacility" ADD CONSTRAINT "MedFacility_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "MedUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MedDepartment" ADD CONSTRAINT "MedDepartment_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "MedFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MedDoctor" ADD CONSTRAINT "MedDoctor_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "MedFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "MedDoctor" ADD CONSTRAINT "MedDoctor_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "MedDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grants — required for Supabase's service_role to read/write these
-- tables (RLS bypass alone is not enough, an explicit GRANT is required).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MedUser" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MedPatientProfile" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MedFacility" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MedDepartment" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MedDoctor" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MedAppointment" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MedPrescriptionQuery" TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "MedActivationCode" TO service_role;
