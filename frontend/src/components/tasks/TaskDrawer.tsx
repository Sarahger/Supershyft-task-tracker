import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Send, GitBranch, Eye, Paperclip, Upload, RotateCcw, Unlock, Plus, Download, X, Trash2 } from 'lucide-react';
import { Drawer, DrawerSection } from '../ui/Modal';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Skeleton } from '../ui/Skeleton';
import { toast } from '../ui/Toast';
import { tasksApi, usersApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { TaskPropertiesEditor } from './TaskPropertiesEditor';
import { CommentMentionTextarea } from './CommentMentionTextarea';
import { CommentMentionText } from './CommentMentionText';
import { DeleteTaskModal } from './DeleteTaskModal';
import { extractMentionedUserIds } from '../../lib/mentions';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { useDeleteTaskMutation } from '../../hooks/useDeleteTaskMutation';
import { AttachmentInlinePreview } from './AttachmentInlinePreview';
import type { TaskAttachment } from '../../types';

interface TaskDrawerProps {
  taskId: number | null;
  onClose: () => void;
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskDrawer({ taskId, onClose }: TaskDrawerProps) {
  const [comment, setComment] = useState('');
  const [checklistInput, setChecklistInput] = useState('');
  const [dependencyPersonPick, setDependencyPersonPick] = useState('');
  const [dependencyPick, setDependencyPick] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openTask, closeTask } = useTaskDrawer();
  const qc = useQueryClient();

  const deleteMutation = useDeleteTaskMutation(() => {
    setShowDeleteModal(false);
    closeTask();
  });

  useEffect(() => {
    setChecklistInput('');
    setDependencyPersonPick('');
    setDependencyPick('');
    setComment('');
    setPreviewAttachment(null);
    setShowDeleteModal(false);
  }, [taskId]);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!).then((r) => r.data.data),
    enabled: !!taskId,
    staleTime: 30_000,
  });

  const attachments = task?.attachments ?? [];

  const { data: comments } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => tasksApi.getComments(taskId!).then((r) => r.data.data),
    enabled: !!taskId,
    staleTime: 60_000,
  });

  const { data: activity } = useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: () => tasksApi.getActivity(taskId!).then((r) => r.data.data),
    enabled: !!taskId && (task?.current_version ?? 1) > 1,
    staleTime: 60_000,
  });

  const { data: taskPickerOptions } = useQuery({
    queryKey: ['tasks-picker'],
    queryFn: () =>
      tasksApi.list({ page_size: 100, sort_by: 'updated_at', sort_order: 'desc' }).then((r) => r.data.data.items),
    enabled: !!taskId && !!dependencyPersonPick,
    staleTime: 60_000,
  });

  const commentMutation = useMutation({
    mutationFn: (payload: { content: string; mentioned_user_ids: number[] }) =>
      tasksApi.addComment(taskId!, payload.content, undefined, payload.mentioned_user_ids),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-comments', taskId] }); setComment(''); },
  });

  const completeMutation = useMutation({
    mutationFn: ({ userId, done }: { userId: number; done: boolean }) =>
      tasksApi.markComplete(taskId!, userId, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
  });

  const checklistMutation = useMutation({
    mutationFn: ({ itemId, done }: { itemId: number; done: boolean }) =>
      tasksApi.updateChecklistItem(itemId, { is_completed: done }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const addChecklistMutation = useMutation({
    mutationFn: (title: string) => tasksApi.addChecklistItem(taskId!, title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      setChecklistInput('');
      toast.success('Checklist item added');
    },
    onError: () => toast.error('Failed to add checklist item'),
  });

  const { data: usersList } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
    enabled: !!taskId,
    staleTime: 5 * 60 * 1000,
  });

  const addDependencyMutation = useMutation({
    mutationFn: ({ dependsOnId, dependsOnUserId }: { dependsOnId: number; dependsOnUserId?: number }) =>
      tasksApi.addDependency(taskId!, dependsOnId, dependsOnUserId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      setDependencyPersonPick('');
      setDependencyPick('');
      toast.success('Dependency added');
    },
    onError: () => toast.error('Failed to add dependency'),
  });

  const removeDependencyMutation = useMutation({
    mutationFn: (dependencyId: number) => tasksApi.removeDependency(taskId!, dependencyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Dependency removed');
    },
    onError: () => toast.error('Failed to remove dependency'),
  });

  const unblockMutation = useMutation({
    mutationFn: () => tasksApi.unblock(taskId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      toast.success('Task unblocked');
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => tasksApi.reopen(taskId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      toast.success('Task reopened');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => tasksApi.uploadAttachment(taskId!, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('File uploaded');
    },
    onError: (error: { response?: { data?: { detail?: string; message?: string } } }) => {
      const data = error.response?.data;
      const detail = typeof data?.detail === 'string' ? data.detail : data?.message;
      toast.error(detail || 'Upload failed');
    },
  });

  const handleDownloadAttachment = async (attachmentId: number, filename: string) => {
    try {
      await tasksApi.downloadAttachment(attachmentId, filename);
    } catch {
      toast.error('Download failed');
    }
  };

  const openAttachmentPreview = (file: TaskAttachment) => {
    setPreviewAttachment(file);
  };

  const existingDependencyIds = new Set(task?.dependencies?.map((d) => d.depends_on_id) ?? []);
  const personFilteredTasks = (taskPickerOptions ?? []).filter((t) => {
    if (t.id === taskId || existingDependencyIds.has(t.id)) return false;
    if (!dependencyPersonPick) return true;
    const uid = Number(dependencyPersonPick);
    return t.assignees?.some((a) => a.user_id === uid);
  });
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const dependencyOptions = [...personFilteredTasks].sort(
    (a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9),
  );

  const submitComment = () => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    const mentioned_user_ids = extractMentionedUserIds(trimmed, usersList ?? []);
    commentMutation.mutate({ content: trimmed, mentioned_user_ids });
  };

  return (
    <>
    <Drawer isOpen={!!taskId} onClose={onClose}>
      {isLoading ? (
        <div className="p-8 space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-32" /></div>
      ) : task ? (
        task.is_archived ? (
          <div className="px-8 py-7 max-w-none">
            <div className="pr-10 mb-6">
              <h1 className="text-2xl font-semibold text-text-primary leading-snug tracking-tight">{task.title}</h1>
              <span className="inline-flex items-center mt-3 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                Deleted
              </span>
            </div>
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5">Reason for deletion</p>
                <p className="text-sm text-text-primary leading-relaxed">
                  {task.deletion_reason || 'No reason provided'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5">Deleted by</p>
                <p className="text-sm text-text-primary">
                  {task.deleted_by
                    ? `${task.deleted_by.first_name} ${task.deleted_by.last_name}`
                    : 'Unknown'}
                </p>
              </div>
              {task.deleted_at && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5">Deleted on</p>
                  <p className="text-sm text-text-primary">
                    {format(new Date(task.deleted_at), 'MMM d, yyyy · h:mm a')}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
        <div className="px-8 py-7 max-w-none">
          {/* Header */}
          <div className="pr-10 mb-6">
            <h1 className="text-2xl font-semibold text-text-primary leading-snug tracking-tight">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.due_date && (
                <span className="text-sm text-text-secondary">
                  Due {format(new Date(task.due_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {task.status === 'completed' && (
                <Button variant="secondary" size="sm" onClick={() => reopenMutation.mutate()} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen
                </Button>
              )}
              {task.status === 'blocked' && (
                <Button variant="secondary" size="sm" onClick={() => unblockMutation.mutate()} className="gap-1.5">
                  <Unlock className="h-3.5 w-3.5" /> Unblock
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                className="gap-1.5 text-accent-danger hover:text-accent-danger hover:bg-red-500/10 border-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>

          <TaskPropertiesEditor task={task} taskId={task.id} />

          {task.assignees && task.assignees.length > 1 && (
            <DrawerSection title="Assignee progress" defaultOpen={false}>
              <div className="space-y-1.5">
                {task.assignees.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {a.user && <Avatar name={`${a.user.first_name} ${a.user.last_name}`} size="sm" />}
                      <span className="text-sm text-text-primary truncate">{a.user?.first_name} {a.user?.last_name}</span>
                    </div>
                    <button
                      onClick={() => completeMutation.mutate({ userId: a.user_id, done: !a.is_completed })}
                      className="shrink-0 text-text-muted hover:text-emerald-400 transition-colors duration-hover"
                      title={a.is_completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {a.is_completed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </DrawerSection>
          )}

          {task.block_reason && (
            <div className="my-4 px-3 py-2.5 rounded-lg bg-red-500/10 text-sm text-red-400 border border-red-500/20">
              <span className="font-medium">Blocked</span> — {task.block_reason}
            </div>
          )}

          {/* Comments */}
          <DrawerSection title={`Comments${comments?.length ? ` · ${comments.length}` : ''}`}>
            <div className="space-y-4">
              {comments?.length ? comments.map((c: {
                id: number; content: string;
                author?: { first_name: string; last_name: string };
                created_at: string; replies?: unknown[];
              }) => (
                <div key={c.id} className="flex gap-3">
                  {c.author && <Avatar name={`${c.author.first_name} ${c.author.last_name}`} size="sm" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-text-primary">{c.author?.first_name} {c.author?.last_name}</span>
                      <span className="text-2xs text-text-muted">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                    <CommentMentionText content={c.content} />
                  </div>
                </div>
              )) : (
                <p className="text-sm text-text-muted">No comments yet</p>
              )}
              <div className="flex gap-2 pt-2">
                <CommentMentionTextarea
                  value={comment}
                  onChange={setComment}
                  users={usersList ?? []}
                />
                <Button
                  variant="secondary"
                  onClick={submitComment}
                  disabled={!comment.trim() || commentMutation.isPending}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DrawerSection>

          {/* Checklist */}
          <DrawerSection
            title={`Checklist${
              task.checklists?.flatMap((cl) => cl.items).length
                ? ` · ${task.checklists.flatMap((cl) => cl.items).filter((i) => i.is_completed).length}/${task.checklists.flatMap((cl) => cl.items).length}`
                : ''
            }`}
            defaultOpen
          >
            {task.checklists?.flatMap((cl) => cl.items).length ? (
              <div className="space-y-1">
                {task.checklists.flatMap((cl) => cl.items).map((item) => (
                  <label key={item.id} className="flex items-center gap-3 py-1.5 px-1 rounded-md hover:bg-dark-hover cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={(e) => checklistMutation.mutate({ itemId: item.id, done: e.target.checked })}
                      className="rounded border-dark-border text-text-primary focus:ring-[var(--focus-ring)]"
                    />
                    <span className={`text-sm ${item.is_completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                      {item.title}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No checklist items yet</p>
            )}
            <div className="flex gap-2 pt-3">
              <Input
                value={checklistInput}
                onChange={(e) => setChecklistInput(e.target.value)}
                placeholder="Add checklist item..."
                className="flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && checklistInput.trim()) {
                    e.preventDefault();
                    addChecklistMutation.mutate(checklistInput.trim());
                  }
                }}
              />
              <Button
                variant="secondary"
                onClick={() => addChecklistMutation.mutate(checklistInput.trim())}
                disabled={!checklistInput.trim() || addChecklistMutation.isPending}
                className="gap-1.5 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </DrawerSection>

          {/* Attachments */}
          <DrawerSection
            title={`Attachments${attachments?.length ? ` · ${attachments.length}` : ''}`}
            defaultOpen={(attachments?.length ?? 0) > 0}
          >
            {attachments?.length ? (
              <ul className="space-y-3 mb-3">
                {attachments.map((file) => (
                  <li
                    key={file.id}
                    className="rounded-lg border border-dark-border bg-dark-card px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-sky-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => openAttachmentPreview(file)}
                          className="link-sky"
                        >
                          {file.filename}
                        </button>
                        <p className="text-2xs text-text-muted mt-0.5">
                          {[
                            formatFileSize(file.file_size),
                            file.uploaded_by ? `${file.uploaded_by.first_name} ${file.uploaded_by.last_name}` : null,
                            format(new Date(file.created_at), 'MMM d, yyyy'),
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openAttachmentPreview(file)}
                        className="gap-1.5 shrink-0"
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownloadAttachment(file.id, file.filename)}
                        className="gap-1.5 shrink-0"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <AttachmentInlinePreview
                      attachment={file}
                      isSelected={previewAttachment?.id === file.id}
                      onPreview={() => openAttachmentPreview(file)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted mb-3">No attachments yet</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
                e.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadMutation.isPending ? 'Uploading…' : 'Upload file'}
            </Button>
          </DrawerSection>

          {(task.current_version ?? 1) > 1 && (
            <>
              <DrawerSection title={`Version History · v${task.current_version}`} defaultOpen={false}>
                <p className="text-sm text-text-secondary">
                  Current version: <span className="font-medium text-text-primary">{task.current_version}</span>
                </p>
                <p className="text-2xs text-text-muted mt-1">Previous versions are preserved after review cycles.</p>
              </DrawerSection>

              <DrawerSection title="Activity" defaultOpen={false}>
                <div className="space-y-3">
                  {activity?.length ? activity.map((a: {
                    id: number; description: string; created_at: string;
                    user?: { first_name: string; last_name: string };
                  }) => (
                    <div key={a.id} className="flex gap-3 text-sm">
                      <div className="w-1 h-1 rounded-full bg-text-muted mt-2 shrink-0" />
                      <div>
                        <p className="text-text-secondary">{a.description}</p>
                        <p className="text-2xs text-text-muted mt-0.5">
                          {a.user ? `${a.user.first_name} ${a.user.last_name} · ` : ''}
                          {format(new Date(a.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-text-muted">No activity yet</p>
                  )}
                </div>
              </DrawerSection>
            </>
          )}

          {/* Dependencies */}
          <DrawerSection
            title={`Dependencies${task.dependencies?.length ? ` · ${task.dependencies.length}` : ''}`}
            defaultOpen
          >
            {task.dependencies?.length ? (
              <ul className="space-y-2">
                {task.dependencies.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => openTask(d.depends_on_id)}
                      className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors flex-1 min-w-0"
                    >
                      <GitBranch className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">
                        {d.depends_on_user
                          ? `${d.depends_on_user.first_name} ${d.depends_on_user.last_name} · `
                          : ''}
                        {d.depends_on_title || `Task #${d.depends_on_id}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDependencyMutation.mutate(d.id)}
                      disabled={removeDependencyMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
                      aria-label="Remove dependency"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">This task does not depend on any other tasks yet</p>
            )}
            <div className="flex flex-col gap-2 pt-3">
              <select
                value={dependencyPersonPick}
                onChange={(e) => {
                  setDependencyPersonPick(e.target.value);
                  setDependencyPick('');
                }}
                className="input text-sm"
                aria-label="Select person"
              >
                <option value="">1. Select person (optional)…</option>
                {(usersList ?? []).map((u: { id: number; first_name: string; last_name: string }) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
              {dependencyOptions.length > 0 ? (
                <div className="flex gap-2">
                  <select
                    value={dependencyPick}
                    onChange={(e) => setDependencyPick(e.target.value)}
                    className="input flex-1 text-sm"
                    aria-label="Select task dependency"
                  >
                    <option value="">2. Depends on task…</option>
                    {dependencyOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.priority}] {t.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      addDependencyMutation.mutate({
                        dependsOnId: Number(dependencyPick),
                        dependsOnUserId: dependencyPersonPick ? Number(dependencyPersonPick) : undefined,
                      })
                    }
                    disabled={!dependencyPick || addDependencyMutation.isPending}
                    className="gap-1.5 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-text-muted">
                  {dependencyPersonPick ? 'No tasks for this person' : 'No other tasks available to link'}
                </p>
              )}
            </div>
          </DrawerSection>

          {/* Metadata — tertiary, always collapsed */}
          <DrawerSection title="Details" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {task.estimated_hours != null && (
                <div><span className="text-text-muted">Estimated</span><p className="text-text-primary">{task.estimated_hours}h</p></div>
              )}
              {task.actual_hours != null && (
                <div><span className="text-text-muted">Actual</span><p className="text-text-primary">{task.actual_hours}h</p></div>
              )}
              {task.departments?.length ? (
                <div className="col-span-2">
                  <span className="text-text-muted">Departments</span>
                  <p className="text-text-primary">{task.departments.map((d) => d.name).join(', ')}</p>
                </div>
              ) : null}
              {task.creator && (
                <div><span className="text-text-muted">Created by</span><p className="text-text-primary">{task.creator.first_name} {task.creator.last_name}</p></div>
              )}
              <div><span className="text-text-muted">Created</span><p className="text-text-primary">{format(new Date(task.created_at), 'MMM d, yyyy')}</p></div>
            </div>
          </DrawerSection>
        </div>
        )
      ) : null}
    </Drawer>
    <AttachmentPreviewModal
      attachment={previewAttachment}
      onClose={() => setPreviewAttachment(null)}
    />
    <DeleteTaskModal
      isOpen={showDeleteModal}
      taskTitle={task?.title}
      onClose={() => setShowDeleteModal(false)}
      onConfirm={(reason) => {
        if (taskId) deleteMutation.mutate({ id: taskId, reason });
      }}
      isPending={deleteMutation.isPending}
    />
    </>
  );
}
