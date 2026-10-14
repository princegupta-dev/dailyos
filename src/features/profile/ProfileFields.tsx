import { Camera, Trash2, UserRound } from 'lucide-react';
import { useId, useState, type ChangeEvent } from 'react';
import { SelectField, TextField } from '@/components/form';
import { TagInput } from '@/components/TagInput';
import {
  ACTIVITY_OPTIONS,
  ALLERGY_SUGGESTIONS,
  BLOOD_GROUP_OPTIONS,
  CONDITION_SUGGESTIONS,
  COUNTRY_OPTIONS,
  DIET_OPTIONS,
  EXERCISE_SUGGESTIONS,
  GENDER_OPTIONS,
  HEIGHT_UNIT_OPTIONS,
  HOBBY_SUGGESTIONS,
  initials,
  QUALIFICATION_OPTIONS,
  WEEKDAYS,
  WEIGHT_UNIT_OPTIONS,
  WORK_MODE_OPTIONS,
  type FieldErrors,
  type HealthInfo,
  type HeightUnit,
  type LifestyleInfo,
  type PersonalInfo,
  type ProfessionalInfo,
  type ProfileSectionKey,
  type UserProfile,
  type WeightUnit,
} from '@/domain/profile';

/**
 * The fields for each profile section. Profile setup shows one section per step; each
 * Profile edit screen shows one section with Save. Both share these, so they never drift.
 */
interface SectionFieldsProps<T> {
  value: T;
  onChange: (value: T) => void;
  errors: FieldErrors;
}

/** Binds a text input to one key of a section. */
function bind<T>(value: T, onChange: (value: T) => void, key: keyof T & string) {
  return {
    value: value[key] as string,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange({ ...value, [key]: event.target.value });
    },
  };
}

const optional = (label: string) => `${label} (optional)`;

/* ---------- Personal ---------- */

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function AvatarPicker({
  personal,
  onChange,
}: {
  personal: PersonalInfo;
  onChange: (photo: string | undefined) => void;
}) {
  const inputId = useId();
  const [error, setError] = useState<string>();

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (JPG, PNG, or similar).');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('That image is over 5 MB. Choose a smaller one.');
      return;
    }
    setError(undefined);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const hasName = personal.firstName.trim() !== '' || personal.lastName.trim() !== '';
  return (
    <div className="avatar-picker">
      <div className="avatar-picker__frame">
        <span className="avatar avatar--xl" aria-hidden="true">
          {personal.photo ? (
            <img src={personal.photo} alt="" />
          ) : hasName ? (
            initials(personal)
          ) : (
            <UserRound size={36} />
          )}
        </span>
        <label htmlFor={inputId} className="avatar-picker__camera" title="Upload photo">
          <Camera size={16} aria-hidden="true" />
          <span className="visually-hidden">
            {personal.photo ? 'Change profile picture' : 'Upload profile picture'}
          </span>
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={choose}
        />
      </div>
      {personal.photo && (
        <button
          type="button"
          className="link-button avatar-picker__remove"
          onClick={() => {
            onChange(undefined);
          }}
        >
          <Trash2 size={14} aria-hidden="true" /> Remove photo
        </button>
      )}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : (
        <p className="field__hint">JPG or PNG, up to 5 MB</p>
      )}
    </div>
  );
}

export function PersonalFields({ value, onChange, errors }: SectionFieldsProps<PersonalInfo>) {
  const field = (key: keyof PersonalInfo) => bind(value, onChange, key);
  return (
    <div className="form">
      <AvatarPicker
        personal={value}
        onChange={(photo) => {
          onChange({ ...value, photo });
        }}
      />
      <div className="form__row">
        <TextField
          label="First name"
          autoComplete="given-name"
          maxLength={40}
          required
          error={errors.firstName}
          {...field('firstName')}
        />
        <TextField
          label={optional('Last name')}
          autoComplete="family-name"
          maxLength={40}
          {...field('lastName')}
        />
      </div>
      <TextField
        label="Date of birth"
        type="date"
        autoComplete="bday"
        min="1900-01-01"
        required
        error={errors.dateOfBirth}
        {...field('dateOfBirth')}
      />
      <SelectField label="Gender" options={GENDER_OPTIONS} {...field('gender')} />
      <div className="form__row">
        <SelectField
          label="Country"
          options={COUNTRY_OPTIONS}
          required
          error={errors.country}
          {...field('country')}
        />
        <TextField
          label={optional('City')}
          autoComplete="address-level2"
          maxLength={60}
          {...field('city')}
        />
      </div>
    </div>
  );
}

/* ---------- Health ---------- */

export function HealthFields({ value, onChange, errors }: SectionFieldsProps<HealthInfo>) {
  const field = (key: keyof HealthInfo) => bind(value, onChange, key);
  return (
    <div className="form">
      <div className="form__row form__row--unit">
        <TextField
          label="Height"
          type="number"
          inputMode="decimal"
          step="0.1"
          error={errors.height}
          {...field('height')}
        />
        <SelectField
          label="Height unit"
          options={HEIGHT_UNIT_OPTIONS}
          value={value.heightUnit}
          onChange={(e) => {
            onChange({ ...value, heightUnit: e.target.value as HeightUnit });
          }}
        />
      </div>
      <div className="form__row form__row--unit">
        <TextField
          label="Current weight"
          type="number"
          inputMode="decimal"
          step="0.1"
          error={errors.weight}
          {...field('weight')}
        />
        <SelectField
          label="Weight unit"
          options={WEIGHT_UNIT_OPTIONS}
          value={value.weightUnit}
          onChange={(e) => {
            onChange({ ...value, weightUnit: e.target.value as WeightUnit });
          }}
        />
      </div>
      <TextField
        label={optional('Target weight')}
        type="number"
        inputMode="decimal"
        step="0.1"
        hint={`In ${value.weightUnit}`}
        error={errors.targetWeight}
        {...field('targetWeight')}
      />
      <div className="form__row">
        <SelectField
          label="Activity level"
          options={ACTIVITY_OPTIONS}
          {...field('activityLevel')}
        />
        <SelectField label="Dietary preference" options={DIET_OPTIONS} {...field('diet')} />
      </div>
      <div className="form__row">
        <TextField
          label="Sleep target"
          type="number"
          inputMode="decimal"
          step="0.5"
          hint="Hours per night"
          error={errors.sleepTarget}
          {...field('sleepTarget')}
        />
        <SelectField label="Blood group" options={BLOOD_GROUP_OPTIONS} {...field('bloodGroup')} />
      </div>
      <TagInput
        label={optional('Food allergies')}
        placeholder="Add an allergy"
        tags={value.allergies}
        suggestions={ALLERGY_SUGGESTIONS}
        onChange={(allergies) => {
          onChange({ ...value, allergies });
        }}
      />
      <TagInput
        label={optional('Medical conditions')}
        placeholder="Add a condition"
        tags={value.conditions}
        suggestions={CONDITION_SUGGESTIONS}
        onChange={(conditions) => {
          onChange({ ...value, conditions });
        }}
      />
    </div>
  );
}

/* ---------- Professional ---------- */

export function ProfessionalFields({
  value,
  onChange,
  errors,
}: SectionFieldsProps<ProfessionalInfo>) {
  const field = (key: keyof ProfessionalInfo) => bind(value, onChange, key);
  return (
    <div className="form">
      <TextField
        label="Occupation"
        autoComplete="organization-title"
        maxLength={60}
        required
        error={errors.occupation}
        {...field('occupation')}
      />
      <TextField
        label={optional('Company')}
        autoComplete="organization"
        maxLength={60}
        {...field('company')}
      />
      <SelectField label="Work mode" options={WORK_MODE_OPTIONS} {...field('workMode')} />
      <div className="form__row">
        <TextField label="Work start time" type="time" {...field('workStart')} />
        <TextField label="Work end time" type="time" error={errors.workEnd} {...field('workEnd')} />
      </div>
      <div className="form__row">
        <TextField
          label="Experience (years)"
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          error={errors.experienceYears}
          {...field('experienceYears')}
        />
        <SelectField
          label="Highest qualification"
          options={QUALIFICATION_OPTIONS}
          {...field('qualification')}
        />
      </div>
    </div>
  );
}

/* ---------- Lifestyle ---------- */

export function LifestyleFields({ value, onChange, errors }: SectionFieldsProps<LifestyleInfo>) {
  const field = (key: keyof LifestyleInfo) => bind(value, onChange, key);
  return (
    <div className="form">
      <div className="form__row">
        <TextField label="Wake-up time" type="time" {...field('wakeTime')} />
        <TextField
          label="Sleep time"
          type="time"
          error={errors.sleepTime}
          {...field('sleepTime')}
        />
      </div>
      <fieldset className="fieldset">
        <legend className="field__label">Exercise days</legend>
        <div className="weekday-picker">
          {WEEKDAYS.map(({ day, short, label }) => (
            <label key={day} className="weekday-chip">
              <input
                type="checkbox"
                aria-label={label}
                checked={value.exerciseDays.includes(day)}
                onChange={(e) => {
                  const days = e.target.checked
                    ? [...value.exerciseDays, day]
                    : value.exerciseDays.filter((d) => d !== day);
                  onChange({ ...value, exerciseDays: days });
                }}
              />
              <span aria-hidden="true">{short}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <TagInput
        label="Preferred exercise"
        placeholder="Add an activity"
        tags={value.exercises}
        suggestions={EXERCISE_SUGGESTIONS}
        onChange={(exercises) => {
          onChange({ ...value, exercises });
        }}
      />
      <TagInput
        label={optional('Hobbies & interests')}
        placeholder="Add a hobby"
        tags={value.hobbies}
        suggestions={HOBBY_SUGGESTIONS}
        onChange={(hobbies) => {
          onChange({ ...value, hobbies });
        }}
      />
    </div>
  );
}

/* ---------- Any section ---------- */

interface SectionEditorProps {
  section: ProfileSectionKey;
  /** The whole draft profile; only `section` is shown and changed. */
  value: UserProfile;
  onChange: (value: UserProfile) => void;
  errors: FieldErrors;
}

/** The fields for one section of a draft profile. */
export function SectionEditor({ section, value, onChange, errors }: SectionEditorProps) {
  switch (section) {
    case 'personal':
      return (
        <PersonalFields
          value={value.personal}
          errors={errors}
          onChange={(personal) => {
            onChange({ ...value, personal });
          }}
        />
      );
    case 'health':
      return (
        <HealthFields
          value={value.health}
          errors={errors}
          onChange={(health) => {
            onChange({ ...value, health });
          }}
        />
      );
    case 'professional':
      return (
        <ProfessionalFields
          value={value.professional}
          errors={errors}
          onChange={(professional) => {
            onChange({ ...value, professional });
          }}
        />
      );
    case 'lifestyle':
      return (
        <LifestyleFields
          value={value.lifestyle}
          errors={errors}
          onChange={(lifestyle) => {
            onChange({ ...value, lifestyle });
          }}
        />
      );
  }
}
