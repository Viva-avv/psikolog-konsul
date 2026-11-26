import type { AssessmentSummary } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

export function SummaryView({ summary }: { summary: AssessmentSummary }) {
  return (
    <dl className="space-y-2 text-sm">
      <div>
        <dt className="text-slate-500">Keluhan utama</dt>
        <dd>{summary.chiefComplaint}</dd>
      </div>
      {summary.keyThemes.length > 0 && (
        <div>
          <dt className="text-slate-500">Tema</dt>
          <dd>{summary.keyThemes.join(', ')}</dd>
        </div>
      )}
      {summary.duration && (
        <div>
          <dt className="text-slate-500">Durasi</dt>
          <dd>{summary.duration}</dd>
        </div>
      )}
      {summary.functionalImpact && (
        <div>
          <dt className="text-slate-500">Dampak fungsional</dt>
          <dd>{summary.functionalImpact}</dd>
        </div>
      )}
      {summary.userGoals && (
        <div>
          <dt className="text-slate-500">Harapan klien</dt>
          <dd>{summary.userGoals}</dd>
        </div>
      )}
      {summary.assessments.length > 0 && (
        <div>
          <dt className="text-slate-500">Skrining</dt>
          <dd>
            {summary.assessments
              .map((a) => `${a.type === 'PHQ9' ? 'PHQ-9' : 'GAD-7'}: ${a.score} (${a.severity})`)
              .join(' · ')}
          </dd>
        </div>
      )}
      <p className="pt-1 text-xs text-slate-400">
        Dibuat AI {formatDateTime(summary.createdAt)} · bukan diagnosis
      </p>
    </dl>
  );
}
