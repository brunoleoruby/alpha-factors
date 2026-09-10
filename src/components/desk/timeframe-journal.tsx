"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TIME_FRAMES,
  emptyNoteForm,
  loadNotes,
  nextSerial,
  parseNoteList,
  saveNotes,
  type TimeFrameNote,
} from "@/lib/journal/notes";

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm text-slate-900";

export function TimeframeJournal() {
  const [notes, setNotes] = useState<TimeFrameNote[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState(emptyNoteForm(1));
  const [error, setError] = useState<string | null>(null);
  const [persist, setPersist] = useState<"disk" | "browser" | "error">("browser");

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
        const book = parsedDisk.length ? parsedDisk : local;
        setNotes(book);
        saveNotes(book);
        if (!parsedDisk.length && local.length) {
          await fetch("/api/timeframe/notes", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: local }),
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

  useEffect(() => {
    if (!ready) return;
    saveNotes(notes);
    const t = window.setTimeout(() => {
      void fetch("/api/timeframe/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      })
        .then((res) => {
          if (res.ok) setPersist("disk");
          else setPersist("error");
        })
        .catch(() => setPersist("error"));
    }, 200);
    return () => window.clearTimeout(t);
  }, [ready, notes]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const thoughts = form.thoughts.trim();
    const timeframe = form.timeframe.trim();
    if (!form.date || !form.time) {
      setError("Enter date and time.");
      return;
    }
    if (!timeframe) {
      setError("Enter a time frame.");
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
      timeframe,
      thoughts,
    };
    const next = [note, ...notes].sort((a, b) => b.serial - a.serial);
    setNotes(next);
    setForm(emptyNoteForm(nextSerial(next)));
    setError(null);
  }

  function removeNote(id: string) {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    setForm((f) => ({ ...f, serial: nextSerial(next) }));
  }

  const ordered = [...notes].sort((a, b) => b.serial - a.serial);

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-10 px-4 py-10 md:px-8 md:py-14">
      <header>
        <p className="text-primary text-[11px] tracking-[0.3em] uppercase">Journal</p>
        <h1 className="font-heading mt-2 text-5xl font-semibold tracking-tight md:text-6xl">
          Time frame
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
          Log thoughts against a serial number, date, clock time, and chart time frame. Saved to{" "}
          <span className="font-mono text-foreground/80">data/timeframe-notes.json</span>.
          {persist === "disk"
            ? " Saved on disk."
            : persist === "error"
              ? " Disk save failed — still in this browser."
              : " Using this browser until disk is ready."}
        </p>
      </header>

      <section>
        <h2 className="text-muted-foreground mb-5 text-[11px] font-medium tracking-[0.24em] uppercase">
          New note
        </h2>
        <form
          onSubmit={onSubmit}
          className="grid gap-4 rounded-xl bg-white p-4 text-slate-900 md:grid-cols-4 lg:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="note-serial" className="text-slate-600">
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
            <Label htmlFor="note-date" className="text-slate-600">
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
            <Label htmlFor="note-time" className="text-slate-600">
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
          <div className="space-y-1.5">
            <Label htmlFor="note-tf" className="text-slate-600">
              Time frame
            </Label>
            <select
              id="note-tf"
              className={fieldClass}
              value={TIME_FRAMES.includes(form.timeframe as (typeof TIME_FRAMES)[number]) ? form.timeframe : "custom"}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, timeframe: v === "custom" ? "" : v }));
              }}
            >
              {TIME_FRAMES.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>
          {!TIME_FRAMES.includes(form.timeframe as (typeof TIME_FRAMES)[number]) ? (
            <div className="space-y-1.5 md:col-span-4">
              <Label htmlFor="note-tf-custom" className="text-slate-600">
                Custom time frame
              </Label>
              <Input
                id="note-tf-custom"
                className={fieldClass}
                placeholder="e.g. 75m"
                value={form.timeframe}
                onChange={(e) => setForm((f) => ({ ...f, timeframe: e.target.value }))}
              />
            </div>
          ) : null}
          <div className="space-y-1.5 md:col-span-4">
            <Label htmlFor="note-thoughts" className="text-slate-600">
              Thoughts
            </Label>
            <textarea
              id="note-thoughts"
              rows={5}
              className="w-full rounded-lg border border-input bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="What you see on this time frame…"
              value={form.thoughts}
              onChange={(e) => setForm((f) => ({ ...f, thoughts: e.target.value }))}
              required
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
              <article key={row.id} className="rounded-xl bg-white p-4 text-slate-900">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm tabular-nums">
                    #{row.serial}
                    <span className="mx-2 text-slate-400">·</span>
                    {row.date} {row.time}
                    <span className="mx-2 text-slate-400">·</span>
                    {row.timeframe}
                  </p>
                  <Button type="button" variant="ghost" size="xs" onClick={() => removeNote(row.id)}>
                    Remove
                  </Button>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
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
