import { Moon, PenLine, Settings, Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { useDayPart, type DayPart } from '@/hooks/useDayPart';
import { useSettings, useTimeZone } from '@/hooks/useToday';
import { formatDateKey } from '@/lib/dates';

const GREETINGS: Record<DayPart, { text: string; icon: LucideIcon }> = {
  morning: { text: 'Good morning', icon: Sunrise },
  afternoon: { text: 'Good afternoon', icon: Sun },
  evening: { text: 'Good evening', icon: Sunset },
  night: { text: 'Hello, night owl', icon: Moon },
};

/**
 * True once `ref`'s element has scrolled out of view. Stays false where IntersectionObserver
 * isn't available, so the page simply keeps its regular header.
 */
function useScrolledPast(ref: RefObject<HTMLElement | null>): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return past;
}

interface TodayHeaderProps {
  today: string;
  onCapture: () => void;
}

/**
 * Greeting, the date as the page title, and the capture and settings actions. Once the
 * header scrolls away, a compact frosted bar keeps the date and capture within reach.
 */
export function TodayHeader({ today, onCapture }: TodayHeaderProps) {
  const greeting = GREETINGS[useDayPart(useTimeZone())];
  const GreetingIcon = greeting.icon;
  const name = useSettings()?.displayName;
  const headerRef = useRef<HTMLElement>(null);
  const scrolledPast = useScrolledPast(headerRef);
  const weekday = formatDateKey(today, undefined, { weekday: 'long' });
  const date = formatDateKey(today, undefined, { month: 'long', day: 'numeric' });

  return (
    <>
      <header ref={headerRef} className="today-header">
        <div className="today-header__text">
          <p className="today-header__greeting">
            <GreetingIcon size={16} aria-hidden="true" />
            <span>
              {greeting.text}
              {name ? `, ${name}` : ''}
            </span>
          </p>
          <h1 className="today-header__title">
            <span className="today-header__weekday">{weekday},</span>{' '}
            <span className="today-header__date">{date}</span>
          </h1>
        </div>
        <div className="today-header__actions">
          <button
            type="button"
            className="today-header__capture"
            aria-label="Capture a note or task"
            aria-keyshortcuts="C"
            title="Capture a note or task (C)"
            onClick={onCapture}
          >
            <PenLine size={18} aria-hidden="true" />
            <span className="today-header__capture-label" aria-hidden="true">
              Capture
            </span>
            <kbd className="today-header__shortcut" aria-hidden="true">
              C
            </kbd>
          </button>
          <Link
            to="/settings"
            className="icon-button today-header__settings"
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={20} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {scrolledPast && (
        <div className="today-minibar">
          <p className="today-minibar__date">
            <span className="today-minibar__weekday">{weekday}</span> {date}
          </p>
          <button
            type="button"
            className="today-minibar__capture"
            aria-label="Quick capture"
            onClick={onCapture}
          >
            <PenLine size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
