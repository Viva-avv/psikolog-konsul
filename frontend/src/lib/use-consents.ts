'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { ConsentType } from './types';

/** Pass `enabled = false` for visitors who cannot hold consents (signed out or non-USER roles). */
export function useConsents(enabled = true) {
  const [active, setActive] = useState<Set<ConsentType>>(new Set());
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    const r = await api<{ items: Array<{ type: string; scopeRef: string | null }> }>('/consents');
    setActive(new Set(r.items.filter((c) => !c.scopeRef).map((c) => c.type as ConsentType)));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setActive(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    reload().catch(() => setLoading(false));
  }, [enabled, reload]);

  const grant = useCallback(
    async (type: ConsentType) => {
      await api('/consents', { method: 'POST', body: { type } });
      await reload();
    },
    [reload],
  );

  const revoke = useCallback(
    async (type: ConsentType) => {
      await api(`/consents/${type}`, { method: 'DELETE' });
      await reload();
    },
    [reload],
  );

  return { active, has: (t: ConsentType) => active.has(t), loading, grant, revoke };
}
