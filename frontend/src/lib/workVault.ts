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
