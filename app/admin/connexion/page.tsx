import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/admin/auth-actions";
import { AuthForm } from "@/components/admin/auth-form";
import { MIN_PASSWORD_LENGTH, countAdmins, getAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  const needsSetup = (await countAdmins()) === 0;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-sm border border-chalet-brown bg-white p-8">
        <p className="text-xs uppercase tracking-widest text-chalet-muted">Le Petit Sport Chalet</p>
        <h1 className="mb-6 mt-1 text-xl font-semibold">Tableau de bord</h1>
        {needsSetup ? (
          <p className="text-sm leading-relaxed">
            Aucun compte n&apos;existe encore.{" "}
            <Link href="/admin/installation" className="font-semibold underline">
              Créer le premier compte
            </Link>
            .
          </p>
        ) : (
          <AuthForm mode="login" action={loginAction} minPasswordLength={MIN_PASSWORD_LENGTH} />
        )}
      </div>
    </div>
  );
}
