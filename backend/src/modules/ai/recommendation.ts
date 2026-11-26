import { prisma } from '../../lib/prisma';
import { publicSelect, toPublic, visibleWhere } from '../psychologists/psychologists.service';
import { BOOKING_MIN_LEAD_MINUTES } from '../bookings/bookings.schema';

const earliestBookable = () => new Date(Date.now() + BOOKING_MIN_LEAD_MINUTES * 60_000);

function withNextSlot(latest?: Date) {
  return {
    ...publicSelect,
    slots: {
      where: { status: 'AVAILABLE' as const, startAt: { gte: earliestBookable(), ...(latest && { lte: latest }) } },
      orderBy: { startAt: 'asc' as const },
      take: 1,
      select: { id: true, startAt: true, endAt: true },
    },
  };
}

/** Ranks verified psychologists by specialization match, then soonest availability, then experience. */
export async function recommendPsychologists(slugs: string[], limit = 5) {
  const query = (filter: string[]) =>
    prisma.psychologistProfile.findMany({
      where: {
        ...visibleWhere,
        ...(filter.length && { specializations: { some: { specialization: { slug: { in: filter } } } } }),
      },
      select: withNextSlot(),
      take: 50,
    });
  let rows = await query(slugs);
  if (!rows.length && slugs.length) rows = await query([]);

  return rows
    .map(({ slots, ...row }) => ({
      ...toPublic(row),
      nextSlot: slots[0] ?? null,
      matchCount: row.specializations.filter((s) => slugs.includes(s.specialization.slug)).length,
    }))
    .sort(
      (a, b) =>
        b.matchCount - a.matchCount ||
        Number(Boolean(b.nextSlot)) - Number(Boolean(a.nextSlot)) ||
        (a.nextSlot?.startAt.getTime() ?? 0) - (b.nextSlot?.startAt.getTime() ?? 0) ||
        b.yearsExperience - a.yearsExperience,
    )
    .slice(0, limit);
}

/** Psychologists with a bookable slot in the next `hours`, soonest first (used by the crisis "book now" flow). */
export async function listAvailableSoon(hours = 24, limit = 10) {
  const latest = new Date(Date.now() + hours * 3_600_000);
  const rows = await prisma.psychologistProfile.findMany({
    where: {
      ...visibleWhere,
      slots: { some: { status: 'AVAILABLE', startAt: { gte: earliestBookable(), lte: latest } } },
    },
    select: withNextSlot(latest),
    take: 50,
  });
  return rows
    .map(({ slots, ...row }) => ({ ...toPublic(row), nextSlot: slots[0] }))
    .sort((a, b) => a.nextSlot.startAt.getTime() - b.nextSlot.startAt.getTime())
    .slice(0, limit);
}
