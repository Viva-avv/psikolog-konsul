'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { ConsentType } from './types';

export function useConsents() {
  const [active, setActive] = useState<Set<ConsentType>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const r = await api<{ items: Array<{ type: string; scopeRef: string | null }> }>('/consents');
    setActive(new Set(r.items.filter((c) => !c.scopeRef).map((c) => c.type as ConsentType)));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload().catch(() => setLoading(false));
  }, [reload]);

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
