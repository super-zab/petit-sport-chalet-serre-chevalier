import Link from "next/link";
import { CalendarDays, LogOut, Settings } from "lucide-react";
import { logoutAction } from "@/app/admin/auth-actions";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-chalet-brown bg-chalet-cream">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
          <Link href="/admin" className="truncate text-sm font-semibold uppercase tracking-widest">
            Petit Sport Chalet
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Tableau de bord">
            <Link href="/admin" className="flex items-center gap-2 rounded-sm px-3 py-2 hover:bg-chalet-cream-light">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Calendrier</span>
            </Link>
            <Link href="/admin/reglages" className="flex items-center gap-2 rounded-sm px-3 py-2 hover:bg-chalet-cream-light">
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Réglages</span>
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                title={`Déconnecter ${admin.email}`}
                className="flex items-center gap-2 rounded-sm px-3 py-2 hover:bg-chalet-cream-light"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">{children}</main>
    </>
  );
}
