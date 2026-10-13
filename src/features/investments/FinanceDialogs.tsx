import type { FinanceData } from '@/services/finance.service';
import { yearOf } from '@/services/finance.service';
import { EntryDialog } from './EntryDialog';
import type { FinanceDialogRequest } from './financeUi';
import {
  AccountDialog,
  BalanceDialog,
  BudgetDialog,
  GoalDialog,
  RecordDialog,
  SalaryDialog,
} from './PlanningDialogs';

interface FinanceDialogsProps {
  request: FinanceDialogRequest | null;
  data: FinanceData;
  today: string;
  onClose: () => void;
}

/** Renders whichever finance dialog was requested, from any screen (including Today). */
export function FinanceDialogs({ request, data, today, onClose }: FinanceDialogsProps) {
  if (request === null) return null;
  switch (request.type) {
    case 'entry':
      return (
        <EntryDialog
          data={data}
          today={today}
          entry={request.entry}
          kind={request.kind}
          preset={request.preset}
          onClose={onClose}
        />
      );
    case 'recurring':
      return (
        <EntryDialog
          data={data}
          today={today}
          rule={request.rule}
          recurring
          kind={request.kind}
          preset={request.preset}
          onClose={onClose}
        />
      );
    case 'record':
      return <RecordDialog data={data} rule={request.rule} onClose={onClose} />;
    case 'account':
      return (
        <AccountDialog
          data={data}
          today={today}
          account={request.account}
          group={request.group}
          onClose={onClose}
        />
      );
    case 'balance':
      return (
        <BalanceDialog data={data} today={today} account={request.account} onClose={onClose} />
      );
    case 'goal':
      return (
        <GoalDialog
          goal={request.goal}
          kind={request.kind}
          year={request.year ?? yearOf(today)}
          onClose={onClose}
        />
      );
    case 'budget':
      return (
        <BudgetDialog
          data={data}
          budget={request.budget}
          category={request.category}
          period={request.period}
          onClose={onClose}
        />
      );
    case 'salary':
      return <SalaryDialog salary={request.salary} today={today} onClose={onClose} />;
  }
}
