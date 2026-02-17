import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function Navbar() {
  return (
    <nav className="border-b border-chalet-brown bg-chalet-cream sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center space-x-3">
            <div className="relative w-12 h-12">
              <Image
                src="/images/general/logo.png"
                alt="Le Petit Sport Chalet"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xl font-semibold text-chalet-brown heading-uppercase tracking-widest">
              Le Petit Sport Chalet
            </span>
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/">
              <Button variant="ghost" className="text-chalet-brown hover:bg-chalet-cream-light">
                Accueil
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
