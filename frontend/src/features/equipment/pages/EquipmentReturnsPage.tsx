import { Link } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { EquipmentReturnsView } from '../components/EquipmentReturnsView'

export function EquipmentReturnsPage() {
  const { profile, loading } = useCurrentUser()
  return <PageContainer>
    <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">Equipment returns</h1>
    {loading ? <p role="status">Checking access…</p>
      : profile?.role === 'tech_support' ? <>
        <p className="mb-4"><Link to="/equipment/catalogue" className="text-indigo-700 underline">Equipment catalogue and general status management</Link></p>
        <EquipmentReturnsView key={`${profile.id}:${profile.role}`} />
      </> : <p>This page is for Technical Support Staff.</p>}
  </PageContainer>
}
