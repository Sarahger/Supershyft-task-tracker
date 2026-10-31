import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, Plus, Trash2, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { toast } from '../ui/Toast';
import { departmentsApi, usersApi, workVaultApi } from '../../services/endpoints';
import {
  apiErrorMessage,
  WORK_VAULT_ACCEPT,
  WORK_VAULT_API_CATEGORY,
  WORK_VAULT_CATEGORIES,
  WORK_VAULT_HTTP_METHODS,
} from '../../lib/workVault';
import { TagMentionInput } from './TagMentionInput';

interface UploadResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

type DraftItem =
  | { key: string; kind: 'file'; file: File }
  | { key: string; kind: 'url'; url: string }
  | { key: string; kind: 'api'; method: string; path: string };

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyApiItem(): DraftItem {
  return { key: newKey(), kind: 'api', method: 'GET', path: '' };
}

export function UploadResourceModal({ isOpen, onClose, onUploaded }: UploadResourceModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Technical Documentation');
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ page_size: 100, status: 'active' }).then((r) => r.data.data.items),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teams } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data ?? []),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const isApi = category === WORK_VAULT_API_CATEGORY;

  const reset = () => {
    setTitle('');
    setDescription('');
    setCategory('Technical Documentation');
    setTags([]);
    setItems([]);
    setSubmitting(false);
    setProgress('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const next: DraftItem[] = Array.from(fileList).map((file) => ({
      key: newKey(),
      kind: 'file' as const,
      file,
    }));
    setItems((prev) => [...prev, ...next]);
  };

  const addUrl = () => {
    setItems((prev) => [...prev, { key: newKey(), kind: 'url', url: '' }]);
  };

  const handleCategoryChange = (next: string) => {
    const leavingApi = category === WORK_VAULT_API_CATEGORY;
    const enteringApi = next === WORK_VAULT_API_CATEGORY;
    setCategory(next);
    if (enteringApi && !leavingApi) {
      setItems([emptyApiItem()]);
    } else if (leavingApi && !enteringApi) {
      setItems([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const sharedTitle = title.trim();
    const sharedDescription = description.trim();
    if (!sharedTitle) {
      setError('Add a title for this upload.');
      return;
    }
    if (!sharedDescription) {
      setError('Add a short description of what this resource is useful for.');
      return;
    }
    if (!items.length) {
      setError(isApi ? 'Add at least one API method and path.' : 'Add at least one file or a valid URL.');
      return;
    }
    for (const item of items) {
      if (item.kind === 'url' && !/^https?:\/\//i.test(item.url.trim())) {
        setError('Each link needs a valid http(s) URL.');
        return;
      }
      if (item.kind === 'api' && !item.path.trim()) {
        setError('Each API needs a path, for example /users or https://api.example.com/users.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    const created: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      setProgress(`Uploading ${i + 1} of ${items.length}…`);
      const form = new FormData();
      form.append('title', sharedTitle);
      form.append('description', sharedDescription);
      form.append('category', category);
      if (tags.length) form.append('tags', tags.join(', '));
      if (item.kind === 'file') form.append('file', item.file);
      if (item.kind === 'url') form.append('url', item.url.trim());
      if (item.kind === 'api') {
        form.append('http_method', item.method);
        form.append('url', item.path.trim());
      }
      const label = item.kind === 'file' ? item.file.name : item.kind === 'url' ? item.url.trim() : `${item.method} ${item.path.trim()}`;
      try {
        await workVaultApi.create(form);
        created.push(label);
      } catch (err) {
        failed.push(`${label}: ${apiErrorMessage(err, 'Upload failed')}`);
      }
    }

    setSubmitting(false);
    setProgress('');

    if (created.length) {
      onUploaded();
      toast.success(created.length === 1 ? 'Resource uploaded' : `${created.length} resources uploaded`);
    }
    if (failed.length) {
      setError(failed.join('\n'));
      return;
    }
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload resource" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="App screens"
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this contains and when the team should use it"
          rows={3}
          required
        />
        <Select
          label="Category"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          options={WORK_VAULT_CATEGORIES.map((name) => ({ value: name, label: name }))}
        />
        <TagMentionInput
          value={tags}
          onChange={setTags}
          users={users ?? []}
          teams={teams ?? []}
        />

        {isApi ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-text-secondary">API endpoints</label>
              <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setItems((prev) => [...prev, emptyApiItem()])}>
                <Plus className="h-3.5 w-3.5" /> Add endpoint
              </Button>
            </div>
            <div className="space-y-2">
              {(items.filter((item) => item.kind === 'api') as Extract<DraftItem, { kind: 'api' }>[]).map((item) => (
                <div key={item.key} className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-2 items-end">
                  <Select
                    label="Choose method"
                    value={item.method}
                    onChange={(e) => setItems((prev) => prev.map((row) => (
                      row.key === item.key && row.kind === 'api' ? { ...row, method: e.target.value } : row
                    )))}
                    options={WORK_VAULT_HTTP_METHODS.map((method) => ({ value: method, label: method }))}
                  />
                  <Input
                    label="API path"
                    value={item.path}
                    onChange={(e) => setItems((prev) => prev.map((row) => (
                      row.key === item.key && row.kind === 'api' ? { ...row, path: e.target.value } : row
                    )))}
                    placeholder="/users or the rest of the URL"
                    required
                  />
                  <button
                    type="button"
                    className="mb-1 p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary"
                    onClick={() => setItems((prev) => prev.filter((row) => row.key !== item.key))}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-text-secondary">Files and links</label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Add files
                </Button>
                <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={addUrl}>
                  <Link2 className="h-3.5 w-3.5" /> Add URL
                </Button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={WORK_VAULT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {!items.length ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-dark-border px-4 py-6 text-sm text-text-muted hover:bg-dark-hover hover:text-text-secondary transition-colors"
              >
                Click to browse files. PDF, Office, images, and common text files are supported.
              </button>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.key} className="rounded-lg border border-dark-border p-3 flex items-center gap-2">
                    {item.kind === 'file' ? (
                      <p className="text-xs text-text-secondary truncate flex-1">{item.file.name}</p>
                    ) : item.kind === 'url' ? (
                      <Input
                        value={item.url}
                        onChange={(e) => setItems((prev) => prev.map((row) => (
                          row.key === item.key && row.kind === 'url' ? { ...row, url: e.target.value } : row
                        )))}
                        placeholder="https://"
                        className="flex-1"
                        required
                      />
                    ) : null}
                    <button
                      type="button"
                      className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary"
                      onClick={() => setItems((prev) => prev.filter((row) => row.key !== item.key))}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addUrl}
                  className="text-xs text-text-muted hover:text-text-primary inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add another URL
                </button>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-400 whitespace-pre-line">{error}</p>}
        {progress && <p className="text-xs text-text-secondary">{progress}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Upload
          </Button>
        </div>
      </form>
    </Modal>
  );
}
