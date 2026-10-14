import { CircleHelp, Mail, MessageSquareHeart } from 'lucide-react';
import { useContext, useState, type SyntheticEvent } from 'react';
import { SelectField, TextAreaField } from '@/components/form';
import { Section } from '@/components/Section';
import { ToastContext } from '@/components/toast-context';
import { SettingsCard, SettingsRow } from '../settings/SettingsRow';
import { SubpageHero } from '../settings/SubpageHero';

const FAQS = [
  {
    q: 'Does DailyOS work offline?',
    a: 'Yes. Install it from your browser and it keeps working without a connection. Signing in needs a connection the first time.',
  },
  {
    q: 'Who can see my data?',
    a: 'Only you. Your habits, money and reflections are private to your account.',
  },
  {
    q: 'How do I change how I sign in?',
    a: 'Open Account & security from your Profile to see your sign-in method and, for email accounts, change your password.',
  },
  {
    q: 'Can I export my data?',
    a: 'Yes. Data & privacy lets you download a full backup at any time and restore it later.',
  },
] as const;

const FEEDBACK_TYPES = [
  { value: 'idea', label: 'An idea' },
  { value: 'problem', label: 'Something isn’t working' },
  { value: 'praise', label: 'Something I love' },
] as const;

/** FAQs, how to reach us, and a feedback form (not sent anywhere yet). */
export function HelpSupportPage() {
  return (
    <div className="settings-page">
      <SubpageHero
        eyebrow="We’re here to help"
        title="Help & support"
        parent={{ to: '/profile', label: 'Profile' }}
      />

      <Section title="Frequently asked" icon={CircleHelp} className="settings-group">
        <div className="faq-list">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="disclosure faq">
              <summary className="disclosure__summary">{q}</summary>
              <p className="disclosure__body">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section title="Contact" icon={Mail} className="settings-group">
        <SettingsCard>
          <SettingsRow
            icon={Mail}
            tone="ocean"
            title="Email support"
            description="Email support is coming soon. Until then, send us feedback below."
          />
        </SettingsCard>
      </Section>

      <FeedbackForm />
    </div>
  );
}

function FeedbackForm() {
  const notify = useContext(ToastContext);
  const [type, setType] = useState('idea');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (message.trim().length < 10) {
      setError('Tell us a little more (at least 10 characters).');
      return;
    }
    setError(undefined);
    setMessage('');
    notify({ kind: 'success', message: 'Thanks for your feedback!' });
  };

  return (
    <Section title="Send feedback" icon={MessageSquareHeart} className="settings-group">
      <form className="form settings-form-card" onSubmit={submit} noValidate>
        <SelectField
          label="What’s it about?"
          options={FEEDBACK_TYPES}
          value={type}
          onChange={(e) => {
            setType(e.target.value);
          }}
        />
        <TextAreaField
          label="Your feedback"
          rows={4}
          maxLength={1000}
          value={message}
          error={error}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
        />
        <div className="form__actions">
          <button type="submit" className="button button--primary settings-save">
            Send feedback
          </button>
        </div>
      </form>
    </Section>
  );
}
