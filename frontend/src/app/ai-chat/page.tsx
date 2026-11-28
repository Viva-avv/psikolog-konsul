'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { AiDisclaimer } from '@/components/AiDisclaimer';
import { CrisisPanel } from '@/components/CrisisPanel';
import { api, ApiError } from '@/lib/api';
import { useConsents } from '@/lib/use-consents';
import { formatDateTime } from '@/lib/format';
import type { ChatMessage, ChatResult, CrisisInfo } from '@/lib/types';

const MAX_CHARS = 2000;
const EPHEMERAL_HISTORY = 19;

interface Conversation {
  id: string;
  status: 'ACTIVE' | 'CRISIS_LOCKED' | 'CLOSED';
  updatedAt: string;
}

function ConsentCard({ onAccept }: { onAccept: (store: boolean) => Promise<void> }) {
  const [store, setStore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Sebelum mulai bercerita</h1>
      <AiDisclaimer />
      <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
        <li>Pesan Anda diproses oleh model AI (Ollama) yang berjalan di server platform, tidak dikirim ke penyedia AI pihak ketiga.</li>
        <li>AI tidak memberi diagnosis atau saran obat, dan akan mengarahkan Anda ke psikolog bila perlu.</li>
        <li>Jika ada risiko keselamatan, chat beralih ke pilihan respons keselamatan dan kontak bantuan. Admin hanya menerima catatan insiden tanpa isi percakapan.</li>
      </ul>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={store} onChange={(e) => setStore(e.target.checked)} className="mt-1" />
        <span>
          Simpan riwayat chat (terenkripsi) agar bisa dilanjutkan nanti. Jika tidak dicentang, chat hilang saat halaman
          ditutup.
        </span>
      </label>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          await onAccept(store)
            .catch(() => setError('Gagal menyimpan persetujuan, coba lagi.'))
            .finally(() => setBusy(false));
        }}
        className="btn-primary w-full"
      >
        Saya setuju dan ingin mulai
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ChatWindow({ persistent }: { persistent: boolean }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [crisis, setCrisis] = useState<CrisisInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const r = await api<{ items: Conversation[] }>('/ai/conversations');
    setConversations(r.items);
    return r.items;
  }, []);

  const openConversation = useCallback(async (id: string) => {
    const r = await api<{ messages: ChatMessage[]; crisis?: CrisisInfo }>(`/ai/conversations/${id}/messages`);
    setActiveId(id);
    setMessages(r.messages);
    setCrisis(r.crisis ?? null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!persistent) return;
    loadConversations().then((items) => {
      const latest = items.find((c) => c.status !== 'CLOSED');
      if (latest) openConversation(latest.id);
    });
  }, [persistent, loadConversations, openConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, crisis]);

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setCrisis(null);
    setError(null);
  }

  async function deleteConversation(id: string) {
    if (!confirm('Hapus percakapan ini secara permanen?')) return;
    await api(`/ai/conversations/${id}`, { method: 'DELETE' });
    if (id === activeId) newConversation();
    loadConversations();
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const content = input.trim();
    if (!content || sending || crisis) return;

    const userMsg: ChatMessage = { role: 'user', content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setSending(true);
    setError(null);

    try {
      let result: ChatResult;
      if (persistent) {
        let id = activeId;
        if (!id) {
          id = (await api<{ conversation: { id: string } }>('/ai/conversations', { method: 'POST' })).conversation.id;
          setActiveId(id);
        }
        result = await api<ChatResult>(`/ai/conversations/${id}/messages`, { method: 'POST', body: { content } });
        loadConversations();
      } else {
        const payload = history
          .slice(-(EPHEMERAL_HISTORY + 1))
          .map((m) => (m.role === 'assistant' ? { role: m.role, content: m.content, sig: m.sig ?? '' } : { role: m.role, content: m.content }));
        result = await api<ChatResult>('/ai/chat/ephemeral', { method: 'POST', body: { messages: payload } });
      }

      if (result.type === 'CRISIS') setCrisis(result.crisis);
      else setMessages((prev) => [...prev, result.message]);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503
          ? 'Layanan AI sedang tidak tersedia. Jika Anda butuh bantuan segera, hubungi 119 ext. 8.'
          : err instanceof ApiError
            ? err.message
            : 'Gagal mengirim pesan',
      );
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className={`grid gap-4 ${persistent ? 'md:grid-cols-[14rem_1fr]' : ''}`}>
      {persistent && (
        <aside className="card self-start p-3">
          <button onClick={newConversation} className="btn-primary mb-3 w-full">
            Percakapan baru
          </button>
          <ul className="space-y-1 text-sm">
            {conversations.map((c) => (
              <li key={c.id} className="group flex items-center justify-between">
                <button
                  onClick={() => openConversation(c.id)}
                  className={`flex-1 truncate rounded px-2 py-1 text-left ${c.id === activeId ? 'bg-teal-50 text-teal-800' : 'hover:bg-slate-50'}`}
                >
                  {formatDateTime(c.updatedAt)}
                  {c.status === 'CRISIS_LOCKED' && ' ⚠'}
                </button>
                <button
                  onClick={() => deleteConversation(c.id)}
                  aria-label="Hapus percakapan"
                  className="px-1 text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <div className="card flex h-[70vh] flex-col p-0">
        <div className="border-b border-slate-200 p-3">
          <AiDisclaimer />
          {!persistent && (
            <p className="mt-2 text-xs text-slate-500">Mode tanpa simpan: riwayat hilang saat halaman ditutup.</p>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !crisis && (
            <p className="text-center text-sm text-slate-500">
              Halo, aku Teman Cerita. Apa yang sedang kamu rasakan hari ini?
            </p>
          )}
          {messages.map((m, i) => (
            <div key={m.id ?? i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <p
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.role === 'user' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-900'
                }`}
              >
                {m.content}
              </p>
            </div>
          ))}
          {sending && <p className="text-sm text-slate-400">Teman Cerita sedang mengetik...</p>}
          {crisis && <CrisisPanel key={activeId} crisis={crisis} />}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div ref={bottomRef} />
        </div>

        {!crisis && <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={MAX_CHARS}
            rows={2}
            placeholder="Tulis pesan... (Enter untuk kirim)"
            className="input flex-1 resize-none"
          />
          <button type="submit" disabled={sending || !input.trim()} className="btn-primary self-end">
            Kirim
          </button>
        </form>}
      </div>
    </div>
  );
}

function AiChat() {
  const { has, loading, grant } = useConsents();
  if (loading) return <p className="text-sm text-slate-500">Memuat...</p>;
  if (!has('AI_PROCESSING')) {
    return (
      <ConsentCard
        onAccept={async (store) => {
          await grant('AI_PROCESSING');
          if (store) await grant('STORE_AI_CHAT');
        }}
      />
    );
  }
  return <ChatWindow persistent={has('STORE_AI_CHAT')} />;
}

export default function AiChatPage() {
  return (
    <RequireRole roles={['USER']}>
      <AiChat />
    </RequireRole>
  );
}
