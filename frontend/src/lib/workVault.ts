import type { WorkVaultFileKind } from '../types';

export const WORK_VAULT_CATEGORIES = [
  'API Integration',
  'Technical Documentation',
  'Designs & Creative Assets',
  'Marketing Materials',
  'Reports & Analytics',
  'Business Documents',
  'Templates & SOPs',
  'Images & Media',
  'Other',
] as const;

export const WORK_VAULT_API_CATEGORY = 'API Integration';
export const WORK_VAULT_HTTP_METHODS = ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'] as const;

export const WORK_VAULT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,.txt,.md,.csv,.json,.xml,.yml,.yaml,.html,.css,.js,.ts,.tsx,.jsx,.py,.sql';

export const FILE_KIND_LABELS: Record<WorkVaultFileKind, string> = {
  image: 'Images',
  pdf: 'PDFs',
  document: 'Documents',
  spreadsheet: 'Spreadsheets',
  presentation: 'Presentations',
  code: 'Code & text',
  link: 'Links',
  api: 'API',
  other: 'Other files',
};

export function uploaderName(user?: { first_name?: string; last_name?: string } | null) {
  if (!user) return 'Unknown';
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Unknown';
}

export function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function titleFromFilename(filename: string) {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || filename;
}

export function isPreviewable(kind?: WorkVaultFileKind, mime?: string | null, filename?: string | null) {
  return previewMedia(kind, mime, filename) !== 'none';
}

export function previewMedia(
  kind?: WorkVaultFileKind,
  mime?: string | null,
  filename?: string | null,
): 'image' | 'pdf' | 'text' | 'none' {
  const type = (mime || '').toLowerCase();
  const name = (filename || '').toLowerCase();
  if (kind === 'image' || type.startsWith('image/')) return 'image';
  if (kind === 'pdf' || type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (kind === 'code' || type.startsWith('text/') || type === 'application/json') return 'text';
  return 'none';
}

export type WorkVaultPeriod = '' | 'week' | 'month';

export function currentWeekValue() {
  const now = new Date();
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + 4 - (now.getDay() || 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function periodLabel(mode: WorkVaultPeriod, value: string) {
  const range = periodRange(mode, value);
  if (!range.created_from || !range.created_to) return 'All time';
  const from = new Date(`${range.created_from}T00:00:00`);
  const to = new Date(`${range.created_to}T00:00:00`);
  if (mode === 'month') {
    return from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  const fromText = from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const toText = to.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fromText} – ${toText}`;
}

export function periodRange(mode: WorkVaultPeriod, value: string): { created_from?: string; created_to?: string } {
  if (!mode || !value) return {};
  if (mode === 'month' && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    const last = new Date(year, month, 0).getDate();
    return {
      created_from: `${value}-01`,
      created_to: `${value}-${String(last).padStart(2, '0')}`,
    };
  }
  const match = value.match(/^(\d{4})-W(\d{2})$/);
  if (mode === 'week' && match) {
    const year = Number(match[1]);
    const week = Number(match[2]);
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const day = simple.getUTCDay();
    const monday = new Date(simple);
    const offset = day <= 4 ? day - 1 : day - 8;
    monday.setUTCDate(simple.getUTCDate() - offset);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { created_from: iso(monday), created_to: iso(sunday) };
  }
  return {};
}

export function apiErrorMessage(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown; message?: string } } })?.response?.data;
  const value = detail?.detail ?? detail?.message;
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && value.length) {
    const first = value[0] as { msg?: string } | string;
    if (typeof first === 'string') return first;
    if (first?.msg) return first.msg;
  }
  return fallback;
}
