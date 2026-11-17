import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderUp, Link2, Plus, Trash2, Upload } from 'lucide-react';
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
import type { WorkVaultTitleFolder } from '../../types';

interface UploadResourceModalProps {
  isOpen: boolean;
  folder?: WorkVaultTitleFolder | null;
  onClose: () => void;
  onUploaded: () => void;
}

type DraftItem =
  | { key: string; kind: 'file'; file: File; relativePath?: string; title: string; description: string }
  | { key: string; kind: 'url'; url: string; title: string; description: string }
  | { key: string; kind: 'api'; method: string; path: string; title: string; description: string };

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyApiItem(): DraftItem {
  return { key: newKey(), kind: 'api', method: 'GET', path: '', title: '', description: '' };
}

function directoryNameFromFiles(files: File[]) {
  const first = files.find((file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath);
  const relative = first ? (first as File & { webkitRelativePath?: string }).webkitRelativePath || '' : '';
  const root = relative.split(/[/\\]/).filter(Boolean)[0];
  return root || 'Uploaded folder';
}

export function UploadResourceModal({ isOpen, folder, onClose, onUploaded }: UploadResourceModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [folderTitle, setFolderTitle] = useState(folder?.name ?? '');
  const [folderDescription, setFolderDescription] = useState(folder?.description ?? '');
  const [category, setCategory] = useState<string>('Technical Documentation');
  const [tags, setTags] = useState<string[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fromDirectory, setFromDirectory] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFolderTitle(folder?.name ?? '');
    setFolderDescription(folder?.description ?? '');
    setFromDirectory(false);
  }, [isOpen, folder]);

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
  const creatingFolder = !folder;

  useEffect(() => {
    if (!isOpen || isApi) return;
    const node = folderRef.current;
    if (!node) return;
    node.setAttribute('webkitdirectory', '');
    node.setAttribute('directory', '');
  }, [isOpen, isApi, items.length]);

  const reset = () => {
    setFolderTitle(folder?.name ?? '');
    setFolderDescription(folder?.description ?? '');
    setCategory('Technical Documentation');
    setTags([]);
    setItems([]);
    setSubmitting(false);
    setProgress('');
    setError(null);
    setFromDirectory(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const addFiles = (fileList: FileList | null, asDirectory = false) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    const next: DraftItem[] = files.map((file) => {
      const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
      return {
        key: newKey(),
        kind: 'file' as const,
        file,
        relativePath: relative || undefined,
        title: '',
        description: '',
      };
    });
    setItems((prev) => (asDirectory ? next : [...prev, ...next]));
    if (asDirectory) {
      setFromDirectory(true);
      if (!folder) setFolderTitle(directoryNameFromFiles(files));
    }
  };

  const addUrl = () => {
    setItems((prev) => [...prev, { key: newKey(), kind: 'url', url: '', title: '', description: '' }]);
  };

  const handleCategoryChange = (next: string) => {
    const leavingApi = category === WORK_VAULT_API_CATEGORY;
    const enteringApi = next === WORK_VAULT_API_CATEGORY;
    setCategory(next);
    if (enteringApi && !leavingApi) {
      setItems([emptyApiItem()]);
      setFromDirectory(false);
    } else if (leavingApi && !enteringApi) {
      setItems([]);
    }
  };

  const itemLabel = (item: DraftItem) => {
    if (item.kind === 'file') return item.file.name;
    if (item.kind === 'url') return item.url.trim() || 'URL';
    return `${item.method} ${item.path.trim()}`.trim() || 'API';
  };

  const resolveItemTitle = (item: DraftItem) => {
    const custom = item.title.trim();
    if (custom) return custom;
    if (item.kind === 'file') return item.file.name;
    if (item.kind === 'url') return item.url.trim();
    return `${item.method} ${item.path.trim()}`.trim();
  };

  const resolveItemDescription = (item: DraftItem) => item.description.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const sharedFolderTitle = folderTitle.trim();
    const sharedFolderDescription = folderDescription.trim();

    if (creatingFolder && !sharedFolderTitle) {
      setError(fromDirectory ? 'Add a folder title for this upload.' : 'Add a folder title to group these items.');
      return;
    }
    if (!items.length) {
      setError(isApi ? 'Add at least one API method and path.' : 'Add at least one file, folder, or valid URL.');
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

    let targetFolderId = folder?.id;
    if (!targetFolderId && creatingFolder) {
      try {
        const createdFolder = await workVaultApi.createFolder(sharedFolderTitle, sharedFolderDescription);
        targetFolderId = createdFolder.data.data.id;
      } catch (err) {
        // If the folder already exists, continue and let resource create attach to it by name.
        const message = apiErrorMessage(err, 'Could not create folder');
        if (!/already have a folder/i.test(message)) {
          setSubmitting(false);
          setProgress('');
          setError(message);
          return;
        }
      }
    }

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      setProgress(`Uploading ${i + 1} of ${items.length}…`);
      const form = new FormData();
      form.append('title', resolveItemTitle(item));
      form.append('description', resolveItemDescription(item));
      form.append('category', category);
      if (targetFolderId) form.append('folder_id', String(targetFolderId));
      if (!targetFolderId && sharedFolderTitle) {
        form.append('folder_name', sharedFolderTitle);
        if (sharedFolderDescription) form.append('folder_description', sharedFolderDescription);
      }
      if (tags.length) form.append('tags', tags.join(', '));
      if (item.kind === 'file') form.append('file', item.file, item.file.name);
      if (item.kind === 'url') form.append('url', item.url.trim());
      if (item.kind === 'api') {
        form.append('http_method', item.method);
        form.append('url', item.path.trim());
      }
      try {
        await workVaultApi.create(form);
        created.push(itemLabel(item));
      } catch (err) {
        failed.push(`${itemLabel(item)}: ${apiErrorMessage(err, 'Upload failed')}`);
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
    <Modal isOpen={isOpen} onClose={handleClose} title={folder ? `Add to ${folder.name}` : 'Upload resource'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {creatingFolder ? (
          <>
            <div className="space-y-1.5">
              <Input
                label="Folder title"
                value={folderTitle}
                onChange={(e) => setFolderTitle(e.target.value)}
                placeholder={fromDirectory ? 'Folder name' : 'App screens'}
                required
              />
              <p className="text-2xs text-text-muted">
                {fromDirectory
                  ? 'Creates a folder with this title. Files keep their original names unless you edit them below.'
                  : 'Groups these items in a folder. Each file keeps its original name as its title unless you change it.'}
              </p>
            </div>
            <Textarea
              label="Folder description (optional)"
              value={folderDescription}
              onChange={(e) => setFolderDescription(e.target.value)}
              placeholder="What this folder contains"
              rows={3}
            />
          </>
        ) : (
          <p className="text-xs text-text-secondary">
            Adding to <span className="text-text-primary font-medium">{folder.name}</span>. Original file names are kept;
            title and description are optional and can be edited later.
          </p>
        )}
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
                <div key={item.key} className="rounded-lg border border-dark-border p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-2 items-end">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      label="Title (optional)"
                      value={item.title}
                      onChange={(e) => setItems((prev) => prev.map((row) => (
                        row.key === item.key && row.kind === 'api' ? { ...row, title: e.target.value } : row
                      )))}
                      placeholder="Defaults to method + path"
                    />
                    <Input
                      label="Description (optional)"
                      value={item.description}
                      onChange={(e) => setItems((prev) => prev.map((row) => (
                        row.key === item.key && row.kind === 'api' ? { ...row, description: e.target.value } : row
                      )))}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="block text-xs font-medium text-text-secondary">Files, folders, and links</label>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Add files
                </Button>
                <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => folderRef.current?.click()}>
                  <FolderUp className="h-3.5 w-3.5" /> Upload folder
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
                addFiles(e.target.files, false);
                e.target.value = '';
              }}
            />
            <input
              ref={folderRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files, true);
                e.target.value = '';
              }}
            />
            {!items.length ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-dark-border px-4 py-6 text-sm text-text-muted hover:bg-dark-hover hover:text-text-secondary transition-colors"
              >
                Click to browse files, or use Upload folder to bring in a whole directory. Original file names are kept.
              </button>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.key} className="rounded-lg border border-dark-border p-3 space-y-2">
                    {item.kind === 'file' ? (
                      <>
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-text-primary truncate">{item.file.name}</p>
                            <p className="text-2xs text-text-muted truncate">
                              Original name kept
                              {item.relativePath ? ` · ${item.relativePath}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary"
                            onClick={() => setItems((prev) => prev.filter((row) => row.key !== item.key))}
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            label="Title (optional)"
                            value={item.title}
                            onChange={(e) => setItems((prev) => prev.map((row) => (
                              row.key === item.key && row.kind === 'file' ? { ...row, title: e.target.value } : row
                            )))}
                            placeholder={item.file.name}
                          />
                          <Input
                            label="Description (optional)"
                            value={item.description}
                            onChange={(e) => setItems((prev) => prev.map((row) => (
                              row.key === item.key && row.kind === 'file' ? { ...row, description: e.target.value } : row
                            )))}
                            placeholder="Optional"
                          />
                        </div>
                      </>
                    ) : item.kind === 'url' ? (
                      <>
                        <div className="flex items-end gap-2">
                          <Input
                            label="URL"
                            value={item.url}
                            onChange={(e) => setItems((prev) => prev.map((row) => (
                              row.key === item.key && row.kind === 'url' ? { ...row, url: e.target.value } : row
                            )))}
                            placeholder="https://"
                            className="flex-1"
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input
                            label="Title (optional)"
                            value={item.title}
                            onChange={(e) => setItems((prev) => prev.map((row) => (
                              row.key === item.key && row.kind === 'url' ? { ...row, title: e.target.value } : row
                            )))}
                            placeholder="Defaults to the URL"
                          />
                          <Input
                            label="Description (optional)"
                            value={item.description}
                            onChange={(e) => setItems((prev) => prev.map((row) => (
                              row.key === item.key && row.kind === 'url' ? { ...row, description: e.target.value } : row
                            )))}
                            placeholder="Optional"
                          />
                        </div>
                      </>
                    ) : null}
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
