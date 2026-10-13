import { useOutletContext } from 'react-router';
import type { FinanceData } from '@/services/finance.service';
import type { OpenFinanceDialog } from './financeUi';

/** What the Investments layout hands to each of its screens. */
export interface FinanceOutlet {
  data: FinanceData;
  today: string;
  open: OpenFinanceDialog;
}

/** The finance records (live), today, and a way to open the shared dialogs. */
export function useFinance(): FinanceOutlet {
  return useOutletContext<FinanceOutlet>();
}
