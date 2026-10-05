import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoryIcon } from '@/components/CategoryIcon';
import type { HabitCategory } from '@/domain/categories';

describe('CategoryIcon', () => {
  it('uses the habit’s own icon and tone over its category’s', () => {
    const { container } = render(<CategoryIcon category="fitness" icon="bike" tone="teal" />);
    expect(container.firstElementChild).toHaveClass('tone--teal');
    expect(container.querySelector('svg')).toHaveClass('lucide-bike');
  });

  it('falls back instead of crashing on values it doesn’t know', () => {
    const { container } = render(
      <CategoryIcon category={'astronomy' as HabitCategory} icon={undefined} />,
    );
    expect(container.firstElementChild).toHaveClass('tone--slate');
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
