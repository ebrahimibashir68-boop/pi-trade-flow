import { createFileRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/contracts")({
  head: () => ({
    meta: [
      { title: "Contracts registry — PiTrade" },
      { name: "description", content: "Draft, sign and manage Pi-settled import & export contracts between individuals, companies and government agencies." },
      { property: "og:title", content: "Contracts registry — PiTrade" },
      { property: "og:description", content: "Sign borderless Pi-settled trade contracts online." },
    ],
  }),
  component: ContractsLayout,
});

function ContractsLayout() {
  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-sm bg-primary text-primary-foreground font-display">π</span>
            <span className="font-display text-xl">PiTrade</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/contracts" className="hover:text-primary">My contracts</Link>
            <Link to="/contracts/new" className="rounded-sm bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90">New contract</Link>
          </nav>
        </div>
      </header>
      <Outlet />
    </main>
  );
}