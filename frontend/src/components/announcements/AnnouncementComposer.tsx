import { useRef, useState } from 'react';
import { Link2, Paperclip, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { CommentMentionTextarea } from '../tasks/CommentMentionTextarea';
import { announcementsApi, usersApi } from '../../services/endpoints';
import { extractMentionedUserIds, type MentionUser } from '../../lib/mentions';

export function AnnouncementComposer() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [links, setLinks] = useState<{ url: string; title?: string }[]>([]);

  const { data: usersList } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const r = await usersApi.list({ page_size: 100 });
      const items = r.data?.data?.items;
      return Array.isArray(items) ? items : [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const mentionUsers: MentionUser[] = (usersList ?? []).filter((u) => u.status !== 'inactive');

  const mutation = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) throw new Error('Write something to announce');
      const created = await announcementsApi.create({
        body: text,
        mentioned_user_ids: extractMentionedUserIds(text, mentionUsers),
        links,
      });
      const announcement = created.data.data;
      if (!announcement) throw new Error('Could not post announcement');
      for (const file of files) {
        await announcementsApi.uploadAttachment(announcement.id, file);
      }
      return announcement;
    },
    onSuccess: () => {
      setBody('');
      setFiles([]);
      setLinks([]);
      setLinkUrl('');
      setShowLink(false);
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement posted');
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string; message?: string } }; message?: string })
        ?.response?.data?.detail
        || (err as { message?: string }).message
        || 'Could not post announcement';
      toast.error(typeof detail === 'string' ? detail : 'Could not post announcement');
    },
  });

  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error('Links must start with http:// or https://');
      return;
    }
    setLinks((prev) => [...prev, { url }]);
    setLinkUrl('');
    setShowLink(false);
  };

  return (
    <div className="rounded-2xl border border-dark-border bg-dark-card px-4 py-3 space-y-3">
      <p className="text-xs font-medium text-text-secondary">Share an announcement</p>
      <CommentMentionTextarea
        value={body}
        onChange={setBody}
        users={mentionUsers}
        placeholder="What did you get done? Use @name to mention someone — they will get an email."
        rows={4}
      />
      {(files.length > 0 || links.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <span key={`${file.name}-${index}`} className="chip badge-neutral inline-flex items-center gap-1">
              {file.name}
              <button type="button" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {links.map((link, index) => (
            <span key={`${link.url}-${index}`} className="chip badge-neutral inline-flex items-center gap-1">
              {link.url}
              <button type="button" onClick={() => setLinks((prev) => prev.filter((_, i) => i !== index))} aria-label={`Remove ${link.url}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {showLink && (
        <div className="flex gap-2">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLink();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addLink}>Add</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          onChange={(e) => {
            const next = Array.from(e.target.files ?? []);
            if (next.length) setFiles((prev) => [...prev, ...next]);
            e.target.value = '';
          }}
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Photo or file
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowLink((v) => !v)} className="gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> Link
        </Button>
        <div className="ml-auto">
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!body.trim() || mutation.isPending}
          >
            Announce
          </Button>
        </div>
      </div>
    </div>
  );
}
