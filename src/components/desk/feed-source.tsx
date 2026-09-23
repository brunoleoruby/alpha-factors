import { cn } from "cn";

export function FeedSource({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        "text-muted-foreground text-[10px] font-medium tracking-[0.16em] uppercase whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
