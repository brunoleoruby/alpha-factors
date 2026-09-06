import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SLOTS = [
  {
    title: "How you read the tape",
    body: "Your regime rules — not a textbook VIX recipe. We’ll encode when you feel risk-on, when you sit out, and what you ignore.",
  },
  {
    title: "What you actually watch",
    body: "The few tells that matter to you (FII, India VIX, dollar, credit, sector leadership). Empty until you name them.",
  },
  {
    title: "How you size the day",
    body: "Your personality on size: aggressive only when the tape agrees with you, flat when it doesn’t. Logic comes later.",
  },
];

export function MarketEnvironment() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 px-4 pb-10 md:px-6">
      <header className="mt-2">
        <p className="text-primary text-xs font-medium tracking-[0.22em] uppercase">
          Varun G V · personal
        </p>
        <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Market environment
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          This tab is only your lens. No shared factor model, no default India-macro dashboard. We
          build it from how you see the market — later.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {SLOTS.map((slot) => (
          <Card key={slot.title} className="border-primary/15 bg-card/90">
            <CardHeader>
              <CardTitle className="text-base">{slot.title}</CardTitle>
              <CardDescription>{slot.body}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-3 py-8 text-center text-sm">
                Not built yet
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
