import { Repeat } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import { useToday } from '@/hooks/useToday';
import { HabitDayList } from '../habits/HabitDayList';
import { DailyIntention } from '../planning/DailyIntention';
import { TodayTasks } from '../planning/TodayTasks';
import { EveningReview } from '../reviews/EveningReview';
import { QuickCaptureDialog } from './QuickCaptureDialog';
import { TodayHeader } from './TodayHeader';
import { TodayProgress } from './TodayProgress';

/**
 * The daily command center: date, progress, habits, focus, tasks, and the evening review.
 * Kept deliberately short so planning takes a couple of minutes.
 *
 * On wide screens the doing (habits, tasks) sits in a main column beside the overview and
 * reflection (progress, intention, evening review). On narrow screens both columns dissolve
 * into one list, ordered for a morning check-in (see `.today__block` in today.css).
 */
export function TodayPage() {
  const today = useToday();
  const [capturing, setCapturing] = useState(false);
  useCaptureShortcut(setCapturing);

  return (
    <div className="today">
      <TodayHeader
        today={today}
        onCapture={() => {
          setCapturing(true);
        }}
      />

      <div className="today__grid">
        <div className="today__main">
          <div className="today__block today__block--habits">
            <Section
              title="Habits"
              icon={Repeat}
              description="Small, steady wins"
              meta={<Link to="/habits">All habits</Link>}
            >
              <HabitDayList date={today} today={today} />
            </Section>
          </div>
          <div className="today__block today__block--tasks">
            <TodayTasks today={today} />
          </div>
        </div>

        <div className="today__side">
          <div className="today__block today__block--progress">
            <TodayProgress today={today} />
          </div>
          <div className="today__block today__block--intention">
            <DailyIntention date={today} />
          </div>
          <div className="today__block today__block--review">
            <EveningReview today={today} />
          </div>
        </div>
      </div>

      {capturing && (
        <QuickCaptureDialog
          today={today}
          onClose={() => {
            setCapturing(false);
          }}
        />
      )}
    </div>
  );
}

/** True when keystrokes are going into a text field rather than the page. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Pressing C opens quick capture, unless the person is typing, holding a modifier, or
 * already in a dialog.
 */
function useCaptureShortcut(setCapturing: (capturing: boolean) => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'c' && event.key !== 'C') return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if (isTyping(event.target) || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      setCapturing(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setCapturing]);
}
