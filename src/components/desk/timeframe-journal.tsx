"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useHeaderSave } from "@/components/desk/header-save";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import {
  VERDICTS,
  emptyNoteForm,
  loadNotes,
  mergeNotes,
  nextSerial,
  parseNoteList,
  saveNotes,
  trialTally,
  type TimeFrameNote,
  type TrialVerdict,
} from "@/lib/journal/notes";

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground";

export function TimeframeJournal() {
  const [notes, setNotes] = useState<TimeFrameNote[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState(emptyNoteForm(1));
  const [error, setError] = useState<string | null>(null);
  const [persist, setPersist] = useState<"disk" | "browser" | "error">("browser");
  const [dirty, setDirty] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    let dead = false;
    const boot = async () => {
      const local = loadNotes();
      try {
        const res = await fetch("/api/timeframe/notes", { cache: "no-store" });
        const body = (await res.json()) as { notes?: unknown; error?: string };
        if (!res.ok) throw new Error(body.error ?? "Load failed");
        const parsedDisk = parseNoteList(body.notes);
        if (dead) return;
        const book = mergeNotes(parsedDisk, local);
        setNotes(book);
        saveNotes(book);
        if (book.length > parsedDisk.length) {
          await fetch("/api/timeframe/notes", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: book }),
          });
        }
        setForm(emptyNoteForm(nextSerial(book)));
        setPersist("disk");
      } catch {
        if (dead) return;
        setNotes(local);
        setForm(emptyNoteForm(nextSerial(local)));
        setPersist("browser");
      } finally {
        if (!dead) setReady(true);
      }
    };
    void boot();
    return () => {
      dead = true;
    };
  }, []);

  const persistJournal = useCallback(async (next = notes) => {
    setSaveBusy(true);
    setError(null);
    saveNotes(next);
    try {
      const res = await fetch("/api/timeframe/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      setPersist("disk");
      setDirty(false);
    } catch {
      setPersist("error");
      setError("Could not save the journal. Try Save again.");
    } finally {
      setSaveBusy(false);
    }
  }, [notes]);

  useHeaderSave({ dirty, busy: saveBusy, onSave: persistJournal });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const thoughts = form.thoughts.trim();
    if (!form.date || !form.time) {
      setError("Enter date and time.");
      return;
    }
    if (!thoughts) {
      setError("Enter your thoughts.");
      return;
    }
    const serial = form.serial > 0 ? form.serial : nextSerial(notes);
    const note: TimeFrameNote = {
      id: crypto.randomUUID(),
      serial,
      date: form.date,
      time: form.time,
      timeframe: form.timeframe.trim(),
      thoughts,
      verdict: form.verdict,
      tStat: form.tStat,
    };
    const next = [note, ...notes].sort((a, b) => b.serial - a.serial);
    setNotes(next);
    setForm(emptyNoteForm(nextSerial(next)));
    setError(null);
    setDirty(true);
    void persistJournal(next);
  }

  function removeNote(id: string) {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    setForm((f) => ({ ...f, serial: nextSerial(next) }));
    setDirty(true);
    void persistJournal(next);
  }

  function setVerdict(id: string, verdict: TrialVerdict) {
    const next = notes.map((n) => (n.id === id ? { ...n, verdict } : n));
    setNotes(next);
    setDirty(true);
    void persistJournal(next);
  }

  const ordered = [...notes].sort((a, b) => b.serial - a.serial);
  const tally = trialTally(notes);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-10 px-4 py-10 md:px-8 md:py-14">
      <header>
        <p className="text-primary text-[11px] tracking-[0.3em] uppercase">Journal</p>
        <h1 className="font-heading mt-2 text-5xl font-semibold tracking-tight md:text-6xl">
          Time frame
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
          Log thoughts against a serial number, date, and clock time. Every row is a trial — killed or
          survived — so the denominator is never missing. Adding a note saves at once to{" "}
          <span className="font-mono text-foreground/80">data/timeframe-notes.json</span>.
          {persist === "disk"
            ? " Saved on disk."
            : persist === "error"
              ? " Disk save failed — still in this browser."
              : " Using this browser until disk is ready."}
          {dirty ? " Unsaved changes." : ""}
        </p>
      </header>

      <section className="border-border grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6 md:grid-cols-4">
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Trials</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{tally.n}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Open</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{tally.open}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Killed</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{tally.killed}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">Survived</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{tally.survived}</p>
        </div>
      </section>
      <p className="text-muted-foreground -mt-6 text-xs">
        A survivor from trial 4 and trial {Math.max(tally.n, 400)} are not the same finding. t &gt; 3.0
        is the bar if you log a t-stat.
      </p>

      <section>
        <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
          New note
        </h2>
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-xl bg-card p-4 text-foreground md:grid-cols-4 lg:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="note-serial" className="text-muted-foreground">
              Serial number
            </Label>
            <Input
              id="note-serial"
              type="number"
              min="1"
              className={fieldClass}
              value={form.serial || ""}
              onChange={(e) => setForm((f) => ({ ...f, serial: Number(e.target.value) }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-date" className="text-muted-foreground">
              Date
            </Label>
            <Input
              id="note-date"
              type="date"
              className={fieldClass}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-time" className="text-muted-foreground">
              Time
            </Label>
            <Input
              id="note-time"
              type="time"
              className={fieldClass}
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5 md:col-span-4">
            <Label htmlFor="note-thoughts" className="text-muted-foreground">
              Thoughts
            </Label>
            <textarea
              id="note-thoughts"
              rows={5}
              className="w-full rounded-lg border border-input bg-card px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="What you see…"
              value={form.thoughts}
              onChange={(e) => setForm((f) => ({ ...f, thoughts: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-verdict" className="text-muted-foreground">
              Verdict
            </Label>
            <select
              id="note-verdict"
              className={fieldClass}
              value={form.verdict}
              onChange={(e) => setForm((f) => ({ ...f, verdict: e.target.value as TrialVerdict }))}
            >
              {VERDICTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-tstat" className="text-muted-foreground">
              t-stat (optional)
            </Label>
            <Input
              id="note-tstat"
              type="number"
              step="any"
              className={fieldClass}
              placeholder="> 3.0 to survive"
              value={form.tStat ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, tStat: v === "" ? null : Number(v) }));
              }}
            />
          </div>
          <Button type="submit" className="h-8">
            Add note
          </Button>
          {error ? <p className="text-destructive md:col-span-4 text-sm">{error}</p> : null}
        </form>
      </section>

      <section>
        <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
          Notes
        </h2>
        {!ready ? (
          <p className="text-muted-foreground text-sm">Loading journal…</p>
        ) : ordered.length === 0 ? (
          <p className="text-muted-foreground text-sm">No notes yet. Add the first entry above.</p>
        ) : (
          <div className="space-y-3">
            {ordered.map((row) => (
              <article key={row.id} className="rounded-xl bg-card p-4 text-foreground">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm tabular-nums">
                    #{row.serial}
                    <span className="mx-2 text-muted-foreground">·</span>
                    {formatDate(row.date)} {row.time}
                    {row.timeframe ? (
                      <>
                        <span className="mx-2 text-muted-foreground">·</span>
                        {row.timeframe}
                      </>
                    ) : null}
                    {row.tStat != null ? (
                      <>
                        <span className="mx-2 text-muted-foreground">·</span>
                        t {row.tStat.toFixed(2)}
                        {row.tStat > 3 ? "" : " (below 3.0)"}
                      </>
                    ) : null}
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground/80"
                      value={row.verdict}
                      onChange={(e) => setVerdict(row.id, e.target.value as TrialVerdict)}
                      aria-label={`Verdict for note ${row.serial}`}
                    >
                      {VERDICTS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <Button type="button" variant="ghost" size="xs" onClick={() => removeNote(row.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {row.thoughts}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
