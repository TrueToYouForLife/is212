import { useRef, useState } from 'react'
import { setEventRegistration } from '../registrationSettingService'

interface Props {
  eventId: string
  enabled: boolean
  onChanged: () => void
}

/** The assigned coordinator's switch for attendee registration (AC-052.1). Turning it off
 *  stops new registrations only; people already registered keep theirs (AC-052.4). */
export function RegistrationSettingPanel({ eventId, enabled, onChanged }: Props) {
  const pending = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setError(null)
    try {
      const result = await setEventRegistration(eventId, !enabled)
      if (!result.ok) { setError(result.reason); return }
      onChanged()
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-700">
        Attendee registration is <strong>{enabled ? 'enabled' : 'disabled'}</strong>.
        {enabled
          ? ' Turning it off stops new registrations; existing registrations are kept.'
          : ' Turn it on to let attendees register for this event.'}
      </p>
      <button type="button" onClick={() => void toggle()} disabled={saving}
        className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? 'Saving…' : enabled ? 'Disable registration' : 'Enable registration'}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  )
}
