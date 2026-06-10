'use client';

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { ReactNode } from 'react';

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="alert-dialog-overlay" />
        <AlertDialog.Content className="alert-dialog-content">
          <AlertDialog.Title className="text-lg font-semibold tracking-tight text-slate-950">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-slate-600">
            {description}
          </AlertDialog.Description>
          <div className="alert-dialog-actions">
            <AlertDialog.Cancel asChild>
              <button type="button" className="btn btn-secondary">Cancel</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="button" className="btn btn-danger" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
