import { after } from "next/server";
import { Dashboard } from "@/components/admin/dashboard";
import { apartments, isApartmentSlug } from "@/lib/apartments";
import { requireAdmin } from "@/lib/auth";
import { getAdminMonth, listPendingRequests, listUpcomingStays } from "@/lib/bookings";
import { addDays, isDay, monthGrid, monthStart, todayParis } from "@/lib/dates";
import { syncStaleFeeds } from "@/lib/ical";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ apt?: string | string[]; m?: string | string[] }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;
  const slug = isApartmentSlug(params.apt) ? params.apt : apartments[0].slug;
  const today = todayParis();
  const month = typeof params.m === "string" && isDay(`${params.m}-01`) ? `${params.m}-01` : monthStart(today);
  const days = monthGrid(month);

  const [data, pending, upcoming] = await Promise.all([
    getAdminMonth(slug, days[0], addDays(days[days.length - 1], 1)),
    listPendingRequests(),
    listUpcomingStays(8),
  ]);

  // Rafraîchit Airbnb/Booking en arrière-plan : le prochain rechargement automatique l'affichera.
  after(() => syncStaleFeeds(15).catch(() => {}));

  return (
    <Dashboard
      key={`${slug}:${month}`}
      apartments={apartments.map(({ slug, shortName, name }) => ({ slug, shortName, name }))}
      slug={slug}
      month={month}
      today={today}
      days={days}
      data={data}
      pending={pending}
      upcoming={upcoming}
    />
  );
}
