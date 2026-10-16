import type { EquipmentType } from '../types'

/**
 * The Organiser's equipment request, shown for reference while the Coordinator turns it
 * into catalogue lines (AC-013.1). It is never edited here.
 *
 * Since 0054 the organiser picks from equipment_types rather than typing a sentence, so
 * this is a list of codes. The catalogue is already loaded by the editor for its own
 * picker, so it is passed in to turn each code into its name; a code with no match is
 * shown as itself rather than dropped.
 */
export function OrganiserEquipmentRequest({
  codes,
  catalogue = [],
}: {
  codes: readonly string[]
  catalogue?: readonly EquipmentType[]
}) {
  const named = codes.map((code) => catalogue.find((type) => type.code === code)?.name ?? code)

  return <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h2 className="text-sm font-semibold text-slate-900">Organiser's equipment request</h2>
    {named.length === 0 ? (
      <p className="mt-2 text-sm text-slate-700">The organiser did not list any equipment.</p>
    ) : (
      <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
        {named.map((name, index) => <li key={`${codes[index]}`}>{name}</li>)}
      </ul>
    )}
  </section>
}
