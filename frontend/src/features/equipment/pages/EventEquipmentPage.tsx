import { Link, useParams } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { EquipmentRequirementsEditor } from '../components/EquipmentRequirementsEditor'
import { EquipmentOutcomeNotices } from '../components/EquipmentOutcomeNotices'

/** One route for every role: RLS decides what loads and canManageRequirements only hides
 * controls the database would refuse anyway. */
export function EventEquipmentPage() {
  const { id = '' } = useParams()
  const { profile, loading } = useCurrentUser()

  return <PageContainer>
    <nav aria-label="Breadcrumb" className="mb-6 text-xs text-slate-500">
      <Link to="/requests" className="hover:text-slate-900 hover:underline">Requests</Link>
      <span aria-hidden="true" className="mx-2">/</span>
      <Link to={`/requests/${id}`} className="hover:text-slate-900 hover:underline">Request</Link>
      <span aria-hidden="true" className="mx-2">/</span>
      <span className="text-slate-700">Equipment</span>
    </nav>
    <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Equipment requirements</h1>
    {/* US14 outcomes for the coordinator; RLS returns only their own notices. */}
    {profile?.role === 'coordinator' && <EquipmentOutcomeNotices key={`notices:${id}:${profile.id}`} eventId={id} />}
    {loading ? <p className="text-sm text-slate-500">Loading…</p>
      : !profile ? <p className="text-sm text-slate-600">Sign in to view equipment requirements.</p>
        : <EquipmentRequirementsEditor key={`${id}:${profile.id}`} eventId={id}
          viewer={{ id: profile.id, role: profile.role }} />}
  </PageContainer>
}
