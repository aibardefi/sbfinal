"use client";

import { useState } from "react";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

/**
 * The client-side providers, mounted once around the whole page.
 *
 * They have to wrap everything rather than sit inside `ProtocolSection`, because
 * wagmi keeps the connection in context and RainbowKit portals its modal to the
 * body — a provider nested inside one of nine scroll-snap sections would put the
 * dialog inside a snap target, which is the same bug `protocol/Modal.tsx`
 * already documents.
 *
 * The QueryClient is created in state, not at module scope. A module-level
 * client is shared by every render of every request, which is wrong the moment
 * anything is prerendered — and this site is a static export, so every page is.
 *
 * The RainbowKit theme is built from the borrow screen's own tokens rather than
 * left at its defaults, so its modal cannot arrive in somebody else's mint and
 * violet. It is the one place on the site where a third-party component draws
 * over our own palette.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The contract reads here are hand-rolled around viem and refresh on
            // their own 30-second poll; react-query is present for wagmi's sake,
            // not as this site's data layer. Refetching on every window focus
            // would be a burst of RPC calls nothing on screen asked for.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          appInfo={{ appName: "$CB — Capybara Blyatovich" }}
          modalSize="compact"
          theme={{
            lightMode: lightTheme({
              accentColor: "#4dffbc",
              accentColorForeground: "#052b1f",
              borderRadius: "medium",
              fontStack: "system",
            }),
            darkMode: darkTheme({
              accentColor: "#42eaff",
              accentColorForeground: "#07222b",
              borderRadius: "medium",
              fontStack: "system",
            }),
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
