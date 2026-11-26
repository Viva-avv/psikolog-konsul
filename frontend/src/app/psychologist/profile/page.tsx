'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { PsychologistNav } from '@/components/PsychologistNav';
import { api, ApiError } from '@/lib/api';
import type { OwnProfile, Specialization } from '@/lib/types';

const MAX_SPECS = 5;

function ProfileForm() {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [specs, setSpecs] = useState<Specialization[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ profile: OwnProfile }>('/psychologists/me/profile').then((r) => {
      setProfile(r.profile);
      setSelected(r.profile.specializations.map((s) => s.id));
    });
    api<{ items: Specialization[] }>('/specializations').then((r) => setSpecs(r.items));
  }, []);

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_SPECS ? [...prev, id] : prev,
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    setMessage(null);
    try {
      const r = await api<{ profile: OwnProfile }>('/psychologists/me/profile', {
        method: 'PUT',
        body: {
          title: String(form.get('title') ?? ''),
          bio: String(form.get('bio') ?? ''),
          yearsExperience: Number(form.get('yearsExperience')),
          pricePerSession: Number(form.get('pricePerSession')),
          specializationIds: selected,
        },
      });
      setProfile(r.profile);
      setMessage({ ok: true, text: 'Profil tersimpan' });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Gagal menyimpan' });
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <form onSubmit={onSubmit} className="card max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Profil profesional</h1>
      <label className="block text-sm">
        Gelar / sebutan profesi
        <input name="title" defaultValue={profile.title ?? ''} maxLength={100} placeholder="M.Psi., Psikolog" className="input mt-1" />
      </label>
      <label className="block text-sm">
        Bio singkat
        <textarea name="bio" defaultValue={profile.bio ?? ''} maxLength={2000} rows={5} className="input mt-1" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          Pengalaman (tahun)
          <input name="yearsExperience" type="number" min={0} max={60} required defaultValue={profile.yearsExperience} className="input mt-1" />
        </label>
        <label className="block text-sm">
          Tarif per sesi (Rp)
          <input name="pricePerSession" type="number" min={0} step={1000} required defaultValue={profile.pricePerSession} className="input mt-1" />
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm">Spesialisasi (maks. {MAX_SPECS})</legend>
        <div className="flex flex-wrap gap-2">
          {specs.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                selected.includes(s.id) ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </fieldset>
      {message && <p className={`text-sm ${message.ok ? 'text-teal-700' : 'text-red-600'}`}>{message.text}</p>}
      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </button>
    </form>
  );
}

export default function PsychologistProfilePage() {
  return (
    <RequireRole roles={['PSYCHOLOGIST']}>
      <PsychologistNav />
      <ProfileForm />
    </RequireRole>
  );
}
