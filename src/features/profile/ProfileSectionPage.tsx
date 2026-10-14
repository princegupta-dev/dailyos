import { useContext, useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { ToastContext } from '@/components/toast-context';
import { hasErrors, type FieldErrors, type ProfileSectionKey } from '@/domain/profile';
import { SubpageHero } from '../settings/SubpageHero';
import { useProfile } from './profile-context';
import { SectionEditor } from './ProfileFields';
import { sectionMeta, validateSection } from './sections';

/** Viewing and editing one section of the profile, prefilled with what's there now. */
export function ProfileSectionPage({ section }: { section: ProfileSectionKey }) {
  const meta = sectionMeta(section);
  const { profile, saveSection } = useProfile();
  const notify = useContext(ToastContext);
  const navigate = useNavigate();
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState<FieldErrors>({});
  const dirty = JSON.stringify(draft[section]) !== JSON.stringify(profile[section]);

  const save = (event: SyntheticEvent) => {
    event.preventDefault();
    const problems = validateSection(draft, section);
    setErrors(problems);
    if (hasErrors(problems)) return;
    saveSection(section, draft[section]);
    notify({ kind: 'success', message: `${meta.title} saved` });
    void navigate('/profile');
  };

  return (
    <div className="settings-page">
      <SubpageHero
        eyebrow={meta.subtitle}
        title={meta.title}
        parent={{ to: '/profile', label: 'Profile' }}
      />
      <form className="profile-edit" onSubmit={save} noValidate>
        <SectionEditor section={section} value={draft} onChange={setDraft} errors={errors} />
        {hasErrors(errors) && (
          <p className="field__error" role="alert">
            Check the highlighted fields to save.
          </p>
        )}
        <div className="form__actions profile-edit__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void navigate('/profile')}
          >
            Cancel
          </button>
          <button type="submit" className="button button--primary settings-save" disabled={!dirty}>
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
