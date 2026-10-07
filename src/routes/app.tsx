import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { loadSession, logout, useMe } from "@/lib/session";
import { Logo } from "@/components/mj";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [{ title: "My diary — MoiJournal" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    if (!(await loadSession())) throw redirect({ to: "/login" });
  },
  pendingComponent: () => (
    <p className="p-10 text-center font-hand text-2xl text-muted-foreground">✎ unlocking…</p>
  ),
  component: AppShell,
});

function AppShell() {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b-2 border-ink bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Logo />
          <nav className="flex items-center gap-1 text-sm font-bold text-ink">
            <Link
              to="/app"
              activeOptions={{ exact: true }}
              className="rounded-full px-3 py-2 hover:bg-muted"
              activeProps={{ className: "bg-muted" }}
            >
              📚 Shelf
            </Link>
            <Link
              to="/app/settings"
              className="rounded-full px-3 py-2 hover:bg-muted"
              activeProps={{ className: "bg-muted" }}
            >
              ⚙︎ Me
            </Link>
            <button
              className="rounded-full px-3 py-2 hover:bg-muted"
              onClick={async () => {
                await logout();
                qc.clear();
                nav({ to: "/" });
              }}
            >
              🔒 Lock
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">{me ? <Outlet /> : null}</main>
    </div>
  );
}
