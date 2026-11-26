import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true,
      psychologistProfile: { select: { id: true, verificationStatus: true } },
    },
  });
  if (!user) throw notFound('Pengguna tidak ditemukan');
  return user;
}

export async function updateProfile(userId: string, data: { fullName?: string }) {
  await prisma.user.update({ where: { id: userId }, data });
  return getProfile(userId);
}
