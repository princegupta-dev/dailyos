import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="That screen doesn't exist in DailyOS." />
      <EmptyState
        icon={Compass}
        title="Nothing here"
        description="The link may be out of date, or the item may have been deleted."
      />
      <div className="section__action">
        <Link to="/" className="button button--primary">
          Go to Today
        </Link>
      </div>
    </>
  );
}
