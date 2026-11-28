'use client';

import { useState } from 'react';
import type { SelfTest } from '@/lib/types';

interface Props {
  test: SelfTest;
  busy: boolean;
  onSubmit: (answers: number[]) => void;
  onCancel: () => void;
}

/** One question per screen. Conditional items that are not shown are submitted with their first option value. */
export function SelfTestRunner({ test, busy, onSubmit, onCancel }: Props) {
  const [answers, setAnswers] = useState<number[]>(() => Array(test.items.length).fill(-1));
  const [step, setStep] = useState(0);

  const visibleFor = (ans: number[]) =>
    test.items.flatMap((item, i) => (!item.showIf || ans[item.showIf.item] === item.showIf.value ? [i] : []));
  const visible = visibleFor(answers);
  const index = visible[Math.min(step, visible.length - 1)];
  const item = test.items[index];
  const options = item.options ?? test.options ?? [];
  const isLast = step >= visible.length - 1;
  const complete = visible.every((i) => answers[i] >= 0);
  const forcedChoice = Boolean(item.options);
  const sectionIndex = [...visible.slice(0, step + 1)].reverse().find((i) => test.items[i].section !== undefined);
  const section = sectionIndex !== undefined ? test.items[sectionIndex].section : undefined;

  function choose(value: number) {
    const next = answers.map((a, i) => (i === index ? value : a));
    setAnswers(next);
    if (step < visibleFor(next).length - 1) setTimeout(() => setStep((s) => s + 1), 180);
  }

  function submit() {
    onSubmit(answers.map((a, i) => (a >= 0 ? a : (test.items[i].options ?? test.options ?? [{ value: 0 }])[0].value)));
  }

  return (
    <div className="card space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>
            Pertanyaan {step + 1} dari {visible.length}
          </span>
          <button type="button" onClick={onCancel} className="hover:text-red-600">
            Berhenti
          </button>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div
            className="h-full rounded-full bg-teal-600 transition-all"
            style={{ width: `${((step + (answers[index] >= 0 ? 1 : 0)) / visible.length) * 100}%` }}
          />
        </div>
      </div>

      {section && <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{section}</p>}
      <p className="text-sm text-slate-500">{test.prompt}</p>

      <fieldset className="space-y-3">
        <legend className="text-lg font-medium text-slate-900">{item.text}</legend>
        <div className={forcedChoice ? 'grid gap-3' : 'grid gap-2'}>
          {options.map((o) => {
            const selected = answers[index] === o.value;
            return (
              <label
                key={o.value}
                className={`cursor-pointer rounded-lg border px-4 ${forcedChoice ? 'py-4' : 'py-2.5'} text-sm transition ${
                  selected ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-200 hover:border-teal-400'
                }`}
              >
                <input
                  type="radio"
                  name={`item-${index}`}
                  className="sr-only"
                  checked={selected}
                  onChange={() => choose(o.value)}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-sm text-slate-600 hover:text-teal-700 disabled:opacity-40"
        >
          ← Sebelumnya
        </button>
        {isLast ? (
          <button type="button" onClick={submit} disabled={!complete || busy} className="btn-primary">
            {busy ? 'Menghitung...' : 'Lihat hasil'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={answers[index] < 0}
            className="text-sm font-medium text-teal-700 hover:underline disabled:opacity-40"
          >
            Berikutnya →
          </button>
        )}
      </div>
    </div>
  );
}
