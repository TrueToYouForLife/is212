import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { formatPlainDate } from '../slotFormat'
import type { SlotCode } from '../slots'
import type { VenueBlockResult } from '../venueBlockService'
import type { VenueBlock } from '../venueBlockTypes'
import { BLOCK_SLOTS } from '../venueBlockValidation'
import { QUARTER_HOUR_OPTIONS } from '../quarterHourSlots'

interface VenueBlockListProps {
  blocks: VenueBlock[]
  /** Leave out to show the list read-only. */
  onRemove?: (blockId: string) => Promise<VenueBlockResult<null>>
  /** Called after a block is removed, so the page can reload the list. */
  onRemoved?: () => void
}

// Venues are in Singapore, so a block's time is shown there whatever the viewer's timezone.
const CREATED_AT = new Intl.DateTimeFormat('en-SG', {
  timeZone: 'Asia/Singapore',
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDates(block: VenueBlock): string {
  return block.startsOn === block.endsOn
    ? formatPlainDate(block.startsOn)
    : `${formatPlainDate(block.startsOn)} – ${formatPlainDate(block.endsOn)}`
}

/** Merge adjacent cells for readable ranges; preserve gaps in converted legacy blocks. */
function formatSlots(slots: readonly SlotCode[]): string {
  if (BLOCK_SLOTS.every((code) => slots.includes(code))) return 'Full day'
  const ranges: string[] = []
  let start: number | null = null
  for (let index = 0; index <= BLOCK_SLOTS.length; index++) {
    if (index < BLOCK_SLOTS.length && slots.includes(BLOCK_SLOTS[index])) {
      start ??= index
    } else if (start !== null) {
      ranges.push(`${QUARTER_HOUR_OPTIONS[start].label.slice(0, 5)}–${QUARTER_HOUR_OPTIONS[index - 1].label.slice(-5)}`)
      start = null
    }
  }
  return ranges.join(', ')
}

function formatCreated(block: VenueBlock): string {
  const who = block.createdByName ?? 'Venue Staff'
  return `Blocked by ${who} on ${CREATED_AT.format(new Date(block.createdAt))}`
}

/** AC-012.9, 10: a venue's current blocks, with why and by whom, and removal after confirming. */
export function VenueBlockList({ blocks, onRemove, onRemoved }: VenueBlockListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [problem, setProblem] = useState<{ blockId: string; reason: string } | null>(null)

  async function remove(blockId: string) {
    if (!onRemove) return
    setProblem(null)
    setRemovingId(blockId)
    const result = await onRemove(blockId)
    setRemovingId(null)
    setConfirmingId(null)
    if (result.ok) onRemoved?.()
    else setProblem({ blockId, reason: result.reason })
  }

  if (blocks.length === 0) {
    return <p className="text-sm text-slate-500">No current blocks on this venue.</p>
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {blocks.map((block) => (
        <li key={block.id} className="space-y-2 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="font-medium text-slate-900">{formatDates(block)}</span>
                <span className="text-slate-600">{formatSlots(block.slots)}</span>
              </p>
              <p className="text-sm text-slate-700">{block.reason}</p>
              <p className="text-xs text-slate-500">{formatCreated(block)}</p>
            </div>
            {onRemove && confirmingId !== block.id && (
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                onClick={() => {
                  setProblem(null)
                  setConfirmingId(block.id)
                }}
              >
                Remove
              </button>
            )}
          </div>

          {confirmingId === block.id && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                Remove this block? Its slots become bookable again, and the bookings it flagged no longer
                need review.
              </p>
              <div className="mt-2 flex gap-2">
                <Button type="button" disabled={removingId === block.id} onClick={() => void remove(block.id)}>
                  Yes, remove
                </Button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                  disabled={removingId === block.id}
                  onClick={() => setConfirmingId(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {problem?.blockId === block.id && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {problem.reason}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
