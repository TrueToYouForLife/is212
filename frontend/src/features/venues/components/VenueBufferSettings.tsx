import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { bufferDuration, getBufferSettings, saveBufferSettings } from '../venueBufferSettingsService'
import type { BufferSettings } from '../venueBufferSettingsService'

export function VenueBufferSettings({ venueId }: { venueId: string }) {
 const [settings, setSettings] = useState<BufferSettings | null>(null)
 const [setup, setSetup] = useState('')
 const [turnaround, setTurnaround] = useState('')
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState<string | null>(null)
 const [stale, setStale] = useState(false)
 const [message, setMessage] = useState<string | null>(null)
 const load = useCallback(async (cancelled: () => boolean = () => false) => {
  setSettings(null); setError(null); setMessage(null)
  const result = await getBufferSettings(venueId)
  if (cancelled()) return
  if (result.ok) {
   setSettings(result.value); setSetup(String(result.value.setupMinutes)); setTurnaround(String(result.value.turnaroundMinutes)); setStale(false)
  } else setError(result.reason)
 }, [venueId])
 useEffect(() => { let cancelled = false; void load(() => cancelled); return () => { cancelled = true } }, [load])
 async function save(event: React.FormEvent) {
  event.preventDefault()
  if (!settings || busy || stale) return
  setMessage(null)
  if (!setup.trim() || !turnaround.trim() || !bufferDuration.safeParse(Number(setup)).success || !bufferDuration.safeParse(Number(turnaround)).success) {
   setError('Enter non-negative whole minutes in multiples of 15.'); return
  }
  setBusy(true); setError(null)
  const result = await saveBufferSettings(venueId, { version: settings.version, setupMinutes: Number(setup), turnaroundMinutes: Number(turnaround) })
  setBusy(false)
  if (!result.ok) { setError(result.reason); setStale(result.stale === true); return }
  setSettings(result.value)
  setMessage(`Timing settings saved. ${result.value.reviewCount} booking(s) need review. Existing reservations were preserved.`)
 }
 return <Card title="Setup and turnaround">
  <p className="mb-4 text-sm text-slate-600">Set durations for this venue in 15-minute increments. Zero means none. These apply when a Coordinator places a hold. Conflicting existing arrangements are flagged for review and the relevant users are notified according to their notification settings.</p>
  {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
  {message && <p role="status" className="mb-3 text-sm text-emerald-800">{message}</p>}
  {!settings && !error && <p>Loading timing settings…</p>}
  {settings && <form onSubmit={save} noValidate className="space-y-4">
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">Setup duration (minutes)
     <input className="mt-1 block w-full rounded border border-slate-300 p-2" type="number" min="0" step="15" value={setup} onChange={e => setSetup(e.target.value)} disabled={busy || stale} />
    </label>
    <label className="text-sm font-medium">Turnaround duration (minutes)
     <input className="mt-1 block w-full rounded border border-slate-300 p-2" type="number" min="0" step="15" value={turnaround} onChange={e => setTurnaround(e.target.value)} disabled={busy || stale} />
    </label>
   </div>
   <Button type="submit" disabled={busy || stale}>{busy ? 'Saving timing settings…' : 'Save timing settings'}</Button>
  </form>}
  {error && <button type="button" disabled={busy} className="mt-3 text-sm font-medium text-indigo-700" onClick={() => void load()}>Reload timing settings</button>}
 </Card>
}
