import { Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/Dialog';
import { Section } from '@/components/Section';
import { clearFinanceData } from '@/db/repositories/finance';
import { useAction } from '@/hooks/useAction';
import { SettingsCard, SettingsRow } from './SettingsRow';

/** Removes finance records only, e.g. after exploring with sample data. */
export function MoneyDataSettings() {
  const { run, pending } = useAction();
  const [confirming, setConfirming] = useState(false);
  return (
    <Section title="Money data" icon={Wallet} className="settings-group">
      <SettingsCard>
        <SettingsRow
          icon={Trash2}
          tone="coral"
          title="Clear money data"
          description="Deletes transactions, investments, budgets, goals, and salary history. Habits, tasks, notes, and reviews stay."
        >
          <div className="data-actions">
            <button
              type="button"
              className="button button--secondary"
              disabled={pending}
              onClick={() => {
                setConfirming(true);
              }}
            >
              Clear money data
            </button>
          </div>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog
        open={confirming}
        title="Clear all money data?"
        message="Every transaction, investment, budget, goal, and salary entry on this device is deleted. Download a backup first if you might need them."
        confirmLabel="Clear money data"
        destructive
        pending={pending}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          void run(clearFinanceData, 'Money data cleared').then(() => {
            setConfirming(false);
          });
        }}
      />
    </Section>
  );
}
