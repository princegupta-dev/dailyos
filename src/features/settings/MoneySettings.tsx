import { ChartPie, Landmark, LifeBuoy, Repeat, Wallet, type LucideIcon } from 'lucide-react';
import { SelectField } from '@/components/form';
import { Section } from '@/components/Section';
import { getFinanceData } from '@/db/repositories/finance';
import { updateSettings } from '@/db/repositories/settings';
import { EMERGENCY_FUND_MONTHS } from '@/domain/finance';
import { useAction } from '@/hooks/useAction';
import { useLiveData } from '@/hooks/useLiveData';
import { useSettings } from '@/hooks/useToday';
import { accountOptions } from '../investments/financeUi';
import { SettingsCard, SettingsLinkRow, SettingsRow } from './SettingsRow';

const MONTH_OPTIONS = [3, 4, 6, 9, 12].map((m) => ({
  value: String(m),
  label: m === EMERGENCY_FUND_MONTHS ? `${m} months (usual)` : `${m} months`,
}));

/** Expense Tracker preferences: where to manage accounts, and defaults used when recording. */
export function MoneySettings({ icon }: { icon?: LucideIcon | undefined }) {
  const settings = useSettings();
  const finance = useLiveData(getFinanceData);
  const { run } = useAction();
  const accounts = finance.status === 'ready' ? finance.data.accounts : [];
  const months = settings?.emergencyFundMonths ?? EMERGENCY_FUND_MONTHS;
  const defaultAccount = settings?.defaultAccountId ?? '';

  return (
    <Section
      title="Money & accounts"
      icon={icon}
      description="The Expense Tracker: accounts, defaults, and targets."
      className="settings-group"
    >
      <SettingsCard>
        <SettingsLinkRow
          to="/investments/accounts"
          icon={Landmark}
          title="Accounts & assets"
          description="Bank accounts, cash, investments, loans, and cards"
        />
        <SettingsLinkRow
          to="/investments/recurring"
          icon={Repeat}
          tone="teal"
          title="Recurring payments"
          description="Rent, EMIs, SIPs, subscriptions"
        />
        <SettingsLinkRow
          to="/investments/budgets"
          icon={ChartPie}
          tone="amber"
          title="Budgets"
          description="Monthly and annual spending limits"
        />
        <SettingsRow
          icon={Wallet}
          tone="ocean"
          title="Default account"
          description="Pre-selected when you record income or spending."
        >
          <SelectField
            label="Default account"
            value={defaultAccount}
            options={accountOptions(accounts, ['cash', 'liability'], {
              selected: defaultAccount,
              none: 'None',
            })}
            disabled={accounts.length === 0}
            hint={accounts.length === 0 ? 'Add an account first.' : undefined}
            onChange={(e) => {
              const value = e.target.value;
              void run(
                () => updateSettings({ defaultAccountId: value === '' ? null : value }),
                'Default account saved',
              );
            }}
          />
        </SettingsRow>
        <SettingsRow
          icon={LifeBuoy}
          tone="coral"
          title="Emergency fund target"
          description="Months of expenses your emergency fund should cover."
        >
          <SelectField
            label="Emergency fund target"
            value={String(months)}
            options={MONTH_OPTIONS}
            onChange={(e) => {
              const value = Number(e.target.value);
              void run(
                () =>
                  updateSettings({
                    emergencyFundMonths: value === EMERGENCY_FUND_MONTHS ? null : value,
                  }),
                'Target saved',
              );
            }}
          />
        </SettingsRow>
      </SettingsCard>
    </Section>
  );
}
