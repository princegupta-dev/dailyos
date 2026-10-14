import { ArrowLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import { useContext, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { ToastContext } from '@/components/toast-context';
import { hasErrors, summarizeSection, type FieldErrors } from '@/domain/profile';
import { useSession } from '../auth/session-context';
import { useProfile } from '../profile/profile-context';
import { SectionEditor } from '../profile/ProfileFields';
import { PROFILE_SECTIONS, validateSection } from '../profile/sections';

const REVIEW_STEP = PROFILE_SECTIONS.length;
const STEP_COUNT = PROFILE_SECTIONS.length + 1;

/**
 * Profile setup after a first sign-in: one step per profile section, then a review. Each
 * step is saved to the profile as you continue, so leaving early keeps what you entered.
 */
export function ProfileSetupPage() {
  const { profile, saveSection } = useProfile();
  const { finishProfileSetup } = useSession();
  const notify = useContext(ToastContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState<FieldErrors>({});
  /** Set when a step was opened from the review, so Continue returns there. */
  const [fromReview, setFromReview] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const goTo = (next: number) => {
    setErrors({});
    setStep(next);
  };

  const section = PROFILE_SECTIONS[step];

  const submitStep = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!section) return;
    const problems = validateDraft();
    setErrors(problems);
    if (hasErrors(problems)) return;
    saveSection(section.key, draft[section.key]);
    setFromReview(false);
    goTo(fromReview ? REVIEW_STEP : step + 1);
  };

  const validateDraft = (): FieldErrors => {
    if (!section) return {};
    return validateSection(draft, section.key);
  };

  const back = () => {
    if (step === 0) {
      void navigate('/auth/success');
      return;
    }
    if (fromReview) {
      // Leaving an edit opened from the review: drop unsaved changes to that step.
      setDraft(profile);
      setFromReview(false);
      goTo(REVIEW_STEP);
      return;
    }
    goTo(step - 1);
  };

  const finish = (completed: boolean) => {
    finishProfileSetup();
    if (completed) notify({ kind: 'success', message: 'Profile set up. Welcome to DailyOS!' });
    void navigate('/', { replace: true });
  };

  const title = section ? section.title : 'Review your information';
  const subtitle = section ? section.subtitle : 'Make sure everything looks good.';

  return (
    <div className="auth">
      <main id="main" className="auth__card auth__card--wide onboarding">
        <div className="onboarding__top">
          <button type="button" className="icon-button" aria-label="Back" onClick={back}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div className="onboarding__progress">
            <p className="onboarding__step-label">
              Step {step + 1} of {STEP_COUNT}
            </p>
            <div
              className="onboarding__bar"
              role="progressbar"
              aria-label="Profile setup progress"
              aria-valuemin={1}
              aria-valuemax={STEP_COUNT}
              aria-valuenow={step + 1}
              aria-valuetext={`Step ${String(step + 1)} of ${String(STEP_COUNT)}: ${title}`}
            >
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <span
                  key={i}
                  className={`onboarding__segment${i <= step ? ' onboarding__segment--done' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>

        <header className="auth__header">
          <h1 ref={headingRef} className="auth__title" tabIndex={-1}>
            {title}
          </h1>
          <p className="auth__subtitle">{subtitle}</p>
        </header>

        {section ? (
          <form className="onboarding__form" onSubmit={submitStep} noValidate>
            <SectionEditor
              section={section.key}
              value={draft}
              onChange={setDraft}
              errors={errors}
            />
            {hasErrors(errors) && (
              <p className="field__error" role="alert">
                Check the highlighted fields to continue.
              </p>
            )}
            <button type="submit" className="button button--primary button--block">
              {fromReview ? 'Save and review' : 'Continue'}
            </button>
          </form>
        ) : (
          <div className="onboarding__review">
            <ul className="review-list">
              {PROFILE_SECTIONS.map((s, index) => {
                const Icon = s.icon;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      className="review-item"
                      aria-label={`Edit ${s.title}`}
                      onClick={() => {
                        setDraft(profile);
                        setFromReview(true);
                        goTo(index);
                      }}
                    >
                      <span className={`settings-row__icon tone--${s.tone}`} aria-hidden="true">
                        <Icon size={17} />
                      </span>
                      <span className="review-item__text">
                        <span className="review-item__title">{s.title}</span>
                        <span className="review-item__summary">
                          {summarizeSection(profile, s.key)}
                        </span>
                      </span>
                      <ChevronRight size={18} className="review-item__chevron" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="onboarding__note">
              <ClipboardCheck size={16} aria-hidden="true" /> You can change any of this later from
              your Profile.
            </p>
            <button
              type="button"
              className="button button--primary button--block"
              onClick={() => {
                finish(true);
              }}
            >
              Complete setup
            </button>
            <button
              type="button"
              className="link-button link-button--center"
              onClick={() => {
                finish(false);
              }}
            >
              Skip for now
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
