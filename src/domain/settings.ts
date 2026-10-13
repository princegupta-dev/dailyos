import { z } from 'zod';
import { idSchema, timestampSchema } from '@/lib/validation';

export const SETTINGS_ID = 'app';

export const settingsSchema = z.object({
  id: z.literal(SETTINGS_ID),
  /** IANA zone. Absent means "follow the device". */
  timeZone: z.string().min(1).optional(),
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  lastBackupAt: timestampSchema.optional(),
  /** How the app greets you, e.g. on Today. Absent means no name is used. */
  displayName: z.string().trim().min(1).max(40).optional(),
  /** Months of expenses an emergency fund should cover. Absent means the usual six. */
  emergencyFundMonths: z.number().int().min(1).max(24).optional(),
  /** Account pre-selected when recording money. Absent means none. */
  defaultAccountId: idSchema.optional(),
  updatedAt: timestampSchema,
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_WEEK_STARTS_ON: 0 | 1 = 1;
