import { Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { fullName, initials, profileCompletion } from '@/domain/profile';
import { useSession } from '../auth/session-context';
import { useProfile } from './profile-context';

/** Who's signed in: picture, name, email, and how complete the profile is. */
export function ProfileSummaryCard() {
  const { session } = useSession();
  const { profile } = useProfile();
  const name = fullName(profile.personal) || session?.user.name || 'Your profile';
  const completion = profileCompletion(profile);

  return (
    <section className="profile-card" aria-labelledby="profile-title">
      <div className="profile-card__main">
        <span className="profile-card__avatar" aria-hidden="true">
          {profile.personal.photo ? (
            <img src={profile.personal.photo} alt="" />
          ) : (
            initials(profile.personal)
          )}
        </span>
        <div className="profile-card__text">
          <h2 id="profile-title" className="profile-card__name">
            {name}
          </h2>
          {session && (
            <p className="profile-card__meta">
              {session.user.email}
              <span className="profile-card__provider">
                {session.user.provider === 'google' ? 'Google' : 'Email'}
              </span>
            </p>
          )}
        </div>
        <Link to="/profile/personal" className="profile-card__edit">
          <Pencil size={14} aria-hidden="true" />
          Edit
        </Link>
      </div>

      <div className="profile-completion">
        <div className="profile-completion__head">
          <span>Profile completion</span>
          <span className="profile-completion__value">{completion}%</span>
        </div>
        <div
          className="profile-completion__track"
          role="progressbar"
          aria-label="Profile completion"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completion}
        >
          <span className="profile-completion__fill" style={{ width: `${String(completion)}%` }} />
        </div>
      </div>
    </section>
  );
}
