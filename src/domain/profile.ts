/**
 * The person behind an account: who they are, their health, work and routine. Used by profile
 * setup and the Profile screens. For now it lives only in frontend state (see
 * features/profile/ProfileProvider); nothing here knows how it will be stored or synced.
 */

export type HeightUnit = 'cm' | 'ft';
export type WeightUnit = 'kg' | 'lb';

export interface PersonalInfo {
  /** A data URL for the chosen picture, or undefined for initials. */
  photo: string | undefined;
  firstName: string;
  lastName: string;
  /** YYYY-MM-DD, or '' when not given. */
  dateOfBirth: string;
  gender: string;
  country: string;
  city: string;
}

export interface HealthInfo {
  height: string;
  heightUnit: HeightUnit;
  weight: string;
  weightUnit: WeightUnit;
  targetWeight: string;
  activityLevel: string;
  diet: string;
  sleepTarget: string;
  bloodGroup: string;
  allergies: string[];
  conditions: string[];
}

export interface ProfessionalInfo {
  occupation: string;
  company: string;
  workMode: string;
  /** HH:MM, 24-hour, or ''. */
  workStart: string;
  workEnd: string;
  experienceYears: string;
  qualification: string;
}

export interface LifestyleInfo {
  wakeTime: string;
  sleepTime: string;
  /** 0 = Sunday … 6 = Saturday. */
  exerciseDays: number[];
  exercises: string[];
  hobbies: string[];
}

export interface UserProfile {
  personal: PersonalInfo;
  health: HealthInfo;
  professional: ProfessionalInfo;
  lifestyle: LifestyleInfo;
}

export type ProfileSectionKey = keyof UserProfile;

export type FieldErrors = Partial<Record<string, string>>;

/* ---------- Options ---------- */

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));
const withNone = (placeholder: string, values: readonly string[]) => [
  { value: '', label: placeholder },
  ...options(values),
];

export const GENDER_OPTIONS = withNone('Prefer not to say', [
  'Female',
  'Male',
  'Non-binary',
  'Other',
]);

export const COUNTRY_OPTIONS = withNone('Select a country', [
  'Australia',
  'Canada',
  'France',
  'Germany',
  'India',
  'Japan',
  'Singapore',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Other',
]);

export const ACTIVITY_OPTIONS = withNone('Select level', [
  'Sedentary',
  'Lightly active',
  'Moderately active',
  'Very active',
  'Athlete',
]);

export const DIET_OPTIONS = withNone('No preference', [
  'Vegetarian',
  'Vegan',
  'Eggetarian',
  'Pescatarian',
  'Non-vegetarian',
  'Keto',
  'Other',
]);

export const BLOOD_GROUP_OPTIONS = withNone("Don't know", [
  'A+',
  'A−',
  'B+',
  'B−',
  'AB+',
  'AB−',
  'O+',
  'O−',
]);

export const WORK_MODE_OPTIONS = withNone('Select work mode', [
  'On-site',
  'Hybrid',
  'Remote',
  'Freelance',
  'Not working',
]);

export const QUALIFICATION_OPTIONS = withNone('Select qualification', [
  'High school',
  'Diploma',
  'BTech (Computer Science)',
  "Bachelor's degree",
  "Master's degree",
  'Doctorate',
  'Other',
]);

export const HEIGHT_UNIT_OPTIONS = [
  { value: 'cm', label: 'cm' },
  { value: 'ft', label: 'ft' },
] as const;

export const WEIGHT_UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const;

export const ALLERGY_SUGGESTIONS = ['Peanuts', 'Dairy', 'Gluten', 'Shellfish', 'Eggs', 'Soy'];
export const CONDITION_SUGGESTIONS = ['Asthma', 'Diabetes', 'Hypertension', 'Thyroid', 'PCOS'];
export const EXERCISE_SUGGESTIONS = [
  'Walking',
  'Running',
  'Yoga',
  'Zumba',
  'Strength training',
  'Cycling',
  'Swimming',
];
export const HOBBY_SUGGESTIONS = ['Reading', 'Travel', 'Music', 'Cooking', 'Photography', 'Art'];

/** Monday-first, as the picker shows them. */
export const WEEKDAYS = [
  { day: 1, short: 'M', label: 'Monday' },
  { day: 2, short: 'T', label: 'Tuesday' },
  { day: 3, short: 'W', label: 'Wednesday' },
  { day: 4, short: 'T', label: 'Thursday' },
  { day: 5, short: 'F', label: 'Friday' },
  { day: 6, short: 'S', label: 'Saturday' },
  { day: 0, short: 'S', label: 'Sunday' },
] as const;

/* ---------- Defaults and sample data ---------- */

export function emptyProfile(): UserProfile {
  return {
    personal: {
      photo: undefined,
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      country: '',
      city: '',
    },
    health: {
      height: '',
      heightUnit: 'cm',
      weight: '',
      weightUnit: 'kg',
      targetWeight: '',
      activityLevel: '',
      diet: '',
      sleepTarget: '',
      bloodGroup: '',
      allergies: [],
      conditions: [],
    },
    professional: {
      occupation: '',
      company: '',
      workMode: '',
      workStart: '',
      workEnd: '',
      experienceYears: '',
      qualification: '',
    },
    lifestyle: { wakeTime: '', sleepTime: '', exerciseDays: [], exercises: [], hobbies: [] },
  };
}

/** Prefilled sample data so every screen has something to show before real data exists. */
export function sampleProfile(name?: string): UserProfile {
  const [first = 'Anushka', ...rest] = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const last = rest.join(' ') || (name ? '' : 'Gupta');
  return {
    personal: {
      photo: undefined,
      firstName: first,
      lastName: last,
      dateOfBirth: '2001-05-15',
      gender: 'Female',
      country: 'India',
      city: 'Noida',
    },
    health: {
      height: '5.0',
      heightUnit: 'ft',
      weight: '58.6',
      weightUnit: 'kg',
      targetWeight: '55',
      activityLevel: 'Moderately active',
      diet: 'Vegetarian',
      sleepTarget: '7',
      bloodGroup: 'B+',
      allergies: [],
      conditions: [],
    },
    professional: {
      occupation: 'Software Developer',
      company: 'Tech Almond Solutions',
      workMode: 'Hybrid',
      workStart: '09:30',
      workEnd: '18:30',
      experienceYears: '1',
      qualification: 'BTech (Computer Science)',
    },
    lifestyle: {
      wakeTime: '06:30',
      sleepTime: '23:30',
      exerciseDays: [1, 2, 3, 4, 5],
      exercises: ['Zumba', 'Strength training', 'Walking'],
      hobbies: ['Reading', 'Travel', 'Music'],
    },
  };
}

/* ---------- Validation ---------- */

const isBlank = (value: string) => value.trim() === '';

function checkNumber(
  errors: FieldErrors,
  key: string,
  value: string,
  { min, max, label }: { min: number; max: number; label: string },
) {
  if (isBlank(value)) return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    errors[key] = `Enter a ${label} between ${String(min)} and ${String(max)}.`;
  }
}

/** Today's date as YYYY-MM-DD in local time. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function validatePersonal(info: PersonalInfo): FieldErrors {
  const errors: FieldErrors = {};
  if (isBlank(info.firstName)) errors.firstName = 'Enter your first name.';
  if (isBlank(info.dateOfBirth)) {
    errors.dateOfBirth = 'Enter your date of birth.';
  } else if (info.dateOfBirth > localToday()) {
    errors.dateOfBirth = 'Date of birth can’t be in the future.';
  } else if (info.dateOfBirth < '1900-01-01') {
    errors.dateOfBirth = 'Enter a date after 1900.';
  }
  if (isBlank(info.country)) errors.country = 'Choose your country.';
  return errors;
}

export function validateHealth(info: HealthInfo): FieldErrors {
  const errors: FieldErrors = {};
  const height = info.heightUnit === 'cm' ? { min: 50, max: 272 } : { min: 1.6, max: 8.9 };
  checkNumber(errors, 'height', info.height, { ...height, label: 'height' });
  const weight = info.weightUnit === 'kg' ? { min: 20, max: 300 } : { min: 44, max: 660 };
  checkNumber(errors, 'weight', info.weight, { ...weight, label: 'weight' });
  checkNumber(errors, 'targetWeight', info.targetWeight, { ...weight, label: 'weight' });
  checkNumber(errors, 'sleepTarget', info.sleepTarget, { min: 3, max: 14, label: 'number' });
  return errors;
}

export function validateProfessional(info: ProfessionalInfo): FieldErrors {
  const errors: FieldErrors = {};
  if (isBlank(info.occupation)) errors.occupation = 'Enter your occupation.';
  checkNumber(errors, 'experienceYears', info.experienceYears, {
    min: 0,
    max: 60,
    label: 'number',
  });
  if (info.workStart && info.workEnd && info.workStart === info.workEnd) {
    errors.workEnd = 'End time should differ from start time.';
  }
  return errors;
}

export function validateLifestyle(info: LifestyleInfo): FieldErrors {
  const errors: FieldErrors = {};
  if (info.wakeTime && info.sleepTime && info.wakeTime === info.sleepTime) {
    errors.sleepTime = 'Sleep time should differ from wake-up time.';
  }
  return errors;
}

export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

/* ---------- Display ---------- */

export function fullName(personal: PersonalInfo): string {
  return [personal.firstName, personal.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}

export function initials(personal: PersonalInfo): string {
  const letters = [personal.firstName, personal.lastName]
    .map((s) => s.trim().charAt(0).toUpperCase())
    .join('');
  return letters || '?';
}

/** "6:30 AM" from "06:30". */
export function formatTime(value: string): string {
  const [h, m] = value.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return value;
  const date = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function formatBirthDate(value: string): string {
  if (!value) return '';
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

const joinParts = (parts: (string | false | undefined)[]) =>
  parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(', ');

/** One line per section, for review cards and profile rows. */
export function summarizeSection(profile: UserProfile, key: ProfileSectionKey): string {
  const { personal, health, professional, lifestyle } = profile;
  let summary = '';
  switch (key) {
    case 'personal':
      summary = joinParts([fullName(personal), formatBirthDate(personal.dateOfBirth)]);
      break;
    case 'health':
      summary = joinParts([
        health.height && `${health.height} ${health.heightUnit}`,
        health.weight && `${health.weight} ${health.weightUnit}`,
        health.activityLevel,
      ]);
      break;
    case 'professional':
      summary = joinParts([professional.occupation, professional.company, professional.workMode]);
      break;
    case 'lifestyle':
      summary = joinParts([
        lifestyle.wakeTime && `Wake ${formatTime(lifestyle.wakeTime)}`,
        lifestyle.sleepTime && `Sleep ${formatTime(lifestyle.sleepTime)}`,
      ]);
      break;
  }
  return summary || 'Not added yet';
}

/** Share of the profile's fields that are filled in, 0–100. Optional lists count once. */
export function profileCompletion(profile: UserProfile): number {
  const { personal, health, professional, lifestyle } = profile;
  const filled = [
    personal.photo !== undefined,
    personal.firstName,
    personal.lastName,
    personal.dateOfBirth,
    personal.gender,
    personal.country,
    personal.city,
    health.height,
    health.weight,
    health.targetWeight,
    health.activityLevel,
    health.diet,
    health.sleepTarget,
    health.bloodGroup,
    professional.occupation,
    professional.workMode,
    professional.workStart,
    professional.workEnd,
    professional.experienceYears,
    professional.qualification,
    lifestyle.wakeTime,
    lifestyle.sleepTime,
    lifestyle.exerciseDays.length > 0,
    lifestyle.exercises.length > 0,
    lifestyle.hobbies.length > 0,
  ];
  const count = filled.filter((v) => (typeof v === 'string' ? v.trim() !== '' : v)).length;
  return Math.round((count / filled.length) * 100);
}
