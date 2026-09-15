"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type HeaderSaveAction = {
  dirty: boolean;
  busy: boolean;
  onSave: () => void | Promise<void>;
};

const HeaderSaveContext = createContext<{
  action: HeaderSaveAction | null;
  setAction: (next: HeaderSaveAction | null) => void;
} | null>(null);

export function HeaderSaveProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<HeaderSaveAction | null>(null);
  return <HeaderSaveContext.Provider value={{ action, setAction }}>{children}</HeaderSaveContext.Provider>;
}

export function useHeaderSave(action: HeaderSaveAction) {
  const ctx = useContext(HeaderSaveContext);
  const setAction = ctx?.setAction;
  const { dirty, busy, onSave } = action;
  useEffect(() => {
    if (!setAction) return;
    setAction({ dirty, busy, onSave });
    return () => setAction(null);
  }, [setAction, dirty, busy, onSave]);
}

export function HeaderSaveButton() {
  const action = useContext(HeaderSaveContext)?.action;
  const onClick = useCallback(() => {
    action?.onSave();
  }, [action]);
  if (!action) return null;
  return (
    <Button
      type="button"
      className="ml-2 shrink-0 bg-foreground text-background hover:bg-foreground/90"
      disabled={!action.dirty || action.busy}
      onClick={onClick}
    >
      {action.busy ? "Saving…" : action.dirty ? "Save" : "Saved"}
    </Button>
  );
}
