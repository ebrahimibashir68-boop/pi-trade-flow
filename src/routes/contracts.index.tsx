import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyContracts } from "@/lib/contracts.functions";
import { getCachedPiAccessToken, signInWithPi } from "@/lib/pi-auth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/contracts/")({
  component: ContractsList,
});

function ContractsList() {
  const list = useServerFn(listMyContracts);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let t = getCachedPiAccessToken();
    if (t) return setToken(t);
    signInWithPi().then(() => setToken(getCachedPiAccessToken())).catch(() => {});
  }, []);
  const q = useQuery({
    queryKey: ["contracts", token],
    queryFn: () => list({ data: { accessToken: token! } }),
    enabled: !!token,
  });

  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="font-display text-4xl">My contracts</h1>
      <p className="mt-2 text-sm text-muted-foreground">Every contract you have authored or are named on as a party.</p>
      <div className="mt-8">
        {!token && <p className="text-sm text-muted-foreground">Sign in with Pi to view your registry.</p>}
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {q.data && q.data.contracts.length === 0 && (
          <div className="rounded-sm border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No contracts yet.</p>
            <Link to="/contracts/new" className="mt-4 inline-block rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground">Draft your first contract</Link>
          </div>
        )}
        <ul className="grid gap-3">
          {q.data?.contracts.map((c) => (
            <li key={c.id}>
              <Link to="/contracts/$id" params={{ id: c.id }} className="block rounded-sm border border-border bg-card p-5 hover:border-primary">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-lg">{c.commodity}</p>
                    <p className="text-sm text-muted-foreground">{c.quantity} · {c.incoterm} · {c.price_pi}</p>
                  </div>
                  <span className="rounded-sm border border-border px-2 py-1 text-xs uppercase tracking-wider">{c.status.replaceAll("_", " ")}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}