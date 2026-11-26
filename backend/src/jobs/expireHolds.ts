import { logger } from '../lib/logger';
import { expireStaleHolds } from '../modules/bookings/bookings.service';

const INTERVAL_MS = 60_000;

export function startHoldExpiryJob() {
  const timer = setInterval(async () => {
    try {
      const expired = await expireStaleHolds();
      if (expired) logger.info({ expired }, 'Expired unpaid booking holds');
    } catch (err) {
      logger.error({ err }, 'Hold expiry job failed');
    }
  }, INTERVAL_MS);
  timer.unref();
  return timer;
}
