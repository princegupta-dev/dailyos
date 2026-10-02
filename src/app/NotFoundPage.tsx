import { Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="That screen doesn't exist in DailyOS." />
      <Link to="/">Go to Today</Link>
    </>
  );
}
