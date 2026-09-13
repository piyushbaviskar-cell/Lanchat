import React from "react";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { AboutSection } from "@/components/sections/about-section";
import { SiteFooter } from "@/components/sections/site-footer";

const LandingPage = React.memo(function LandingPage({ onJoin }: { onJoin?: () => void }) {
  return (
    <>
      <BackgroundPaths title="Lanchat" onJoin={onJoin} />
      <AboutSection />
      <SiteFooter />
    </>
  );
});

export default LandingPage;
