import { beforeEach, describe, expect, it } from 'vitest';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { resetDatabase } from '../helpers/db';

beforeEach(async () => {
  await resetDatabase('UTC');
});

describe('display name', () => {
  it('saves a trimmed name and removes it when cleared', async () => {
    await updateSettings({ displayName: '  Sam  ' });
    expect((await getSettings()).displayName).toBe('Sam');

    await updateSettings({ displayName: '' });
    expect((await getSettings()).displayName).toBeUndefined();
  });

  it('rejects a name that is too long', async () => {
    await expect(updateSettings({ displayName: 'x'.repeat(41) })).rejects.toMatchObject({
      kind: 'validation',
    });
  });
});
