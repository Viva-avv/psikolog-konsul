import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SPECIALIZATIONS: Array<[string, string]> = [
  ['kecemasan', 'Kecemasan'],
  ['depresi', 'Depresi & Suasana Hati'],
  ['stres-burnout', 'Stres & Burnout'],
  ['hubungan-keluarga', 'Hubungan & Keluarga'],
  ['pernikahan', 'Pernikahan & Pasangan'],
  ['trauma', 'Trauma'],
  ['duka', 'Duka & Kehilangan'],
  ['remaja', 'Remaja'],
  ['adiksi', 'Adiksi'],
  ['pengembangan-diri', 'Pengembangan Diri & Karier'],
];

async function main() {
  for (const [slug, name] of SPECIALIZATIONS) {
    await prisma.specialization.upsert({ where: { slug }, update: { name }, create: { slug, name } });
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 10 chars) must be set');
  }
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: 'ADMIN',
      fullName: 'Administrator',
    },
  });
  console.log(`Seeded ${SPECIALIZATIONS.length} specializations and admin ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
