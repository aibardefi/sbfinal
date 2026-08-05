"use client";

import { WalletContext } from "@/lib/wallet";
import { useMetaMaskWallet } from "@/lib/useMetaMaskWallet";

/**
 * Publishes the wallet to the whole page.
 *
 * The connection lives here rather than on the borrow screen so that it survives
 * anything that screen does, and so a second Connect button elsewhere would read
 * the same session. What it holds is real again — an account, a chain and a viem
 * signer, from `useMetaMaskWallet`.
 *
 * There is still no provider tree under this, which is the point. The wagmi /
 * RainbowKit / TanStack stack that used to sit here was ~700 KB and had to be
 * lazily chunked to keep it off the critical path; `useMetaMaskWallet` is one
 * hook over EIP-1193 and viem, both of which the page already loads to read the
 * chain. So there is nothing left to defer, and no window where the Connect
 * button exists but the code behind it has not arrived.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const wallet = useMetaMaskWallet();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}
