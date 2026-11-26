'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { getChatSocket } from '@/lib/socket';
import { formatTime } from '@/lib/format';

interface Message {
  id: string;
  senderRole: 'USER' | 'PSYCHOLOGIST' | 'ADMIN' | null;
  mine: boolean;
  content: string;
  createdAt: string;
}

type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

export function SessionChat({ bookingId, canSend }: { bookingId: string; canSend: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    api<{ items: Message[] }>(`/bookings/${bookingId}/messages`)
      .then((r) => setMessages(r.items))
      .catch((e: Error) => setError(e.message));

    const socket = getChatSocket();
    let typingTimer: ReturnType<typeof setTimeout>;

    const onConnect = () => {
      socket.emit('booking:join', { bookingId }, (res: Ack<unknown>) => {
        setConnected(res.ok);
        if (!res.ok) setError(res.error);
      });
    };
    const onDisconnect = () => setConnected(false);
    const onMessage = (m: Message) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    const onTyping = () => {
      setPeerTyping(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => setPeerTyping(false), 3000);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessage);
    socket.on('typing', onTyping);
    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      clearTimeout(typingTimer);
      socket.emit('booking:leave', { bookingId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessage);
      socket.off('typing', onTyping);
    };
  }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping]);

  function send(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    setError(null);
    getChatSocket().emit('message:send', { bookingId, content }, (res: Ack<Message>) => {
      if (res.ok) {
        setMessages((prev) => [...prev, res.data]);
        setInput('');
      } else {
        setError(res.error);
      }
    });
  }

  function onInput(value: string) {
    setInput(value);
    if (Date.now() - lastTypingSent.current > 2000) {
      lastTypingSent.current = Date.now();
      getChatSocket().emit('typing', { bookingId });
    }
  }

  return (
    <div className="card flex h-[60vh] flex-col p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm">
        <span className="font-medium">Chat sesi</span>
        <span className={connected ? 'text-teal-700' : 'text-slate-400'}>{connected ? '● Terhubung' : '○ Terputus'}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-center text-sm text-slate-400">Belum ada pesan.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.mine ? 'bg-teal-700 text-white' : 'bg-slate-100'}`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p className={`mt-1 text-[10px] ${m.mine ? 'text-teal-100' : 'text-slate-400'}`}>{formatTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
        {peerTyping && <p className="text-xs text-slate-400">Sedang mengetik...</p>}
        <div ref={bottomRef} />
      </div>
      {error && <p className="px-4 text-sm text-red-600">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          maxLength={2000}
          disabled={!canSend || !connected}
          placeholder={canSend ? 'Tulis pesan...' : 'Chat hanya aktif selama jadwal sesi'}
          className="input flex-1"
        />
        <button type="submit" disabled={!canSend || !connected || !input.trim()} className="btn-primary">
          Kirim
        </button>
      </form>
    </div>
  );
}
