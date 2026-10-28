import { PageContainer } from '../../../components/layout/PageContainer'
import { useCurrentUser } from '../../auth/sessionContext'
import { EquipmentCatalogueView } from '../components/EquipmentCatalogueView'

export function EquipmentCataloguePage() {
  const { profile, loading } = useCurrentUser()
  return <PageContainer>
    <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">Equipment catalogue</h1>
    {loading ? <p role="status">Loading…</p>
      : profile && ['coordinator', 'tech_support'].includes(profile.role)
        ? <EquipmentCatalogueView key={`${profile.id}:${profile.role}`} canManage={profile.role === 'tech_support'} />
        : <p>This page is for Technical Support Staff and Event Coordinators.</p>}
  </PageContainer>
}
