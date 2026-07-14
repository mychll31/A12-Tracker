"use client";

import { useCallback, useState } from "react";
import { ListChecks, Pencil, Plus, TriangleAlert } from "lucide-react";

import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Input,
  Modal,
  Table,
  TBody,
  TD,
  Textarea,
  TH,
  THead,
  TR,
} from "@/components/ui";

import { ActionForm } from "../action-form";
import { upsertCoreTaskAction } from "../actions";

export type CoreTaskView = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  points: number;
  sortOrder: number;
  isActive: boolean;
};

type Dialog = { kind: "create" } | { kind: "edit"; task: CoreTaskView } | null;

function TaskFields({ task }: { task?: CoreTaskView }) {
  return (
    <>
      {task ? <input type="hidden" name="id" value={task.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Key"
          required
          hint="Uppercase, underscores. Stable — completions are stored against it."
        >
          <Input
            name="key"
            defaultValue={task?.key}
            placeholder="MORNING_ROUTINE"
            required
          />
        </FormField>

        <FormField label="Name" required>
          <Input
            name="name"
            defaultValue={task?.name}
            placeholder="Morning routine"
            required
          />
        </FormField>
      </div>

      <div className="mt-4">
        <FormField label="Description" hint="Optional. Shown under the task.">
          <Textarea
            name="description"
            rows={2}
            defaultValue={task?.description ?? ""}
          />
        </FormField>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <FormField label="Icon" hint="A lucide icon name.">
          <Input
            name="icon"
            defaultValue={task?.icon ?? "target"}
            placeholder="target"
          />
        </FormField>

        <FormField label="Points">
          <Input
            name="points"
            type="number"
            min={0}
            defaultValue={task?.points ?? 25}
          />
        </FormField>

        <FormField label="Sort order">
          <Input
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={task?.sortOrder ?? 0}
          />
        </FormField>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-surface-sunken p-3.5">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={task?.isActive ?? true}
          className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <span>
          <span className="text-sm font-medium text-foreground">Active</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            Only active tasks count. Turning this off changes the daily count
            every member is measured against, and their Core Task Score moves
            with it.
          </span>
        </span>
      </label>
    </>
  );
}

export function CoreTasksClient({ tasks }: { tasks: CoreTaskView[] }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = useCallback(() => setDialog(null), []);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="flex max-w-2xl items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            Core tasks are organization-wide. Deactivating one changes the
            expected daily count for <em>everybody</em> — and therefore every
            member&apos;s Core Task Score, which is 30% of their overall score.
          </span>
        </p>

        <Button
          icon={<Plus />}
          onClick={() => setDialog({ kind: "create" })}
          className="shrink-0"
        >
          New core task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No core tasks yet"
          description="Core tasks are the daily disciplines every member is measured against. Add the first one."
          action={
            <Button
              icon={<Plus />}
              onClick={() => setDialog({ kind: "create" })}
            >
              New core task
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Task</TH>
              <TH>Key</TH>
              <TH>Icon</TH>
              <TH className="text-right">Points</TH>
              <TH className="text-right">Order</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {tasks.map((task) => (
              <TR key={task.id}>
                <TD>
                  <p className="font-medium">{task.name}</p>
                  {task.description ? (
                    <p className="mt-0.5 max-w-md truncate text-xs text-muted">
                      {task.description}
                    </p>
                  ) : null}
                </TD>
                <TD>
                  <code className="rounded-md bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-muted-strong">
                    {task.key}
                  </code>
                </TD>
                <TD>
                  <code className="font-mono text-xs text-muted">
                    {task.icon}
                  </code>
                </TD>
                <TD className="text-right tabular-nums">{task.points}</TD>
                <TD className="text-right tabular-nums text-muted">
                  {task.sortOrder}
                </TD>
                <TD>
                  <Badge
                    size="sm"
                    variant={task.isActive ? "success" : "neutral"}
                  >
                    {task.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Pencil />}
                      onClick={() => setDialog({ kind: "edit", task })}
                    >
                      Edit
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={dialog?.kind === "create"}
        onClose={close}
        title="New core task"
        description="A new task raises the expected daily count for every member of the organization."
        size="lg"
      >
        <ActionForm
          action={upsertCoreTaskAction}
          submitLabel="Create task"
          onSuccess={close}
          onCancel={close}
        >
          <TaskFields />
        </ActionForm>
      </Modal>

      <Modal
        open={dialog?.kind === "edit"}
        onClose={close}
        title="Edit core task"
        description="Changing the key re-points future completions. Existing ones stay attached to this task."
        size="lg"
      >
        {dialog?.kind === "edit" ? (
          <ActionForm
            action={upsertCoreTaskAction}
            submitLabel="Save task"
            onSuccess={close}
            onCancel={close}
          >
            <TaskFields task={dialog.task} />
          </ActionForm>
        ) : null}
      </Modal>
    </div>
  );
}
