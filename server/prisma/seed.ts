// ==============================================================================
// Appointly — Database Seed Script
// ==============================================================================
// Reference: System-Level SDS Section 3.4 & Sprint 1 Engineering Contracts
// Populates idempotent synthetic seed data for local development and CI testing.
// ==============================================================================

import {
  PrismaClient,
  Role,
  AccountStatus,
  ProfileStatus,
  ServiceStatus,
} from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!';

async function main() {
  console.log('Appointly database seed: Starting seeding process...');

  // 1. Hash default password using Argon2id
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD);
  console.log('Appointly database seed: Argon2 password hash generated.');

  // 2. Seed Administrator Account (admin@appointly.local)
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@appointly.local').toLowerCase().trim();
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: Role.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      accountStatus: AccountStatus.ACTIVE,
    },
  });
  console.log(`Appointly database seed: Seeded Admin user -> ${adminUser.email}`);

  // 3. Seed Doctor Account & Profile (doctor@appointly.local)
  const doctorEmail = 'doctor@appointly.local';
  const doctorUser = await prisma.user.upsert({
    where: { email: doctorEmail },
    update: {
      passwordHash,
      role: Role.DOCTOR,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      email: doctorEmail,
      passwordHash,
      role: Role.DOCTOR,
      accountStatus: AccountStatus.ACTIVE,
    },
  });

  const doctorProfile = await prisma.doctor.upsert({
    where: { userId: doctorUser.userId },
    update: {
      fullName: 'Dr. Somchai Prasert',
      specialization: 'General Practice',
      professionalLicenseNumber: 'MD-10001',
      profileStatus: ProfileStatus.ACTIVE,
    },
    create: {
      userId: doctorUser.userId,
      fullName: 'Dr. Somchai Prasert',
      specialization: 'General Practice',
      professionalLicenseNumber: 'MD-10001',
      profileStatus: ProfileStatus.ACTIVE,
    },
  });
  console.log(`Appointly database seed: Seeded Doctor user & profile -> ${doctorUser.email} (${doctorProfile.fullName})`);

  // Also seed alias doctor.somchai@appointly.local for STS-S1-001/SDS compatibility
  const somchaiEmail = 'doctor.somchai@appointly.local';
  const somchaiUser = await prisma.user.upsert({
    where: { email: somchaiEmail },
    update: {
      passwordHash,
      role: Role.DOCTOR,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      email: somchaiEmail,
      passwordHash,
      role: Role.DOCTOR,
      accountStatus: AccountStatus.ACTIVE,
    },
  });

  const somchaiProfile = await prisma.doctor.upsert({
    where: { userId: somchaiUser.userId },
    update: {
      fullName: 'Dr. Somchai Prasert (Lead)',
      specialization: 'Internal Medicine',
      professionalLicenseNumber: 'MD-10002',
      profileStatus: ProfileStatus.ACTIVE,
    },
    create: {
      userId: somchaiUser.userId,
      fullName: 'Dr. Somchai Prasert (Lead)',
      specialization: 'Internal Medicine',
      professionalLicenseNumber: 'MD-10002',
      profileStatus: ProfileStatus.ACTIVE,
    },
  });
  console.log(`Appointly database seed: Seeded secondary Doctor -> ${somchaiUser.email}`);

  // 4. Seed Patient Account & Profile (patient@appointly.local)
  const patientEmail = 'patient@appointly.local';
  const patientUser = await prisma.user.upsert({
    where: { email: patientEmail },
    update: {
      passwordHash,
      role: Role.PATIENT,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      email: patientEmail,
      passwordHash,
      role: Role.PATIENT,
      accountStatus: AccountStatus.ACTIVE,
    },
  });

  const patientProfile = await prisma.patient.upsert({
    where: { userId: patientUser.userId },
    update: {
      fullName: 'Arisa Wongsuwan',
      phoneNumber: '0812345678',
      dateOfBirth: new Date('1995-05-15'),
    },
    create: {
      userId: patientUser.userId,
      fullName: 'Arisa Wongsuwan',
      phoneNumber: '0812345678',
      dateOfBirth: new Date('1995-05-15'),
    },
  });
  console.log(`Appointly database seed: Seeded Patient user & profile -> ${patientUser.email} (${patientProfile.fullName})`);

  // Also seed alias patient.arisa@appointly.local for STS-S1-004 compatibility
  const arisaEmail = 'patient.arisa@appointly.local';
  const arisaUser = await prisma.user.upsert({
    where: { email: arisaEmail },
    update: {
      passwordHash,
      role: Role.PATIENT,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      email: arisaEmail,
      passwordHash,
      role: Role.PATIENT,
      accountStatus: AccountStatus.ACTIVE,
    },
  });

  await prisma.patient.upsert({
    where: { userId: arisaUser.userId },
    update: {
      fullName: 'Arisa Wongsuwan',
      phoneNumber: '0891234567',
      dateOfBirth: new Date('1992-08-20'),
    },
    create: {
      userId: arisaUser.userId,
      fullName: 'Arisa Wongsuwan',
      phoneNumber: '0891234567',
      dateOfBirth: new Date('1992-08-20'),
    },
  });
  console.log(`Appointly database seed: Seeded secondary Patient -> ${arisaUser.email}`);

  // Seed inactive user for AC-F001-04 / STS-S1-001 boundary test
  const inactiveEmail = 'inactive@appointly.local';
  await prisma.user.upsert({
    where: { email: inactiveEmail },
    update: {
      passwordHash,
      role: Role.PATIENT,
      accountStatus: AccountStatus.INACTIVE,
    },
    create: {
      email: inactiveEmail,
      passwordHash,
      role: Role.PATIENT,
      accountStatus: AccountStatus.INACTIVE,
    },
  });
  console.log(`Appointly database seed: Seeded Inactive user -> ${inactiveEmail}`);

  // 5. Seed Singleton ClinicSetting
  // Values according to Contract & Request:
  // clinic_name = 'Appointly Clinic'
  // timezone = 'Asia/Bangkok'
  // fixed_start_interval_minutes = 15
  // cancellation_cutoff_hours = 24
  const existingSetting = await prisma.clinicSetting.findFirst();
  if (!existingSetting) {
    await prisma.clinicSetting.create({
      data: {
        clinicName: 'Appointly Clinic',
        timezone: 'Asia/Bangkok',
        fixedStartIntervalMinutes: 15,
        cancellationCutoffHours: 24,
        reminderLeadHours: 24,
        updatedBy: adminUser.userId,
      },
    });
    console.log('Appointly database seed: Default ClinicSetting created.');
  } else {
    await prisma.clinicSetting.update({
      where: { settingId: existingSetting.settingId },
      data: {
        clinicName: 'Appointly Clinic',
        timezone: 'Asia/Bangkok',
        fixedStartIntervalMinutes: 15,
        cancellationCutoffHours: 24,
        reminderLeadHours: 24,
        updatedBy: adminUser.userId,
      },
    });
    console.log('Appointly database seed: ClinicSetting updated.');
  }

  // 6. Seed Initial Medical Services (F-004)
  const servicesData = [
    {
      serviceName: 'General Consultation',
      description: 'Routine outpatient medical consultation and clinical assessment.',
      durationMinutes: 30,
      serviceStatus: ServiceStatus.ACTIVE,
    },
    {
      serviceName: 'Comprehensive Health Checkup',
      description: 'Full physical examination, vital signs, and health screening.',
      durationMinutes: 60,
      serviceStatus: ServiceStatus.ACTIVE,
    },
    {
      serviceName: 'Flu Vaccination',
      description: 'Seasonal influenza immunization and preventive vaccine injection.',
      durationMinutes: 15,
      serviceStatus: ServiceStatus.ACTIVE,
    },
  ];

  const seededServices = [];
  for (const s of servicesData) {
    const service = await prisma.medicalService.upsert({
      where: { serviceName: s.serviceName },
      update: {
        description: s.description,
        durationMinutes: s.durationMinutes,
        serviceStatus: s.serviceStatus,
      },
      create: s,
    });
    seededServices.push(service);
    console.log(`Appointly database seed: Seeded Service -> ${service.serviceName} (${service.durationMinutes}m)`);
  }

  // 7. Seed Doctor-Service Assignments (F-005)
  for (const doc of [doctorProfile, somchaiProfile]) {
    for (const service of seededServices) {
      await prisma.doctorService.upsert({
        where: {
          doctorId_serviceId: {
            doctorId: doc.doctorId,
            serviceId: service.serviceId,
          },
        },
        update: {},
        create: {
          doctorId: doc.doctorId,
          serviceId: service.serviceId,
        },
      });
    }
  }
  console.log('Appointly database seed: Doctor-Service assignments linked.');

  // 8. Seed Baseline Weekly Schedules for Doctor (F-006)
  // Monday (1) to Friday (5): Morning (09:00:00-12:00:00), Afternoon (13:00:00-17:00:00)
  const existingSchedules = await prisma.doctorSchedule.count({
    where: { doctorId: doctorProfile.doctorId },
  });

  if (existingSchedules === 0) {
    const shiftsToCreate = [];
    for (let day = 1; day <= 5; day++) {
      shiftsToCreate.push(
        {
          doctorId: doctorProfile.doctorId,
          dayOfWeek: day,
          startTime: '09:00:00',
          endTime: '12:00:00',
          isActive: true,
        },
        {
          doctorId: doctorProfile.doctorId,
          dayOfWeek: day,
          startTime: '13:00:00',
          endTime: '17:00:00',
          isActive: true,
        }
      );
    }

    for (const shift of shiftsToCreate) {
      await prisma.doctorSchedule.create({ data: shift });
    }
    console.log(`Appointly database seed: Seeded ${shiftsToCreate.length} baseline weekly shifts for doctor.`);
  }

  console.log('Appointly database seed: Successfully completed all seeding tasks! 🎉');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
