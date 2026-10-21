import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Field, TextArea, TextInput } from '../../../components/ui/FormControls'
import type { VenueBlockResult } from '../venueBlockService'
import type { VenueBlockField, VenueBlockInput, VenueBlockPreview as PreviewData } from '../venueBlockTypes'
import { sameBlock, validateVenueBlock } from '../venueBlockValidation'
import { SlotPicker } from './SlotPicker'
import { VenueBlockPreview } from './VenueBlockPreview'

type SaveResult = VenueBlockResult<{ blockId: string; flaggedBookings: number | null }>

interface VenueBlockFormProps {
  venueId: string
  onPreview: (input: VenueBlockInput) => Promise<VenueBlockResult<PreviewData>>
  onCreate: (input: VenueBlockInput) => Promise<SaveResult>
  /** Called after a block is saved, so the page can reload its list of blocks. */
  onSaved?: () => void
}

/** AC-012.8: says how many bookings were flagged, without claiming a count it couldn't read. */
function savedMessage(flagged: number | null): string {
  if (flagged === null) return 'Block saved. We could not confirm how many bookings were flagged; check the list below.'
  if (flagged === 0) return 'Block saved. No bookings were affected.'
  if (flagged === 1) return 'Block saved. 1 booking was flagged for review, and an email was queued for its coordinator.'
  return `Block saved. ${flagged} bookings were flagged for review, and emails were queued for their coordinators.`
}

/** AC-012.2, 3, 7, 8: Venue Staff enter a block, preview what it overlaps, then confirm it. */
export function VenueBlockForm({ venueId, onPreview, onCreate, onSaved }: VenueBlockFormProps) {
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Partial<Record<VenueBlockField, string>>>({})
  const [preview, setPreview] = useState<{ input: VenueBlockInput; result: PreviewData } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const current: VenueBlockInput = { venueId, startsOn, endsOn, startTime, endTime, slots: [], reason }
  // A preview counts only for the venue and exact period it was taken for (AC-012.7).
  const shownPreview = preview && sameBlock(preview.input, current) ? preview.result : null
  const overlapsExistingBlock = (shownPreview?.existingBlocks.length ?? 0) > 0

  /** The form's own check runs first, so each problem shows beside its field. */
  function checked(): VenueBlockInput | null {
    const result = validateVenueBlock(current)
    setErrors(result.ok ? {} : result.errors)
    return result.ok ? result.value : null
  }

  async function handlePreview() {
    setProblem(null)
    setSaved(null)
    const input = checked()
    if (!input) return
    setBusy(true)
    const result = await onPreview(input)
    setBusy(false)
    if (result.ok) {
      setPreview({ input, result: result.value })
    } else {
      setPreview(null)
      setProblem(result.reason)
    }
  }

  // Checked again: the reason can be blanked after previewing, and isn't part of the preview.
  async function handleConfirm() {
    setProblem(null)
    const input = checked()
    if (!input) return
    setBusy(true)
    const result = await onCreate(input)
    setBusy(false)
    if (!result.ok) {
      setProblem(result.reason)
      return
    }
    setStartsOn('')
    setEndsOn('')
    setStartTime('')
    setEndTime('')
    setReason('')
    setPreview(null)
    setSaved(savedMessage(result.value.flaggedBookings))
    onSaved?.()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="block-starts-on" label="Start date" required error={errors.startsOn}>
          <TextInput
            id="block-starts-on"
            type="date"
            value={startsOn}
            aria-invalid={Boolean(errors.startsOn)}
            onChange={(event) => setStartsOn(event.target.value)}
          />
        </Field>
        <Field
          id="block-ends-on"
          label="End date"
          required
          hint="The block runs continuously from the start date/time to this end date/time."
          error={errors.endsOn}
        >
          <TextInput
            id="block-ends-on"
            type="date"
            value={endsOn}
            aria-invalid={Boolean(errors.endsOn)}
            onChange={(event) => setEndsOn(event.target.value)}
          />
        </Field>
      </div>

      <SlotPicker id="block-slots" startTime={startTime} endTime={endTime}
        onChange={(start, end) => { setStartTime(start); setEndTime(end) }} disabled={busy} error={errors.startTime ?? errors.endTime ?? errors.slots} />

      <Field
        id="block-reason"
        label="Reason"
        required
        hint="Shown to Venue Staff, and in the email to coordinators of affected bookings."
        error={errors.reason}
      >
        <TextArea
          id="block-reason"
          value={reason}
          aria-invalid={Boolean(errors.reason)}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>

      {shownPreview && <VenueBlockPreview preview={shownPreview} />}

      {problem && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {problem}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {saved}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={busy} onClick={() => void handlePreview()}>
          Preview
        </Button>
        {shownPreview && (
          <Button type="button" disabled={busy || overlapsExistingBlock} onClick={() => void handleConfirm()}>
            Confirm block
          </Button>
        )}
      </div>
    </div>
  )
}
