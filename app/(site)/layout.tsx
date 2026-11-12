import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { StructuredData } from "@/components/structured-data";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StructuredData type="home" />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
