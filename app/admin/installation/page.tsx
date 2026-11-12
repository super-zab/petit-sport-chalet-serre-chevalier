import { redirect } from "next/navigation";
import { setupAction } from "@/app/admin/auth-actions";
import { AuthForm } from "@/components/admin/auth-form";
import { MIN_PASSWORD_LENGTH, countAdmins } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Dès qu'un compte existe, cette page n'est plus accessible.
  if ((await countAdmins()) > 0) redirect("/admin/connexion");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-sm border border-chalet-brown bg-white p-8">
        <p className="text-xs uppercase tracking-widest text-chalet-muted">Le Petit Sport Chalet</p>
        <h1 className="mb-2 mt-1 text-xl font-semibold">Premier compte</h1>
        <p className="mb-6 text-sm leading-relaxed text-chalet-brown/80">
          Cette étape ne se fait qu&apos;une fois. Les comptes suivants se créent depuis les réglages.
        </p>
        <AuthForm mode="setup" action={setupAction} minPasswordLength={MIN_PASSWORD_LENGTH} />
      </div>
    </div>
  );
}
