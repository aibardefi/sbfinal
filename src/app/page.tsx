import { HeroSection } from "@/components/HeroSection";
import { VaultSection } from "@/components/VaultSection";
import { RepaySection } from "@/components/RepaySection";
import { TreasurySection } from "@/components/TreasurySection";
import { WakeSection } from "@/components/WakeSection";
import { StorySection } from "@/components/StorySection";
import { PlaygroundSection } from "@/components/PlaygroundSection";
import { JoinSection } from "@/components/JoinSection";

/**
 * The running order. Eight screens.
 *
 * There used to be a ninth — a Borrow explainer stating the deal in one line of
 * pictures before you were shown the machine that does it. It said the same thing
 * the machine says, one screen earlier, and two screens in a row explaining one
 * transaction is one screen too many. Its four steps now sit beside the machine
 * itself, so the words and the thing they describe are on the same screen.
 *
 * Treasury still answers the question the payout raises — where is that $CB
 * coming from — immediately after you have watched it come out.
 */
export default function Home() {
  return (
    <main>
      <HeroSection />
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
