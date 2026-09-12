"use client";

import type { ReactNode } from "react";
import { ExchangeNav } from "@/components/desk/exchange-nav";
import { HeaderSaveProvider } from "@/components/desk/header-save";

export function DeskChrome({ children }: { children: ReactNode }) {
  return (
    <HeaderSaveProvider>
      <ExchangeNav />
      {children}
    </HeaderSaveProvider>
  );
}
