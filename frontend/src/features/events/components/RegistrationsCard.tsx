import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from '../../../components/ui/Card';
import { supabase } from "../../../lib/supabase";

type RegistrationsCardProps = {
  eventId: string;
  /** True when the signed-in user is the organiser who owns this event. */
  isOwner: boolean;
};

export function RegistrationsCard({ eventId, isOwner }: RegistrationsCardProps) {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Owners get the full registrations page instead, so no count fetch needed.
    if (isOwner) return;

    let cancelled = false;
    setCount(null);
    setFailed(false);

    supabase
      .rpc("event_registration_count", { p_event_id: eventId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setFailed(true);
        } else {
          setCount(typeof data === "number" ? data : 0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, isOwner]);

  if (isOwner) {
    return (
      <Card
        title="Registrations"
        description="Who has registered for this event, and how many places are taken."
      >
        <Link
          to={`/requests/${eventId}/registrations`}
          className="text-sm font-medium text-indigo-700 hover:underline"
        >
          Open registrations
        </Link>
      </Card>
    );
  }

  return (
    <Card
      title="Registrations"
      description="How many people have registered for this event."
    >
      {failed ? (
        <p className="text-sm text-slate-500">Registration count unavailable.</p>
      ) : count === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <p data-testid="registration-count" className="text-2xl font-semibold text-slate-900">
          {count}
          <span className="ml-1 text-sm font-normal text-slate-500">
            {count === 1 ? "registration" : "registrations"}
          </span>
        </p>
      )}
    </Card>
  );
}
