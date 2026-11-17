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
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,.mp4,.webm,.mov,.m4v,.ogv,.avi,.mkv,.txt,.md,.csv,.json,.xml,.yml,.yaml,.html,.css,.js,.ts,.tsx,.jsx,.py,.sql';

/** Keep in sync with backend MAX_UPLOAD_SIZE (50 MB). */
export const WORK_VAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const WORK_VAULT_ALLOWED_EXTENSIONS = new Set(
  WORK_VAULT_ACCEPT.split(',').map((ext) => ext.trim().toLowerCase()).filter(Boolean),
);

export const FILE_KIND_LABELS: Record<WorkVaultFileKind, string> = {
  image: 'Images',
  pdf: 'PDFs',
  document: 'Documents',
  spreadsheet: 'Spreadsheets',
  presentation: 'Presentations',
  code: 'Code & text',
  video: 'Videos',
  link: 'Links',
  api: 'API',
  other: 'Other files',
};

export function uploaderName(user?: { first_name?: string; last_name?: string } | null) {
  if (!user) return 'Unknown';
  return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Unknown';
}

export function formatFileSize(bytes?: number | null) {
  if (bytes == null || bytes < 0) return '';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExtension(filename: string) {
  const match = /\.[^.]+$/.exec(filename.trim());
  return match ? match[0].toLowerCase() : '';
}

export function isAllowedWorkVaultFile(file: File) {
  const ext = fileExtension(file.name);
  return !!ext && WORK_VAULT_ALLOWED_EXTENSIONS.has(ext);
}

/** Client-side checks before calling the upload API. Returns null when the file looks OK. */
export function validateWorkVaultFile(file: File): string | null {
  if (!file.size) {
    return 'This file is empty, so it cannot be uploaded.';
  }
  if (!isAllowedWorkVaultFile(file)) {
    const ext = fileExtension(file.name) || 'unknown type';
    return `${ext} files are not supported. Upload a document, image, video, or common text/code file.`;
  }
  if (file.size > WORK_VAULT_MAX_UPLOAD_BYTES) {
    return `This file is ${formatFileSize(file.size)}, but the maximum upload size is ${formatFileSize(WORK_VAULT_MAX_UPLOAD_BYTES)}. Try a smaller file or compress the video.`;
  }
  return null;
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
): 'image' | 'pdf' | 'text' | 'video' | 'none' {
  const type = (mime || '').toLowerCase();
  const name = (filename || '').toLowerCase();
  if (kind === 'image' || type.startsWith('image/')) return 'image';
  if (kind === 'video' || type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(name)) return 'video';
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

function readErrorBody(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return null;
    // Platform proxies often return HTML/plain pages instead of JSON.
    if (/^</.test(trimmed) || /request entity too large/i.test(trimmed) || /payload too large/i.test(trimmed)) {
      return null;
    }
    try {
      return readErrorBody(JSON.parse(trimmed));
    } catch {
      return trimmed.slice(0, 240);
    }
  }
  if (typeof data !== 'object') return null;
  const body = data as { detail?: unknown; message?: string; error?: string };
  const value = body.detail ?? body.message ?? body.error;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && value.length) {
    const first = value[0] as { msg?: string; message?: string } | string;
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (first && typeof first === 'object') {
      const msg = first.msg || first.message;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
    }
  }
  return null;
}

function statusErrorMessage(status: number, fallback: string) {
  if (status === 400) return fallback;
  if (status === 401) return 'Your session expired. Sign in again and retry the upload.';
  if (status === 403) return 'You do not have permission to upload here.';
  if (status === 404) return 'Upload endpoint was not found. Refresh the page and try again.';
  if (status === 408) return 'The upload timed out. Check your connection and try again.';
  if (status === 413) {
    return `This file is too large for the server to accept (max ${formatFileSize(WORK_VAULT_MAX_UPLOAD_BYTES)}). Try a smaller file or compress the video.`;
  }
  if (status === 415) return 'That file type is not supported.';
  if (status === 422) return 'Some upload details were invalid. Check the form and try again.';
  if (status === 429) return 'Too many uploads right now. Wait a moment and try again.';
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is temporarily unavailable. Please try again in a moment.';
  }
  if (status >= 500) return 'The server could not store this file. Please try again.';
  return fallback;
}

export function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && !(error as { response?: unknown }).response && !(error as { request?: unknown }).request) {
    const plain = error.message.trim();
    if (plain && plain.toLowerCase() !== 'network error' && !plain.toLowerCase().includes('timeout')) {
      return plain;
    }
  }

  const err = error as {
    code?: string;
    message?: string;
    response?: { status?: number; data?: unknown };
    request?: unknown;
  } | null;

  const bodyMessage = readErrorBody(err?.response?.data);
  if (bodyMessage) {
    if (/file too large|max 50|entity too large|payload too large/i.test(bodyMessage)) {
      return `This file is too large (max ${formatFileSize(WORK_VAULT_MAX_UPLOAD_BYTES)}). Try a smaller file or compress the video.`;
    }
    if (/empty/i.test(bodyMessage)) return 'This file is empty, so it cannot be uploaded.';
    if (/not supported|file type|valid category|http method|valid http/i.test(bodyMessage)) return bodyMessage;
    return bodyMessage;
  }

  const status = err?.response?.status;
  if (typeof status === 'number') {
    return statusErrorMessage(status, fallback);
  }

  const code = (err?.code || '').toUpperCase();
  const message = (err?.message || '').toLowerCase();
  if (
    code === 'ECONNABORTED'
    || code === 'ETIMEDOUT'
    || message.includes('timeout')
  ) {
    return 'The upload timed out. Large videos can take longer — check your connection and try again.';
  }
  if (
    code === 'ERR_NETWORK'
    || message.includes('network error')
    || (err?.request && !err?.response)
  ) {
    return 'Could not reach the server. Check your internet connection and try again. If this is a large video, it may also be over the upload size limit.';
  }

  return fallback;
}

export function uploadErrorMessage(error: unknown, filename?: string) {
  const message = apiErrorMessage(error, 'Upload failed. Please try again.');
  if (filename) return `${filename}: ${message}`;
  return message;
}
