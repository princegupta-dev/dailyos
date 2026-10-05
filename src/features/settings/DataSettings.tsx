import {
  CircleAlert,
  CloudDownload,
  Download,
  FileCheck2,
  ShieldCheck,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { ConfirmDialog } from '@/components/Dialog';
import { Section } from '@/components/Section';
import {
  exportBackup,
  markBackupSaved,
  MAX_BACKUP_BYTES,
  previewMerge,
  readBackupText,
  restoreBackup,
  type MergePlan,
  type RestoreMode,
} from '@/db/repositories/backup';
import {
  BACKUP_TABLE_LABELS,
  BACKUP_TABLES,
  type BackupCheck,
  type BackupCounts,
} from '@/domain/backup';
import { useAction } from '@/hooks/useAction';
import { useSettings, useTimeZone, useToday } from '@/hooks/useToday';
import { daysBetween, toLocalDateKey } from '@/lib/dates';
import { downloadTextFile, readFileText } from '@/lib/files';
import { formatFullTimestamp } from '@/lib/format';
import { SettingsCard, SettingsRow } from './SettingsRow';

interface Selected {
  fileName: string;
  check: BackupCheck;
  merge?: MergePlan | undefined;
}

const total = (counts: BackupCounts) =>
  BACKUP_TABLES.reduce((sum, t) => (t === 'settings' ? sum : sum + counts[t]), 0);

const records = (n: number) => `${n} ${n === 1 ? 'record' : 'records'}`;

/** Problems listed when a file is rejected; the first few are enough to recognise the cause. */
const SHOWN_ISSUES = 5;

function mergeSummary(merge: MergePlan): string {
  const added = total(merge.added);
  const kept = total(merge.kept);
  if (added === 0)
    return 'Nothing new to add: everything in this backup is already on this device.';
  const already =
    kept === 0
      ? ''
      : ` ${records(kept)} from the backup ${kept === 1 ? 'is' : 'are'} already here.`;
  return `Adds ${records(added)} from the backup and keeps everything on this device as it is.${already}`;
}

/** A backup older than this many days is gently flagged. */
const STALE_AFTER_DAYS = 7;

/** Download a full backup, and restore one after checking it and showing what will change. */
export function DataSettings({ icon }: { icon?: LucideIcon | undefined }) {
  const settings = useSettings();
  const timeZone = useTimeZone();
  const today = useToday();
  const { run, pending, notify } = useAction();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [confirmReplace, setConfirmReplace] = useState(false);

  const download = () => {
    void run(async () => {
      const backup = await exportBackup();
      downloadTextFile(`dailyos-backup-${today}.json`, JSON.stringify(backup, null, 2));
      await markBackupSaved(backup.exportedAt);
    }, 'Backup downloaded');
  };

  const reset = () => {
    setSelected(null);
    setMode('merge');
    setConfirmReplace(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void run(async () => {
      const check: BackupCheck =
        file.size > MAX_BACKUP_BYTES
          ? { ok: false, message: 'This file is too large to be a DailyOS backup.', issues: [] }
          : readBackupText(await readFileText(file));
      const merge = check.ok ? await previewMerge(check.backup) : undefined;
      setMode('merge');
      setSelected({ fileName: file.name, check, merge });
    });
  };

  const backupAge = settings?.lastBackupAt
    ? daysBetween(toLocalDateKey(new Date(settings.lastBackupAt), timeZone), today)
    : null;
  const fresh = backupAge !== null && backupAge <= STALE_AFTER_DAYS;

  const preview =
    selected?.check.ok && selected.merge
      ? { fileName: selected.fileName, ...selected.check, merge: selected.merge }
      : null;

  const restore = () => {
    if (!preview) return;
    const { backup } = preview;
    void run(() => restoreBackup(backup, mode)).then((result) => {
      if (!result.ok) return;
      notify({
        kind: 'success',
        message:
          mode === 'replace'
            ? 'Backup restored. This device now matches the backup.'
            : `Backup restored. ${records(total(result.value.added))} added.`,
      });
      reset();
    });
  };

  return (
    <Section
      title="Data and privacy"
      icon={icon}
      description="Yours alone, kept on this device."
      className="settings-group"
    >
      <SettingsCard>
        <SettingsRow
          icon={ShieldCheck}
          title="Private by design"
          description="Everything is stored only in this browser on this device: no account, no tracking, nothing sent anywhere. Clearing site data or losing the device deletes it, so download a backup now and then."
        />
        <SettingsRow icon={fresh ? FileCheck2 : CircleAlert} tone={fresh ? 'sage' : 'amber'}>
          <p className="settings-row__title">Backup</p>
          <p className="settings-row__description">
            {settings?.lastBackupAt
              ? `Last backup: ${formatFullTimestamp(settings.lastBackupAt, timeZone)}`
              : 'No backup downloaded yet.'}
          </p>
          <span className={`backup-health${fresh ? ' backup-health--fresh' : ''}`}>
            {backupAge === null
              ? 'Worth doing soon'
              : fresh
                ? 'Up to date'
                : `${backupAge} days ago · time for a fresh one`}
          </span>
        </SettingsRow>
        <SettingsRow icon={CloudDownload} tone="ocean">
          <div className="data-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={pending}
              onClick={download}
            >
              <Download size={18} aria-hidden="true" /> Download backup
            </button>
            <label className="button button--secondary file-button">
              <Upload size={18} aria-hidden="true" /> Restore from file
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                disabled={pending}
                onChange={choose}
              />
            </label>
          </div>
        </SettingsRow>
      </SettingsCard>

      {selected && !selected.check.ok && (
        <div className="backup-panel backup-panel--error" role="alert">
          <p className="backup-panel__title">Can’t restore {selected.fileName}</p>
          <p className="small">{selected.check.message}</p>
          {selected.check.issues.length > 0 && (
            <ul className="backup-issues">
              {selected.check.issues.slice(0, SHOWN_ISSUES).map((issue, index) => (
                <li key={index}>
                  {issue.path && <code>{issue.path}</code>} {issue.message}
                </li>
              ))}
              {selected.check.issues.length > SHOWN_ISSUES && (
                <li>…and more problems in the same file.</li>
              )}
            </ul>
          )}
          <p className="small">Nothing on this device was changed.</p>
          <button
            type="button"
            className="button button--secondary button--compact"
            onClick={reset}
          >
            Dismiss
          </button>
        </div>
      )}

      {preview && (
        <section className="backup-panel" aria-label="Backup preview">
          <p className="backup-panel__title">{preview.fileName}</p>
          <p className="muted small">
            Exported {formatFullTimestamp(preview.backup.exportedAt, timeZone)} ·{' '}
            {records(total(preview.counts))}
          </p>
          <dl className="backup-counts">
            {BACKUP_TABLES.filter((t) => t !== 'settings' && preview.counts[t] > 0).map((t) => (
              <div key={t} className="backup-counts__row">
                <dt>{BACKUP_TABLE_LABELS[t]}</dt>
                <dd>{preview.counts[t]}</dd>
              </div>
            ))}
          </dl>

          <fieldset className="fieldset">
            <legend className="field__label">How to restore</legend>
            <label className="option-card">
              <input
                type="radio"
                name="restore-mode"
                checked={mode === 'merge'}
                onChange={() => {
                  setMode('merge');
                }}
              />
              <span>
                <span className="option-card__label">Add what’s new</span>
                <span className="option-card__hint">{mergeSummary(preview.merge)}</span>
              </span>
            </label>
            <label className="option-card">
              <input
                type="radio"
                name="restore-mode"
                checked={mode === 'replace'}
                onChange={() => {
                  setMode('replace');
                }}
              />
              <span>
                <span className="option-card__label">Replace everything</span>
                <span className="option-card__hint">
                  Deletes what’s on this device now, including settings, and restores the backup
                  exactly.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="form__actions">
            <button type="button" className="button button--secondary" onClick={reset}>
              Cancel
            </button>
            <button
              type="button"
              className={`button ${mode === 'replace' ? 'button--danger' : 'button--primary'}`}
              disabled={pending}
              onClick={() => {
                if (mode === 'replace') setConfirmReplace(true);
                else restore();
              }}
            >
              Restore backup
            </button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmReplace}
        title="Replace everything on this device?"
        message="Your current habits, tasks, notes, reviews and settings will be deleted and replaced by the backup. If you might need them, cancel and download a backup first."
        confirmLabel="Replace everything"
        destructive
        pending={pending}
        onCancel={() => {
          setConfirmReplace(false);
        }}
        onConfirm={restore}
      />
    </Section>
  );
}
