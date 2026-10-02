import { Lightbulb } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { FoundationNotice } from '@/components/FoundationNotice';
import { PageHeader } from '@/components/PageHeader';

export function LearnPage() {
  return (
    <>
      <PageHeader title="Learn" description="Capture what you learn, quickly or in depth." />
      <FoundationNotice />
      <EmptyState
        icon={Lightbulb}
        title="No learning captured yet"
        description="Quick notes and structured entries will be searchable here by topic and date."
      />
    </>
  );
}
