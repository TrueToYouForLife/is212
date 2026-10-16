import { useEffect, useState } from 'react'
import {
  addRequirement, loadCatalogue, loadEventRequirements, removeRequirement, updateRequirement,
} from '../equipmentRequirementService'
import { canManageRequirements } from '../validation'
import { OrganiserEquipmentRequest } from './OrganiserEquipmentRequest'
import { RequirementForm } from './RequirementForm'
import { RequirementList } from './RequirementList'
import type { EquipmentRequirement, EquipmentType, EventRequirements, RequirementFormInput, Viewer } from '../types'

interface EquipmentRequirementsEditorProps {
  eventId: string
  viewer: Viewer
}

export function EquipmentRequirementsEditor({ eventId, viewer }: EquipmentRequirementsEditorProps) {
  const [data, setData] = useState<EventRequirements | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [catalogue, setCatalogue] = useState<EquipmentType[]>([])
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EquipmentRequirement | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    void loadEventRequirements(eventId).then((result) => {
      if (!current) return
      if (result.ok) setData(result.data)
      else setLoadError(result.reason)
    })
    void loadCatalogue().then((result) => {
      if (!current) return
      if (result.ok) setCatalogue(result.data)
      else setCatalogueError(result.reason)
    })
    return () => { current = false }
  }, [eventId])

  if (loadError) return <p role="alert" className="text-sm text-red-700">{loadError}</p>
  if (!data) return <p className="text-sm text-slate-500">Loading equipment requirements…</p>

  const canManage = canManageRequirements(data.event, viewer)

  function replaceRequirements(change: (lines: EquipmentRequirement[]) => EquipmentRequirement[]) {
    setData((previous) => previous && { ...previous, requirements: change(previous.requirements) })
  }

  async function save(input: RequirementFormInput): Promise<boolean> {
    setBusy(true)
    setSaveError(null)
    const target = editing
    const result = target
      ? await updateRequirement(target.id, input, catalogue)
      : await addRequirement(eventId, input, catalogue)
    setBusy(false)
    if (!result.ok) { setSaveError(result.reason); return false }
    // The saved row comes back from the database, so a reset to pending review shows at once.
    replaceRequirements((lines) => target
      ? lines.map((line) => line.id === target.id ? result.data : line)
      : [...lines, result.data])
    setEditing(null)
    return true
  }

  async function remove(requirement: EquipmentRequirement) {
    setBusy(true)
    setSaveError(null)
    const result = await removeRequirement(requirement.id)
    setBusy(false)
    if (!result.ok) { setSaveError(result.reason); return }
    replaceRequirements((lines) => lines.filter((line) => line.id !== requirement.id))
    if (editing?.id === requirement.id) setEditing(null)
  }

  return <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
    <OrganiserEquipmentRequest text={data.event.organiserEquipment} />
    <div className="space-y-4">
      {!canManage && viewer.role === 'coordinator' && <p className="text-sm text-slate-600">
        Read-only: only the assigned Event Coordinator can change these requirements, while the
        event is approved, planning or confirmed.
      </p>}
      <RequirementList requirements={data.requirements} canManage={canManage} busy={busy}
        onEdit={setEditing} onRemove={remove} />
      {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
      {canManage && <RequirementForm key={editing?.id ?? 'new'} catalogue={catalogue} catalogueError={catalogueError}
        editing={editing} busy={busy} onSubmit={save} onCancel={() => setEditing(null)} />}
    </div>
  </div>
}
