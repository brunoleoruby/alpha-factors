"use client";

import Image from "next/image";
import { useId } from "react";
import { cn } from "cn";

export function BrandMark({ className }: { className?: string }) {
  const gid = `ec-gold-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 96 96" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={gid} x1="8" y1="88" x2="88" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7A4E10" />
          <stop offset="28%" stopColor="#C9A227" />
          <stop offset="52%" stopColor="#FFF6D2" />
          <stop offset="78%" stopColor="#E8C45A" />
          <stop offset="100%" stopColor="#A67C24" />
        </linearGradient>
      </defs>
      <path
        d="M18 50 V70 A16 16 0 0 0 34 86 H62"
        stroke={`url(#${gid})`}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M66 20 H46 A16 16 0 0 0 30 36 V56 A16 16 0 0 0 46 72 H66 A16 16 0 0 0 82 56 V40"
        stroke={`url(#${gid})`}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform="translate(68 14) rotate(-45 16 10)">
        <path d="M0 7 H18 V2 L32 11 L18 20 V15 H0 Z" fill={`url(#${gid})`} />
      </g>
    </svg>
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("gold-foil", className)}>
      <Image
        src="/brand/eminent-corpus-logo.png"
        alt="Eminent Corpus"
        width={196}
        height={100}
        className="h-10 w-auto max-w-[220px] object-contain object-left"
        priority
      />
      <span className="gold-foil-sheen" aria-hidden />
    </span>
  );
}
