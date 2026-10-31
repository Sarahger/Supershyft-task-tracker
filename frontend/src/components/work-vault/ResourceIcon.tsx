import {
  FileCode2,
  FileSpreadsheet,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  Presentation,
} from 'lucide-react';
import clsx from 'clsx';
import type { WorkVaultFileKind } from '../../types';

const icons: Record<WorkVaultFileKind, typeof FileText> = {
  image: ImageIcon,
  pdf: FileText,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  code: FileCode2,
  link: Link2,
  api: Globe,
  other: FileText,
};

const tones: Record<WorkVaultFileKind, { icon: string; well: string }> = {
  pdf: { icon: 'text-rose-400/80', well: 'bg-rose-500/10' },
  image: { icon: 'text-sky-400/80', well: 'bg-sky-500/10' },
  document: { icon: 'text-blue-400/75', well: 'bg-blue-500/10' },
  spreadsheet: { icon: 'text-emerald-400/80', well: 'bg-emerald-500/10' },
  presentation: { icon: 'text-amber-400/80', well: 'bg-amber-500/10' },
  code: { icon: 'text-violet-400/80', well: 'bg-violet-500/10' },
  link: { icon: 'text-cyan-400/75', well: 'bg-cyan-500/10' },
  api: { icon: 'text-teal-400/80', well: 'bg-teal-500/10' },
  other: { icon: 'text-text-muted', well: 'bg-dark-muted' },
};

export function resourceIconTone(kind: WorkVaultFileKind) {
  return tones[kind] || tones.other;
}

export function ResourceIcon({ kind, className }: { kind: WorkVaultFileKind; className?: string }) {
  const Icon = icons[kind] || FileText;
  return <Icon className={clsx('h-4 w-4 shrink-0', resourceIconTone(kind).icon, className)} />;
}
