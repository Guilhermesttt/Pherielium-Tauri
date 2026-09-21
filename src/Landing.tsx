import { useEffect } from "react";
import { Navigation } from "./components/landing/navigation";
import { HeroSection } from "./components/landing/hero-section";
import { LazySection } from "./components/landing/LazySection";

export default function Landing() {
  useEffect(() => {
    document.title = "Phelierium // Sua Biblioteca Universal de Jogos";
  }, []);

  return (
    <main className="relative bg-background text-foreground">
      <Navigation />
      <HeroSection />
      <LazySection loader={() => import("./components/landing/features-section").then((module) => ({ default: module.FeaturesSection }))} />
      <LazySection loader={() => import("./components/landing/how-it-works-section").then((module) => ({ default: module.HowItWorksSection }))} />
      <LazySection loader={() => import("./components/landing/integrations-section").then((module) => ({ default: module.IntegrationsSection }))} />
      <LazySection loader={() => import("./components/landing/security-section").then((module) => ({ default: module.SecuritySection }))} />
      <LazySection loader={() => import("./components/landing/cta-section").then((module) => ({ default: module.CtaSection }))} minHeightClassName="min-h-[260px]" />
      <LazySection loader={() => import("./components/landing/footer-section").then((module) => ({ default: module.FooterSection }))} minHeightClassName="min-h-[180px]" />
    </main>
  );
}
