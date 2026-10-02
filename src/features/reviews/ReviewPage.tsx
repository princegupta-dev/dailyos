import { CalendarRange } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { FoundationNotice } from '@/components/FoundationNotice';
import { PageHeader } from '@/components/PageHeader';

export function ReviewPage() {
  return (
    <>
      <PageHeader title="Review" description="Daily, weekly, and monthly reflection." />
      <FoundationNotice />
      <EmptyState
        icon={CalendarRange}
        title="No reviews yet"
        description="Reviews compare your plans with what actually happened, using your own records."
      />
    </>
  );
}
