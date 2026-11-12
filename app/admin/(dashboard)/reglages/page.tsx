import { Settings } from "@/components/admin/settings";
import { apartments } from "@/lib/apartments";
import { MIN_PASSWORD_LENGTH, listAdmins, requireAdmin } from "@/lib/auth";
import { getAllSettings } from "@/lib/bookings";
import { listFeeds } from "@/lib/ical";
import { getBaseUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [settings, feeds, admins] = await Promise.all([getAllSettings(), listFeeds(), listAdmins()]);
  const baseUrl = getBaseUrl();

  return (
    <Settings
      currentAdminId={admin.id}
      minPasswordLength={MIN_PASSWORD_LENGTH}
      admins={admins}
      apartments={apartments.map((apartment) => {
        const setting = settings.find((item) => item.slug === apartment.slug);
        return {
          slug: apartment.slug,
          name: apartment.name,
          defaultPriceEuros: (setting?.defaultPriceCents ?? apartment.defaultPrice * 100) / 100,
          exportUrl: setting ? `${baseUrl}/api/ical/${setting.icalToken}.ics` : "",
          feeds: feeds.filter((feed) => feed.apartmentSlug === apartment.slug),
        };
      })}
    />
  );
}
