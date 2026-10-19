import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import {
  CLARIFICATION_MESSAGES,
  validateClarificationResponse,
} from './clarificationResponseValidation'
import type { ClarificationResponseInput } from './clarificationResponseValidation'
import type { EventRequestDetail } from './types'

/**
 * US37 (SCRUM-234): sending an Organiser's answer to a clarification request, and reading
 * the rounds already answered.
 *
 * Separate from eventReviewService, which is the Coordinator's review path, and from
 * eventService, which owns submission. This is the Organiser answering mid-review — a third
 * audience with a third set of rules, and the one module that may talk to 0096.
 *
 * There is no write path to the response record itself: 0096 grants SELECT and nothing
 * else, and respond_to_clarification writes it as the function owner.
 */

export const CLARIFICATION_SERVICE_MESSAGES = {
  unavailable: 'Sign in as the organiser who owns this request to reply.',
  reload: 'The request has changed. Reload it before replying.',
  rejected: 'The revised details were refused. Reload the request and check them.',
  failed: 'The reply could not be confirmed. Reload to check whether it was recorded.',
  historyFailed: 'The replies you have already sent could not be loaded.',
} as const

export interface ClarificationRound {
  id: string
  round: number
  /** The question as it stood when this round was answered, not the event's current note. */
  reviewNote: string
  reply: string
  beforeValues: Record<string, unknown>
  afterValues: Record<string, unknown>
  respondedAt: string
}

export type LoadResult<T> = { ok: true; value: T } | { ok: false; reason: string }
export type RespondResult = { ok: true; responseId: string } | { ok: false; reason: string }

interface ClarificationRow {
  id: string
  round: number
  review_note: string
  reply: string
  before_values: Record<string, unknown> | null
  after_values: Record<string, unknown> | null
  responded_at: string
}

function toRound(row: ClarificationRow): ClarificationRound {
  return {
    id: row.id,
    round: row.round,
    reviewNote: row.review_note,
    reply: row.reply,
    beforeValues: row.before_values ?? {},
    afterValues: row.after_values ?? {},
    respondedAt: row.responded_at,
  }
}

/**
 * Every round answered so far, newest first. Read straight from the table rather than
 * through a projection: 0096's policy already scopes it to the owning Organiser and the
 * assigned Coordinator, and unlike the US4 decision log there is nothing internal in it to
 * withhold — responded_by is the Organiser themselves.
 */
export async function loadClarificationRounds(
  eventId: string,
): Promise<LoadResult<ClarificationRound[]>> {
  if (!z.string().uuid().safeParse(eventId).success) {
    return { ok: false, reason: CLARIFICATION_SERVICE_MESSAGES.historyFailed }
  }

  const { data, error } = await supabase
    .from('event_clarification_responses')
    .select('id, round, review_note, reply, before_values, after_values, responded_at')
    .eq('event_id', eventId)
    .order('round', { ascending: false })

  if (error) {
    console.error('[events] loadClarificationRounds', error)
    return { ok: false, reason: CLARIFICATION_SERVICE_MESSAGES.historyFailed }
  }

  return { ok: true, value: ((data ?? []) as ClarificationRow[]).map(toRound) }
}

/**
 * Answer the outstanding question.
 *
 * request.updatedAt is the version the Organiser was shown, and it is passed through
 * untouched. Never refresh it just before writing: 0096 uses it to catch a Coordinator who
 * returned the request a second time with a different question, and a freshly read value
 * would defeat exactly the check it exists for. Its absence is a reason to reload, not to
 * send the answer unversioned — 0096 refuses a null version anyway (AC-037.2.4), and
 * failing here gives the Organiser something they can act on.
 *
 * An uncertain write is never retried: the request may already be back under review, and a
 * second attempt would be refused as not-awaiting-clarification, which reads as a bug
 * rather than as the duplicate it is.
 */
export async function sendClarificationResponse(
  request: EventRequestDetail,
  input: ClarificationResponseInput,
): Promise<RespondResult> {
  if (!z.string().uuid().safeParse(request.id).success) {
    return { ok: false, reason: CLARIFICATION_SERVICE_MESSAGES.reload }
  }
  if (!request.updatedAt) {
    return { ok: false, reason: CLARIFICATION_SERVICE_MESSAGES.reload }
  }

  const validation = validateClarificationResponse(request, input)
  if (!validation.ok) return validation

  try {
    const { data, error } = await supabase.rpc('respond_to_clarification', {
      p_event_id: request.id,
      p_updates: validation.updates,
      p_reply: validation.reply,
      p_expected_updated_at: request.updatedAt,
    })

    if (error) {
      console.error('[events] sendClarificationResponse', error)
      // 22000 covers both "not awaiting your clarification" and a stale version, and both
      // are answered the same way: look at the request again. 23514 and 23503 are the
      // catalogue-code and layout constraints from 0054 refusing a revised requirement.
      const reason = error.code === '42501' ? CLARIFICATION_SERVICE_MESSAGES.unavailable
        : error.code === '22000' ? CLARIFICATION_SERVICE_MESSAGES.reload
          : error.code === '22023' ? CLARIFICATION_MESSAGES.replyRequired
            : error.code === '23514' || error.code === '23503'
              ? CLARIFICATION_SERVICE_MESSAGES.rejected
              : CLARIFICATION_SERVICE_MESSAGES.failed
      return { ok: false, reason }
    }

    if (typeof data !== 'string' || !data) {
      return { ok: false, reason: CLARIFICATION_SERVICE_MESSAGES.failed }
    }
    return { ok: true, responseId: data }
  } catch {
    return { ok: false, reason: CLARIFICATION_SERVICE_MESSAGES.failed }
  }
}
