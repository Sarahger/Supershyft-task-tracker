import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Copy, Download, ExternalLink, Pencil, Trash2, Upload } from 'lucide-react';
import { Drawer } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { PdfViewer } from '../tasks/PdfViewer';
import { departmentsApi, usersApi, workVaultApi } from '../../services/endpoints';
import {
  apiErrorMessage,
  FILE_KIND_LABELS,
  formatFileSize,
  isPreviewable,
  previewMedia,
  uploaderName,
  WORK_VAULT_ACCEPT,
  WORK_VAULT_API_CATEGORY,
  WORK_VAULT_CATEGORIES,
  WORK_VAULT_HTTP_METHODS,
} from '../../lib/workVault';
import { ResourceIcon } from './ResourceIcon';
import { TagMentionInput } from './TagMentionInput';
import type { WorkVaultResource } from '../../types';

interface ResourceDetailDrawerProps {
  resource: WorkVaultResource | null;
  onClose: () => void;
  onChanged?: (resource: WorkVaultResource) => void;
}

export function ResourceDetailDrawer({ resource, onClose, onChanged }: ResourceDetailDrawerProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [url, setUrl] = useState('');
  const [httpMethod, setHttpMethod] = useState('GET');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ page_size: 100, status: 'active' }).then((r) => r.data.data.items),
    enabled: !!resource && editing,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teams } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data ?? []),
    enabled: !!resource && editing,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!resource) {
      setEditing(false);
      setConfirmDelete(false);
      return;
    }
    setTitle(resource.title);
    setDescription(resource.description);
    setCategory(resource.category);
    setTags(resource.tags);
    setUrl(resource.url || '');
    setHttpMethod(resource.http_method || 'GET');
    setEditing(false);
    setConfirmDelete(false);
  }, [resource]);

  useEffect(() => {
    if (!resource || resource.resource_type !== 'file' || !isPreviewable(resource.file_kind, resource.mime_type, resource.filename)) {
      setPreviewUrl(null);
      setTextContent(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    const load = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewUrl(null);
      setTextContent(null);
      try {
        const response = await workVaultApi.fileBlob(resource.id);
        if (!active) return;
        const mime = resource.mime_type || response.data.type || 'application/octet-stream';
        const blob = new Blob([response.data], { type: mime || 'application/octet-stream' });
        const media = previewMedia(resource.file_kind, mime, resource.filename);
        if (media === 'text') {
          setTextContent(await blob.text());
        } else if (media === 'pdf') {
          objectUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          setPreviewUrl(objectUrl);
        } else {
          objectUrl = window.URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        }
      } catch (err) {
        if (active) setPreviewError(apiErrorMessage(err, 'Preview is unavailable.'));
      } finally {
        if (active) setPreviewLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [resource]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['work-vault'] });
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      workVaultApi.update(resource!.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        tags: tags.join(', '),
        ...(resource?.resource_type === 'link' ? { url: url.trim() } : {}),
        ...(category === WORK_VAULT_API_CATEGORY || resource?.file_kind === 'api'
          ? { http_method: httpMethod }
          : {}),
      }),
    onSuccess: (res) => {
      invalidate();
      setEditing(false);
      toast.success('Resource updated');
      if (res.data.data) onChanged?.(res.data.data);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not update resource')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => workVaultApi.remove(resource!.id),
    onSuccess: () => {
      invalidate();
      toast.success('Resource deleted');
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not delete resource')),
  });

  const replaceMutation = useMutation({
    mutationFn: (file: File) => workVaultApi.replaceFile(resource!.id, file),
    onSuccess: (res) => {
      invalidate();
      toast.success('File replaced');
      if (res.data.data) onChanged?.(res.data.data);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not replace file')),
  });

  if (!resource) return null;
  const name = uploaderName(resource.uploaded_by);
  const media = previewMedia(resource.file_kind, resource.mime_type, resource.filename);

  const copyLink = async () => {
    const link = `${window.location.origin}/work-vault?resource=${resource.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const endpointLabel = resource.http_method && resource.url
    ? `${resource.http_method} ${resource.url}`
    : resource.url || '';

  const openExternal = async () => {
    if (!resource.url) return;
    if (/^https?:\/\//i.test(resource.url)) {
      window.open(resource.url, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await navigator.clipboard.writeText(endpointLabel);
      toast.success('API path copied');
    } catch {
      toast.error('Could not copy API path');
    }
  };

  return (
    <Drawer isOpen={!!resource} onClose={onClose}>
      <div className="p-6 space-y-5">
        <div className="pr-8">
          <div className="flex items-center gap-2 text-2xs text-text-muted mb-2">
            <ResourceIcon kind={resource.file_kind} />
            <span>{FILE_KIND_LABELS[resource.file_kind]}</span>
            <span className="chip badge-neutral">{resource.category}</span>
          </div>
          <h2 className="text-lg font-semibold text-text-primary leading-snug">{resource.title}</h2>
          <div className="mt-3 flex items-center gap-2">
            <Avatar name={name} src={resource.uploaded_by.profile_picture} size="sm" />
            <p className="text-xs text-text-secondary">
              {name}
              <span className="text-text-muted"> · {format(parseISO(resource.created_at), 'MMM d, yyyy')}</span>
            </p>
          </div>
        </div>

        {resource.resource_type === 'file' && (
          <div className="rounded-lg border border-dark-border p-3">
            {previewLoading && <p className="text-xs text-text-muted">Loading preview…</p>}
            {previewError && <p className="text-sm text-red-400">{previewError}</p>}
            {previewUrl && media === 'image' && (
              <img src={previewUrl} alt={resource.title} className="max-h-[70vh] w-full object-contain rounded" />
            )}
            {previewUrl && media === 'pdf' && (
              <PdfViewer url={previewUrl} filename={resource.filename || resource.title} className="min-h-[50vh]" />
            )}
            {textContent != null && (
              <pre className="text-2xs text-text-secondary overflow-auto max-h-[60vh] whitespace-pre-wrap">{textContent}</pre>
            )}
            {!previewLoading && !previewError && !previewUrl && textContent == null && (
              <p className="text-xs text-text-muted">Preview is not available for this file type. Download it to open.</p>
            )}
          </div>
        )}

        {editing ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
          >
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={WORK_VAULT_CATEGORIES.map((name) => ({ value: name, label: name }))}
            />
            <TagMentionInput
              value={tags}
              onChange={setTags}
              users={users ?? []}
              teams={teams ?? []}
            />
            {category === WORK_VAULT_API_CATEGORY || resource.file_kind === 'api' ? (
              <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                <Select
                  label="Choose method"
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value)}
                  options={WORK_VAULT_HTTP_METHODS.map((method) => ({ value: method, label: method }))}
                />
                <Input
                  label="API path"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="/users or the rest of the URL"
                />
              </div>
            ) : resource.resource_type === 'link' ? (
              <Input label="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" loading={updateMutation.isPending}>Save</Button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{resource.description}</p>
            {resource.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {resource.tags.map((tag) => (
                  <span key={tag} className="chip badge-neutral">{tag}</span>
                ))}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-text-muted">Type</dt>
                <dd className="text-text-primary mt-0.5">
                  {resource.file_kind === 'api'
                    ? endpointLabel
                    : resource.resource_type === 'link'
                      ? 'External link'
                      : resource.filename || 'File'}
                  {resource.file_size ? ` · ${formatFileSize(resource.file_size)}` : ''}
                </dd>
              </div>
            </dl>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          {resource.resource_type === 'link' ? (
            <Button size="sm" className="gap-1.5" onClick={() => { void openExternal(); }}>
              <ExternalLink className="h-3.5 w-3.5" />
              {resource.file_kind === 'api' && !/^https?:\/\//i.test(resource.url || '') ? 'Copy API' : 'Open link'}
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => workVaultApi.download(resource.id, resource.filename || resource.title)}
            >
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          )}
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={copyLink}>
            <Copy className="h-3.5 w-3.5" /> Copy link
          </Button>
          {resource.can_edit && !editing && (
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {resource.can_edit && resource.resource_type === 'file' && (
            <label className="btn btn-secondary px-2.5 py-1 text-xs gap-1.5 inline-flex items-center cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              {replaceMutation.isPending ? 'Replacing…' : 'Replace file'}
              <input
                type="file"
                accept={WORK_VAULT_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) replaceMutation.mutate(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
          {resource.can_delete && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                  Confirm delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="gap-1.5 text-red-400" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )
          )}
        </div>
      </div>
    </Drawer>
  );
}
