import { HeroSection } from "@/components/HeroSection";
import { BorrowSection } from "@/components/BorrowSection";
import { VaultSection } from "@/components/VaultSection";
import { RepaySection } from "@/components/RepaySection";
import { TreasurySection } from "@/components/TreasurySection";
import { WakeSection } from "@/components/WakeSection";
import { StorySection } from "@/components/StorySection";
import { PlaygroundSection } from "@/components/PlaygroundSection";
import { JoinSection } from "@/components/JoinSection";

/**
 * The running order. The two explainers are deliberately placed either side of
 * the machine: Borrow states the deal in one line of pictures before you are
 * shown the machine that does it, and Treasury answers the question the payout
 * raises — where is that $CB coming from — immediately after you have watched
 * it come out.
 */
export default function Home() {
  return (
    <main>
      <HeroSection />
      <BorrowSection />
      <VaultSection />
      <RepaySection />
      <TreasurySection />
      <WakeSection />
      <StorySection />
      <PlaygroundSection />
      <JoinSection />
    </main>
  );
}
