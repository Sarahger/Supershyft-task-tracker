import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { tasksApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { PriorityBadge } from '../ui/Badge';
import { AvatarGroup } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { STATUS_LABELS } from '../../types';
import type { Task } from '../../types';

const KANBAN_COLUMNS = ['backlog', 'to_do', 'in_progress', 'blocked', 'in_review', 'testing', 'completed'];

function SortableTask({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-dark-card rounded-md border border-dark-border p-3 cursor-grab active:cursor-grabbing hover:bg-dark-hover transition-colors duration-hover mb-2"
    >
      <p className="text-sm font-medium text-text-primary line-clamp-2 leading-snug">{task.title}</p>
      <div className="flex items-center justify-between mt-2.5">
        <PriorityBadge priority={task.priority} />
        {task.assignees?.length > 0 && <AvatarGroup users={task.assignees.map((a) => a.user!).filter(Boolean)} max={2} />}
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  tasks: Task[];
  queryKey?: (string | number)[];
}

export function KanbanBoard({ tasks, queryKey = ['tasks-kanban'] }: KanbanBoardProps) {
  const { openTask } = useTaskDrawer();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const qc = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => tasksApi.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as number;
    const newStatus = String(over.id);
    const task = tasks.find((t) => t.id === taskId);
    if (task && KANBAN_COLUMNS.includes(newStatus) && task.status !== newStatus) {
      statusMutation.mutate({ id: taskId, status: newStatus });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveTask(tasks.find((t) => t.id === e.active.id) || null)} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((status) => {
          const columnTasks = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="flex-shrink-0 w-64">
              <div className="flex items-center gap-2 mb-2 px-1">
                <h3 className="text-xs font-medium text-text-secondary">{STATUS_LABELS[status]}</h3>
                <span className="text-2xs text-text-muted">{columnTasks.length}</span>
              </div>
              <SortableContext id={status} items={columnTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div id={status} className="bg-surface-subtle rounded-md p-2 min-h-[120px]">
                  {columnTasks.map((task) => <SortableTask key={task.id} task={task} onClick={() => openTask(task.id)} />)}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="bg-dark-card rounded-md border border-dark-border p-3 w-64 opacity-95 dropdown-panel">
            <p className="text-sm font-medium text-text-primary">{activeTask.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
