/** The Organiser's free text, shown for reference while the Coordinator turns it into
 * catalogue lines (AC-013.1). It is never parsed or edited here. */
export function OrganiserEquipmentRequest({ text }: { text: string | null }) {
  const request = text?.trim()
  return <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h2 className="text-sm font-semibold text-slate-900">Organiser's equipment request</h2>
    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
      {request || 'The organiser did not list any equipment.'}
    </p>
  </section>
}
