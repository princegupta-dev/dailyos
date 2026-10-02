import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { FoundationNotice } from '@/components/FoundationNotice';
import { PageHeader } from '@/components/PageHeader';

export function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" description="Your inbox, planned work, and completion history." />
      <FoundationNotice />
      <EmptyState
        icon={Inbox}
        title="Your inbox is empty"
        description="New tasks land here until you plan them for a day."
      />
    </>
  );
}
