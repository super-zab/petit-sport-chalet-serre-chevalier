import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-chalet-cream px-4">
      <div className="text-center">
        <p className="mb-4 text-6xl font-semibold text-chalet-brown">404</p>
        <h1 className="mb-4 text-2xl font-semibold text-chalet-brown">Page introuvable</h1>
        <p className="mb-8 text-chalet-brown/80">La page que vous recherchez n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className={buttonVariants()}>
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
