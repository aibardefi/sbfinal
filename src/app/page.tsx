import { HeroSection } from "@/components/HeroSection";
import { VaultSection } from "@/components/VaultSection";
import { RepaySection } from "@/components/RepaySection";
import { WakeSection } from "@/components/WakeSection";
import { StorySection } from "@/components/StorySection";
import { PlaygroundSection } from "@/components/PlaygroundSection";
import { JoinSection } from "@/components/JoinSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <VaultSection />
      <RepaySection />
      <WakeSection />
      <StorySection />
      <PlaygroundSection />
      <JoinSection />
    </main>
  );
}
