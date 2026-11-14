-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('HOLIDAY', 'BREAK', 'UNAVAILABLE', 'CUSTOM_HOURS');

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PATIENT',
    "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "refresh_token_hash" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "patients" (
    "patient_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone_number" VARCHAR(30) NOT NULL,
    "date_of_birth" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("patient_id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "doctor_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "specialization" VARCHAR(150) NOT NULL,
    "professional_license_number" VARCHAR(100),
    "profile_status" "ProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("doctor_id")
);

-- CreateTable
CREATE TABLE "medical_services" (
    "service_id" UUID NOT NULL,
    "service_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "service_status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medical_services_pkey" PRIMARY KEY ("service_id")
);

-- CreateTable
CREATE TABLE "doctor_services" (
    "doctor_service_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_services_pkey" PRIMARY KEY ("doctor_service_id")
);

-- CreateTable
CREATE TABLE "doctor_schedules" (
    "schedule_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_time" VARCHAR(8) NOT NULL,
    "end_time" VARCHAR(8) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("schedule_id")
);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "exception_id" UUID NOT NULL,
    "doctor_id" UUID NOT NULL,
    "exception_date" DATE NOT NULL,
    "start_time" VARCHAR(8),
    "end_time" VARCHAR(8),
    "exception_type" "ExceptionType" NOT NULL,
    "reason" VARCHAR(255),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("exception_id")
);

-- CreateTable
CREATE TABLE "clinic_settings" (
    "setting_id" UUID NOT NULL,
    "clinic_name" VARCHAR(150) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
    "fixed_start_interval_minutes" INTEGER NOT NULL DEFAULT 15,
    "cancellation_cutoff_hours" INTEGER NOT NULL DEFAULT 24,
    "reminder_lead_hours" INTEGER NOT NULL DEFAULT 24,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clinic_settings_pkey" PRIMARY KEY ("setting_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_user_id_key" ON "doctors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "medical_services_service_name_key" ON "medical_services"("service_name");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_services_doctor_id_service_id_key" ON "doctor_services"("doctor_id", "service_id");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_services" ADD CONSTRAINT "doctor_services_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_services" ADD CONSTRAINT "doctor_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "medical_services"("service_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("doctor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_settings" ADD CONSTRAINT "clinic_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CheckConstraints
ALTER TABLE "medical_services" ADD CONSTRAINT "chk_medical_services_duration" CHECK (duration_minutes > 0 AND duration_minutes <= 480);
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "chk_doctor_schedules_day_of_week" CHECK (day_of_week >= 0 AND day_of_week <= 6);
ALTER TABLE "doctor_schedules" ADD CONSTRAINT "chk_doctor_schedules_time_window" CHECK (end_time > start_time);
ALTER TABLE "clinic_settings" ADD CONSTRAINT "chk_clinic_settings_interval" CHECK (fixed_start_interval_minutes IN (5, 10, 15, 20, 30, 60));
ALTER TABLE "clinic_settings" ADD CONSTRAINT "chk_clinic_settings_cutoff" CHECK (cancellation_cutoff_hours >= 0);
ALTER TABLE "clinic_settings" ADD CONSTRAINT "chk_clinic_settings_reminder" CHECK (reminder_lead_hours > 0);

