import { describe, expect, it } from 'vitest';
import {
  emptyProfile,
  profileCompletion,
  sampleProfile,
  summarizeSection,
  validateHealth,
  validatePersonal,
} from '@/domain/profile';

describe('profile', () => {
  it('measures completion from empty to fully filled', () => {
    expect(profileCompletion(emptyProfile())).toBe(0);
    const full = sampleProfile();
    expect(profileCompletion({ ...full, personal: { ...full.personal, photo: 'data:x' } })).toBe(
      100,
    );
  });

  it('requires a first name, a past date of birth, and a country', () => {
    const personal = emptyProfile().personal;
    expect(Object.keys(validatePersonal(personal)).sort()).toEqual([
      'country',
      'dateOfBirth',
      'firstName',
    ]);
    expect(
      validatePersonal({ ...personal, firstName: 'A', country: 'India', dateOfBirth: '2999-01-01' })
        .dateOfBirth,
    ).toMatch(/future/);
  });

  it('checks height ranges in the chosen unit', () => {
    const health = emptyProfile().health;
    expect(validateHealth({ ...health, height: '170', heightUnit: 'cm' }).height).toBeUndefined();
    expect(validateHealth({ ...health, height: '170', heightUnit: 'ft' }).height).toBeDefined();
  });

  it('summarizes sections, and says when one is empty', () => {
    expect(summarizeSection(sampleProfile(), 'professional')).toBe(
      'Software Developer, Tech Almond Solutions, Hybrid',
    );
    expect(summarizeSection(emptyProfile(), 'health')).toBe('Not added yet');
  });
});
