import { MapPin, Mail, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-chalet-brown text-chalet-cream mt-16 border-t border-chalet-brown">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-4 heading-uppercase tracking-widest">Le Petit Sport Chalet</h3>
            <p className="text-chalet-cream-light">
              Location saisonnière d&apos;appartements et chalets à Serre Chevalier.
              Vos vacances à la montagne vous attendent.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4 heading-uppercase tracking-widest">Localisation</h3>
            <div className="space-y-2 text-chalet-cream-light">
              <div className="flex items-center">
                <MapPin className="w-5 h-5 mr-2 flex-shrink-0" />
                <span>Serre Chevalier, Hautes-Alpes</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4 heading-uppercase tracking-widest">Contact</h3>
            <div className="space-y-3 text-chalet-cream-light">
              <div className="flex items-center">
                <Mail className="w-5 h-5 mr-2 flex-shrink-0" />
                <a href="mailto:saslesporting@gmail.com" className="hover:text-chalet-cream transition-colors">
                  saslesporting@gmail.com
                </a>
              </div>
              <div className="flex items-center">
                <Phone className="w-5 h-5 mr-2 flex-shrink-0" />
                <a href="tel:+33612866291" className="hover:text-chalet-cream transition-colors">
                  +33 6 12 86 62 91
                </a>
              </div>
              <div className="flex items-center">
                <Phone className="w-5 h-5 mr-2 flex-shrink-0" />
                <a href="tel:+33612697903" className="hover:text-chalet-cream transition-colors">
                  +33 6 12 69 79 03
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-chalet-brown/30 mt-8 pt-8 text-center text-chalet-cream-light text-sm">
          <p>&copy; {new Date().getFullYear()} Le Petit Sport Chalet. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
