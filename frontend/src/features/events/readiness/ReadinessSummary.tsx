import { Link } from 'react-router-dom'
import { readinessLink } from './readinessLinks'
import type { ReadinessLine } from './types'

/**
 * US5: an event's arrangements, each marked Complete or Outstanding (AC-005.3) by an icon,
 * a word and a colour together, so it never depends on colour alone. Outstanding ones link to
 * where they are dealt with (AC-005.5). Any line the database sends is shown, including ones
 * later stories add.
 */
export function ReadinessSummary({ eventId, lines }: { eventId: string; lines: ReadinessLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-slate-600">No arrangements are needed for this event yet.</p>
  }
  const done = lines.filter((line) => line.complete).length
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700">
        {done === lines.length ? 'Every arrangement is complete.' : `${done} of ${lines.length} arrangements complete.`}
      </p>
      <ul aria-label="Arrangements" className="divide-y divide-slate-100">
        {lines.map((line) => {
          const link = line.complete ? null : readinessLink(line.arrangement, eventId)
          return (
            <li key={line.arrangement} data-complete={line.complete} className="flex flex-wrap items-start gap-3 py-3">
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  line.complete ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                }`}
              >
                <span aria-hidden="true">{line.complete ? '✓' : '!'}</span>
                {line.complete ? 'Complete' : 'Outstanding'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{line.label}</p>
                <p className="text-sm text-slate-600">{line.detail}</p>
                {link && (link.kind === 'route' ? (
                  <Link to={link.to} className="mt-1 inline-block text-sm font-medium text-indigo-700 hover:underline">
                    {link.text}
                  </Link>
                ) : (
                  <a href={link.to} className="mt-1 inline-block text-sm font-medium text-indigo-700 hover:underline">
                    {link.text}
                  </a>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
