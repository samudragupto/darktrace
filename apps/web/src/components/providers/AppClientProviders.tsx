"use client";

import { ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/config/wagmi";
import "@rainbow-me/rainbowkit/styles.css";

const customForensicTheme = darkTheme({
  accentColor: "#F3F4F6",
  accentColorForeground: "#121315",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "none",
});

// Match the dark workspace palette
customForensicTheme.colors.modalBackground = "#1C1E21";
customForensicTheme.colors.modalBorder = "#303439";
customForensicTheme.colors.modalText = "#ECEEF1";
customForensicTheme.colors.modalTextSecondary = "#A3AAB4";

interface AppClientProvidersProps {
  children: ReactNode;
}

export function AppClientProviders({ children }: AppClientProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 15_000,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customForensicTheme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

