import { Repeat } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Section } from '@/components/Section';
import { useToday } from '@/hooks/useToday';
import { HabitDayList } from '../habits/HabitDayList';
import { DailyIntention, DailyPriorities } from '../planning/DailyIntention';
import { TodayTasks } from '../planning/TodayTasks';
import { EveningReview } from '../reviews/EveningReview';
import { MoneySnapshot } from './MoneySnapshot';
import { QuickCaptureDialog } from './QuickCaptureDialog';
import { TodayHeader } from './TodayHeader';
import { TodayOverview } from './TodayOverview';

/**
 * The daily command center, one column top to bottom: an overview, habits, money,
 * priorities, tasks, intention, and the evening review.
 * Kept deliberately short so planning takes a couple of minutes.
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

      <div className="today__stack">
        <TodayOverview today={today} />
        <div className="today__block today__block--habits">
          <Section title="Habits" icon={Repeat} meta={<Link to="/habits">All habits</Link>}>
            <HabitDayList date={today} today={today} />
          </Section>
        </div>
        <div className="today__block today__block--money">
          <MoneySnapshot today={today} />
        </div>
        <div className="today__block today__block--priorities">
          <DailyPriorities date={today} />
        </div>
        <div className="today__block today__block--tasks">
          <TodayTasks today={today} />
        </div>
        <div className="today__block today__block--intention">
          <DailyIntention date={today} />
        </div>
        <div className="today__block today__block--review">
          <EveningReview today={today} />
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
