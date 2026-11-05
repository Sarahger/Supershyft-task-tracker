import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { reportsApi } from '../../services/endpoints';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toast';
import type { EvaluationRecord, EvaluationScore, KraParameter, KraRatingMeaning } from '../../types';

const FALLBACK_PARAMETERS: KraParameter[] = [
  { key: 'deadline_adherence', name: 'Deadline Adherence', weight: 30 },
  { key: 'quality_of_work', name: 'Quality of Work', weight: 25 },
  { key: 'discipline_process', name: 'Discipline & Process Adherence', weight: 15 },
  { key: 'ownership_accountability', name: 'Ownership & Accountability', weight: 15 },
  { key: 'teamwork_collaboration', name: 'Teamwork & Collaboration', weight: 10 },
  { key: 'punctuality', name: 'Punctuality', weight: 5 },
];

const RATING_PILL: Record<number, { selected: string; idle: string; text: string }> = {
  5: { selected: 'border border-emerald-400/50 bg-emerald-500/30 text-emerald-300', idle: 'border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15', text: 'text-emerald-400' },
  4: { selected: 'border border-lime-400/50 bg-lime-500/30 text-lime-300', idle: 'border border-lime-500/40 text-lime-400 hover:bg-lime-500/15', text: 'text-lime-400' },
  3: { selected: 'border border-amber-400/50 bg-amber-400/30 text-amber-200', idle: 'border border-amber-400/40 text-amber-300 hover:bg-amber-400/15', text: 'text-amber-300' },
  2: { selected: 'border border-orange-400/50 bg-orange-500/30 text-orange-300', idle: 'border border-orange-500/40 text-orange-400 hover:bg-orange-500/15', text: 'text-orange-400' },
  1: { selected: 'border border-red-400/50 bg-red-500/30 text-red-300', idle: 'border border-red-500/40 text-red-400 hover:bg-red-500/15', text: 'text-red-400' },
};

function ratingTone(rating?: number | null) {
  return rating != null ? RATING_PILL[rating] : undefined;
}

const FALLBACK_SCALE: KraRatingMeaning[] = [
  { rating: 5, meaning: 'Exceptional', interpretation: 'Consistently exceeds agreed expectations' },
  { rating: 4, meaning: 'Very Good', interpretation: 'Frequently exceeds expectations' },
  { rating: 3, meaning: 'Meets Expectations', interpretation: 'Reliably delivers what is expected' },
  { rating: 2, meaning: 'Needs Improvement', interpretation: 'Inconsistently meets expectations' },
  { rating: 1, meaning: 'Unsatisfactory', interpretation: 'Frequently falls significantly short of expectations' },
];

function currentMonth() {
  return format(new Date(), 'yyyy-MM');
}

function monthStart(month: string) {
  return `${month}-01`;
}

function monthLabel(value?: string | null) {
  if (!value) return '—';
  try {
    return format(parseISO(value.slice(0, 10)), 'MMMM yyyy');
  } catch {
    return value;
  }
}

function dateLabel(value?: string | null) {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'd MMM yyyy');
  } catch {
    return value;
  }
}

function previewScore(rating: number | null, weight: number) {
  if (rating == null) return null;
  return Math.round((rating / 5) * weight * 100) / 100;
}

function errorMessage(err: unknown, fallback: string) {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

type DraftScore = { parameter_key: string; name: string; weight: number; rating: number | null; remarks: string };

function blankScores(parameters: KraParameter[]): DraftScore[] {
  return parameters.map((row) => ({
    parameter_key: row.key,
    name: row.name,
    weight: row.weight,
    rating: null,
    remarks: '',
  }));
}

function scoresFromRecord(record: EvaluationRecord, parameters: KraParameter[]): DraftScore[] {
  return parameters.map((row) => {
    const existing = record.scores.find((score) => score.parameter_key === row.key);
    return {
      parameter_key: row.key,
      name: row.name,
      weight: row.weight,
      rating: existing?.rating ?? null,
      remarks: existing?.remarks ?? '',
    };
  });
}

export function EvaluationsPanel({
  departmentId,
  initialEvaluationId,
  onConsumedInitial,
}: {
  departmentId?: number;
  initialEvaluationId?: number | null;
  onConsumedInitial?: () => void;
}) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [editing, setEditing] = useState<EvaluationRecord | 'new' | null>(null);
  const [startUserId, setStartUserId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);

  const { data: list, isLoading } = useQuery({
    queryKey: ['evaluations', month, departmentId ?? null],
    queryFn: () => reportsApi.evaluations({
      period_start: monthStart(month),
      ...(departmentId ? { department_id: departmentId } : {}),
    }).then((r) => r.data.data),
  });

  const parameters = list?.parameters?.length ? list.parameters : FALLBACK_PARAMETERS;
  const scale = list?.rating_scale?.length ? list.rating_scale : FALLBACK_SCALE;
  const items = useMemo(() => {
    const rows = list?.items ?? [];
    if (!employeeFilter) return rows;
    return rows.filter((row) => row.user_id === Number(employeeFilter));
  }, [list, employeeFilter]);

  useEffect(() => {
    if (!initialEvaluationId) return;
    setViewId(initialEvaluationId);
    setEditing(null);
    onConsumedInitial?.();
  }, [initialEvaluationId, onConsumedInitial]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['evaluations'] });
    qc.invalidateQueries({ queryKey: ['evaluation'] });
    qc.invalidateQueries({ queryKey: ['evaluation-history'] });
    qc.invalidateQueries({ queryKey: ['reports-analytics'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Employee Evaluations</h2>
          <p className="text-xs text-text-muted mt-1">
            One monthly scorecard per employee. A rating of 3 means the employee meets expectations.
          </p>
        </div>
        <Button type="button" onClick={() => { setStartUserId(null); setEditing('new'); setViewId(null); }}>New Evaluation</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="input py-1.5 text-sm w-auto"
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          aria-label="Filter by employee"
        >
          <option value="">All employees</option>
          {(list?.items ?? []).map((row) => (
            <option key={row.user_id} value={row.user_id}>{row.name}</option>
          ))}
        </select>
        <input
          type="month"
          className="input py-1.5 text-sm w-auto"
          value={month}
          onChange={(e) => setMonth(e.target.value || currentMonth())}
          aria-label="Evaluation month"
        />
      </div>

      {editing && (
        <EvaluationForm
          mode={editing}
          month={month}
          employees={list?.items ?? []}
          initialUserId={startUserId}
          parameters={parameters}
          scale={scale}
          onClose={() => setEditing(null)}
          onSaved={(record) => {
            refresh();
            setEditing(null);
            setViewId(record.id);
          }}
        />
      )}

      {viewId != null && !editing && (
        <EvaluationDetail
          evaluationId={viewId}
          onClose={() => setViewId(null)}
          onEdit={(record) => setEditing(record)}
        />
      )}

      <section className="card overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-text-muted p-6">Loading evaluations…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border text-left">
                  <th className="px-4 py-3 text-2xs font-medium text-text-muted uppercase">Employee</th>
                  <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase">Department</th>
                  <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase">Evaluation period</th>
                  <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase">Overall score</th>
                  <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase">Status</th>
                  <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase">Last evaluated</th>
                  <th className="px-4 py-3 text-2xs font-medium text-text-muted uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-muted">No employees match these filters.</td>
                  </tr>
                )}
                {items.map((row) => (
                  <tr key={row.user_id} className="border-b border-dark-border">
                    <td className="px-4 py-3 text-text-primary">{row.name}</td>
                    <td className="px-3 py-3 text-text-secondary">{row.departments.length ? row.departments.join(', ') : '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{monthLabel(row.period_start)}</td>
                    <td className="px-3 py-3 tabular-nums">{row.overall_score == null ? '—' : `${row.overall_score}/100`}</td>
                    <td className="px-3 py-3 capitalize">{row.status.replace('_', ' ')}</td>
                    <td className="px-3 py-3 text-text-secondary">{dateLabel(row.last_evaluated_at)}</td>
                    <td className="px-4 py-3">
                      {row.evaluation_id ? (
                        <button type="button" className="text-accent-primary hover:underline" onClick={() => { setViewId(row.evaluation_id); setEditing(null); }}>
                          Open
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-accent-primary hover:underline"
                          onClick={() => { setStartUserId(row.user_id); setEditing('new'); setViewId(null); }}
                        >
                          Start
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function EvaluationForm({
  mode,
  month,
  employees,
  initialUserId,
  parameters,
  scale,
  onClose,
  onSaved,
}: {
  mode: EvaluationRecord | 'new';
  month: string;
  employees: { user_id: number; name: string; evaluation_id: number | null }[];
  initialUserId?: number | null;
  parameters: KraParameter[];
  scale: KraRatingMeaning[];
  onClose: () => void;
  onSaved: (record: EvaluationRecord) => void;
}) {
  const existing = mode === 'new' ? null : mode;
  const [userId, setUserId] = useState(existing ? String(existing.user_id) : initialUserId ? String(initialUserId) : '');
  const [period, setPeriod] = useState(existing ? existing.period_start.slice(0, 7) : month);
  const [comment, setComment] = useState(existing?.overall_comment ?? '');
  const [scores, setScores] = useState<DraftScore[]>(existing ? scoresFromRecord(existing, parameters) : blankScores(parameters));
  const [confirming, setConfirming] = useState(false);
  const [showRatingChart, setShowRatingChart] = useState(false);

  const total = scores.reduce((sum, row) => sum + (previewScore(row.rating, row.weight) ?? 0), 0);
  const complete = scores.every((row) => row.rating != null);

  const payload = () => ({
    user_id: Number(userId),
    period_start: monthStart(period),
    overall_comment: comment.trim() || null,
    scores: scores.map((row) => ({
      parameter_key: row.parameter_key,
      rating: row.rating,
      remarks: row.remarks.trim() || null,
    })),
  });

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      if (!userId) throw new Error('Select an employee');
      if (!period) throw new Error('Select an evaluation month');
      const body = payload();
      if (!existing) {
        const match = employees.find((row) => row.user_id === Number(userId) && row.evaluation_id && period === month);
        if (match?.evaluation_id) {
          const saved = await reportsApi.saveEvaluation(match.evaluation_id, body);
          if (!submit) return saved.data.data;
          const submitted = await reportsApi.submitEvaluation(match.evaluation_id, body);
          return submitted.data.data;
        }
        const created = await reportsApi.createEvaluation(body);
        if (!submit) return created.data.data;
        const submitted = await reportsApi.submitEvaluation(created.data.data.id, body);
        return submitted.data.data;
      }
      if (!submit) {
        const saved = await reportsApi.saveEvaluation(existing.id, body);
        return saved.data.data;
      }
      const submitted = await reportsApi.submitEvaluation(existing.id, body);
      return submitted.data.data;
    },
    onSuccess: (record, submit) => {
      toast.success(submit ? 'Evaluation submitted' : 'Draft saved');
      setConfirming(false);
      onSaved(record);
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not save evaluation')),
  });

  return (
    <section className="card p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-text-primary">{existing ? 'Edit evaluation' : 'New evaluation'}</h3>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowRatingChart((open) => !open)}
            className="text-sm text-accent-primary hover:underline"
          >
            Rating Chart
          </button>
          <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text-secondary">Cancel</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-2xs uppercase tracking-wider text-text-muted mb-1.5">Employee</span>
          <select className="input w-full text-sm" value={userId} onChange={(e) => setUserId(e.target.value)} disabled={Boolean(existing)}>
            <option value="">Select an employee</option>
            {employees.map((row) => (
              <option key={row.user_id} value={row.user_id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-2xs uppercase tracking-wider text-text-muted mb-1.5">Evaluation month</span>
          <input type="month" className="input w-full text-sm" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={Boolean(existing)} />
        </label>
      </div>

      {showRatingChart && (
        <div className="rounded-xl border border-dark-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-border text-left">
                <th className="px-3 py-2 text-text-muted">Rating</th>
                <th className="px-3 py-2 text-text-muted">Meaning</th>
                <th className="px-3 py-2 text-text-muted">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {scale.map((row) => (
                <tr key={row.rating} className="border-b border-dark-border last:border-0">
                  <td className="px-3 py-2 tabular-nums">{row.rating}</td>
                  <td className="px-3 py-2">{row.meaning}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.interpretation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <p className="shrink-0 text-sm text-text-primary">
          Overall score <span className="tabular-nums">{complete ? `${total}/100` : '—/100'}</span>
        </p>
        <input
          className="input w-full text-sm"
          placeholder="Overall comments"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {scores.map((row, index) => (
          <div key={row.parameter_key} className="rounded-lg border border-dark-border px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-text-primary leading-tight">{row.name}</p>
              <div className="flex shrink-0 gap-1">
                {scale.map((choice) => (
                  <button
                    key={choice.rating}
                    type="button"
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 ${row.rating === choice.rating ? ratingTone(choice.rating)?.selected : ratingTone(choice.rating)?.idle}`}
                    onClick={() => setScores((prev) => prev.map((item, i) => i === index ? { ...item, rating: choice.rating } : item))}
                  >
                    {choice.rating}
                  </button>
                ))}
              </div>
            </div>
            <input
              className="input w-full text-xs py-1"
              placeholder="Remarks"
              value={row.remarks}
              onChange={(e) => setScores((prev) => prev.map((item, i) => i === index ? { ...item, remarks: e.target.value } : item))}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" loading={save.isPending && !confirming} onClick={() => save.mutate(false)}>
          Save as Draft
        </Button>
        <Button type="button" onClick={() => setConfirming(true)} disabled={!complete || !userId}>
          Submit Evaluation
        </Button>
      </div>

      <Modal isOpen={confirming} onClose={() => setConfirming(false)} title="Submit evaluation" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Submit this scorecard for {monthLabel(monthStart(period))}? The overall score is {total}/100.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button type="button" loading={save.isPending} onClick={() => save.mutate(true)}>Submit</Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function EvaluationDetail({
  evaluationId,
  onClose,
  onEdit,
}: {
  evaluationId: number;
  onClose: () => void;
  onEdit: (record: EvaluationRecord) => void;
}) {
  const { data } = useQuery({
    queryKey: ['evaluation', evaluationId],
    queryFn: () => reportsApi.evaluation(evaluationId).then((r) => r.data.data),
  });
  const userId = data?.user_id;
  const { data: history } = useQuery({
    queryKey: ['evaluation-history', userId],
    queryFn: () => reportsApi.evaluationHistory(userId!).then((r) => r.data.data),
    enabled: userId != null,
  });

  if (!data) return <p className="text-sm text-text-muted">Loading evaluation…</p>;
  const submitted = (history?.evaluations ?? []).filter((row) => row.status === 'submitted');

  return (
    <section className="card p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{data.employee?.name ?? 'Evaluation'}</h3>
          <p className="text-xs text-text-muted mt-1">
            {data.department_snapshot || data.departments.join(', ') || 'No department'} · {monthLabel(data.period_start)} · {data.status}
          </p>
          <p className="text-xs text-text-muted mt-1">
            Evaluator {data.evaluator?.name ?? '—'} · Submitted {dateLabel(data.submitted_at)}
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="text-sm text-accent-primary hover:underline" onClick={() => onEdit(data)}>Edit</button>
          <button type="button" className="text-sm text-text-muted hover:text-text-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-2xl font-semibold tabular-nums text-text-primary">
          {data.overall_score == null ? '—' : `${data.overall_score}/100`}
        </p>
        <p className="text-sm text-text-secondary sm:max-w-xl sm:text-right">
          {data.overall_comment || 'No overall remarks'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {data.scores.map((score: EvaluationScore) => (
          <div key={score.parameter_key} className="flex items-center justify-between gap-3 rounded-lg border border-dark-border px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-text-primary leading-tight">{score.name}</p>
              <p className={`mt-0.5 text-xs ${ratingTone(score.rating)?.text ?? 'text-text-muted'}`}>{score.rating ?? '—'}/5</p>
              <p className="mt-1 text-xs text-text-secondary">{score.remarks || '—'}</p>
            </div>
            <p className={`shrink-0 text-2xl font-semibold tabular-nums ${ratingTone(score.rating)?.text ?? 'text-text-primary'}`}>
              {score.weighted_score ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {submitted.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Score comparison</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border text-left">
                  <th className="px-3 py-2 text-text-muted">Parameter</th>
                  {submitted.map((row) => (
                    <th key={row.id} className="px-3 py-2 text-text-muted">{monthLabel(row.period_start)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FALLBACK_PARAMETERS.map((parameter) => (
                  <tr key={parameter.key} className="border-b border-dark-border">
                    <td className="px-3 py-2">{parameter.name}</td>
                    {submitted.map((row) => {
                      const score = row.scores.find((item) => item.parameter_key === parameter.key);
                      return <td key={row.id} className="px-3 py-2 tabular-nums">{score?.rating ?? '—'}</td>;
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="px-3 py-2 font-medium">Overall</td>
                  {submitted.map((row) => (
                    <td key={row.id} className="px-3 py-2 tabular-nums">{row.overall_score ?? '—'}/100</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(data.revisions?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Previous versions</p>
          {data.revisions?.map((revision) => (
            <div key={revision.id} className="rounded-xl border border-dark-border p-3 text-sm">
              <p className="text-text-secondary">
                {revision.editor?.name ?? 'Someone'} changed this on {dateLabel(revision.created_at)}. Previous score {revision.snapshot.overall_score ?? '—'}/100.
              </p>
              {revision.snapshot.overall_comment && (
                <p className="text-text-muted mt-1">{revision.snapshot.overall_comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
