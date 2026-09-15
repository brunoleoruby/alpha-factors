"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadNotes } from "@/lib/journal/notes";
import type { SectorMarket } from "@/lib/markets/sector-returns";

type ChatMsg = { role: "user" | "assistant"; content: string };

const CHIPS = [
  "What can you cover?",
  "What is the book?",
  "Portfolio P&L",
  "Market environment",
];

function marketFromPath(path: string): SectorMarket {
  if (path.startsWith("/nse")) return "NSE";
  if (path === "/" || path.startsWith("/desk") || path.startsWith("/stocks")) return "US";
  return "NSE";
}

export function DeskAssistant() {
  const path = usePathname();
  const market = marketFromPath(path);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Desk assistant for the whole app — US/NSE, Nifty 50, environment, portfolio, time frame, sector analysis, and IPO. Ask any desk.",
    },
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setText("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          market,
          journal: { n: loadNotes().length, open: 0, killed: 0, survived: 0 },
        }),
      });
      const body = (await res.json()) as { reply?: string; error?: string };
      const reply = body.reply ?? body.error ?? "No reply.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Assistant feed is down." }]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(text);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "ml-auto rounded-md px-3 py-1 text-sm",
          open ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
        )}
      >
        Desk
      </button>
      {open ? (
        <div className="border-border fixed top-[52px] right-0 z-40 flex h-[min(640px,calc(100vh-52px))] w-full max-w-md flex-col border-l bg-[#0b1f33] shadow-none">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="font-heading text-sm">Desk assistant</p>
              <p className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase">
                {market} · whole desk
              </p>
            </div>
            <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={cn(
                  "max-w-[95%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user" ? "bg-primary/20 ml-auto" : "bg-white/5",
                )}
              >
                {msg.content}
              </div>
            ))}
            {busy ? <p className="text-muted-foreground text-xs">Reading the tape…</p> : null}
            <div ref={endRef} />
          </div>
          <div className="border-border space-y-2 border-t px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(chip)}
                  className="border-primary/25 text-muted-foreground hover:border-primary/50 rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase"
                >
                  {chip}
                </button>
              ))}
            </div>
            <form onSubmit={onSubmit} className="flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask the book…"
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !text.trim()}>
                Ask
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
