import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ExternalLink, FileText, ThumbsUp, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';
import { CommentMentionText } from '../tasks/CommentMentionText';
import { announcementsApi } from '../../services/endpoints';
import type { Announcement, AnnouncementAttachment } from '../../types';

const TRUNCATE_AT = 180;

function isImage(att: AnnouncementAttachment) {
  return !!att.mime_type?.startsWith('image/');
}

function AnnouncementImage({ attachment }: { attachment: AnnouncementAttachment }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    announcementsApi.attachmentBlob(attachment.id).then((res) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(res.data);
      setSrc(objectUrl);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  if (!src) {
    return (
      <div className="h-24 rounded-lg bg-dark-muted animate-pulse" />
    );
  }
  return (
    <img
      src={src}
      alt={attachment.filename || 'Photo'}
      className="max-h-56 w-full object-cover rounded-lg border border-dark-border"
    />
  );
}

export function AnnouncementCard({
  item,
  onReact,
  onDelete,
}: {
  item: Announcement;
  onReact: (id: number) => void;
  onDelete?: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = useMemo(
    () => item.body.length > TRUNCATE_AT || item.body.split('\n').length > 4,
    [item.body],
  );
  const authorName = `${item.author.first_name} ${item.author.last_name}`;
  const published = format(parseISO(item.created_at), 'EEE, MMM d · h:mm a');
  const files = item.attachments.filter((a) => a.attachment_type === 'file');
  const links = item.attachments.filter((a) => a.attachment_type === 'link');
  const photos = files.filter(isImage);
  const docs = files.filter((a) => !isImage(a));

  return (
    <article className="rounded-2xl border border-dark-border bg-dark-card px-4 py-3.5 space-y-3">
      <div className="flex items-start gap-3">
        <Avatar name={authorName} src={item.author.profile_picture || undefined} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">{authorName}</p>
          <p className="text-2xs text-text-muted tabular-nums">{published}</p>
        </div>
        {item.can_delete && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-md text-text-muted hover:text-accent-danger hover:bg-red-500/10"
            aria-label="Delete announcement"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <button
        type="button"
        className="w-full text-left"
        onClick={() => long && setExpanded((v) => !v)}
      >
        <div className={clsx(!expanded && long && 'line-clamp-4')}>
          <CommentMentionText content={item.body} className="text-text-primary mt-0" />
        </div>
        {long && (
          <p className="text-2xs text-accent-primary mt-1">{expanded ? 'Show less' : 'Read more'}</p>
        )}
      </button>

      {(photos.length > 0 || docs.length > 0 || links.length > 0) && (
        <div className="space-y-2">
          {photos.length > 0 && (
            <div className={clsx('grid gap-2', photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
              {photos.map((photo) => (
                <AnnouncementImage key={photo.id} attachment={photo} />
              ))}
            </div>
          )}
          {docs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {docs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => announcementsApi.downloadAttachment(doc.id, doc.filename || 'file')}
                  className="chip badge-neutral inline-flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-[10rem] truncate">{doc.filename || 'Document'}</span>
                </button>
              ))}
            </div>
          )}
          {links.length > 0 && (
            <div className="space-y-1">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={link.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-accent-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{link.filename || link.url}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onReact(item.id)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-colors',
            item.reacted
              ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
              : 'border-dark-border text-text-muted hover:text-text-primary hover:bg-dark-hover',
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {item.reaction_count > 0 ? item.reaction_count : 'Up'}
        </button>
      </div>
    </article>
  );
}
