"use client";

import { type CSSProperties, type Ref } from "react";
import { formatPct } from "@/lib/format";
import {
  ENV_SHARE_DISCLAIMER,
  localShareDate,
  type EnvShareLine,
  type EnvSharePayload,
} from "@/lib/markets/share-environment";

const card: CSSProperties = {
  width: 920,
  boxSizing: "border-box",
  background: "#1c1916",
  color: "#f4efe6",
  padding: 28,
  fontFamily: "Arial, Helvetica, sans-serif",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  fontSize: 13,
};

const th: CSSProperties = {
  padding: "8px 8px",
  border: "1px solid #3a342e",
  background: "#161411",
  color: "#9a9288",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  fontWeight: 600,
};

const td: CSSProperties = {
  padding: "8px 8px",
  border: "1px solid #3a342e",
  verticalAlign: "middle",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

const sectionLabel: CSSProperties = {
  color: "#9a9288",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 6,
};

function fmtLevel(n: number, digits: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pctColor(n: number | null) {
  if (n == null || n === 0) return "#9a9288";
  return n > 0 ? "#7dba8c" : "#d27a6a";
}

function Cell({
  children,
  align = "right",
  color,
  mono = true,
}: {
  children: string;
  align?: "left" | "right";
  color?: string;
  mono?: boolean;
}) {
  return (
    <td
      style={{
        ...td,
        textAlign: align,
        color: color ?? "#f4efe6",
        fontFamily: mono ? "Courier New, Courier, monospace" : "Arial, Helvetica, sans-serif",
        fontWeight: mono ? 600 : 500,
      }}
    >
      {children}
    </td>
  );
}

function Disclaimer() {
  return (
    <div
      style={{
        marginTop: 4,
        paddingTop: 14,
        borderTop: "1px solid #3a342e",
        color: "#8a847c",
        fontSize: 11,
        lineHeight: 1.5,
        whiteSpace: "normal",
      }}
    >
      {ENV_SHARE_DISCLAIMER}
    </div>
  );
}

function CardHead({
  kicker,
  dateLine,
  windowLine,
}: {
  kicker: string;
  dateLine: string;
  windowLine: string;
}) {
  return (
    <>
      <div style={{ fontFamily: "Georgia, Times New Roman, serif", fontSize: 28, fontWeight: 600 }}>
        Eminent Corpus
      </div>
      <div style={{ marginTop: 8, color: "#9a9288", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Pre-market
      </div>
      <div style={{ marginTop: 6, color: "#f4efe6", fontSize: 16 }}>{kicker}</div>
      <div style={{ marginTop: 4, color: "#9a9288", fontSize: 14 }}>{dateLine}</div>
      <div style={{ marginTop: 2, color: "#9a9288", fontSize: 13 }}>{windowLine}</div>
    </>
  );
}

function InsightBlock({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={sectionLabel}>{title}</div>
      <div
        style={{
          fontFamily: "Georgia, Times New Roman, serif",
          fontSize: 17,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
        }}
      >
        {body}
      </div>
    </div>
  );
}

export function PreviousCloseCard({
  payload,
  cardRef,
}: {
  payload: EnvSharePayload;
  cardRef: Ref<HTMLDivElement>;
}) {
  const india = payload.indiaVix == null ? "—" : payload.indiaVix.toFixed(1);

  return (
    <div ref={cardRef} data-env-share-card="previous-close" style={card}>
      <CardHead
        kicker="Previous session close"
        dateLine={localShareDate(payload.asOf)}
        windowLine={`Before the NSE bell · ${payload.window}`}
      />
      <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600 }}>
        Stance {payload.stance.label}
        <span style={{ color: "#9a9288", fontWeight: 500, fontSize: 14 }}>
          {" "}
          · India VIX {india}
        </span>
      </div>
      <div
        style={{
          marginTop: 14,
          marginBottom: 18,
          padding: "12px 14px",
          border: "1px solid #3a342e",
          background: "#161411",
        }}
      >
        <div style={sectionLabel}>Previous close (reference)</div>
        <div style={{ color: "#9a9288", fontSize: 12, marginBottom: 8, lineHeight: 1.4 }}>
          Prior session official close. GIFT last is compared with this Nifty 50 previous close for the
          open — not with today’s cash last.
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: pctColor(payload.openCue.gapPct) }}>
          {payload.openCue.gapPts == null || payload.openCue.gapPct == null
            ? "—"
            : `${payload.openCue.gapPts > 0 ? "+" : ""}${payload.openCue.gapPts.toLocaleString("en-IN", { maximumFractionDigits: 1 })} pts  ${formatPct(payload.openCue.gapPct)}`}
        </div>
        <div style={{ marginTop: 6, color: "#d7d0c6", fontSize: 13 }}>
          Nifty 50 previous close{" "}
          {payload.openCue.niftyPrev == null ? "—" : fmtLevel(payload.openCue.niftyPrev, 2)}
          {"  ·  "}
          GIFT Nifty last {payload.openCue.giftLast == null ? "—" : fmtLevel(payload.openCue.giftLast, 2)}
        </div>
      </div>

      {payload.groups.map((group) => (
        <table key={group.title} style={{ ...tableStyle, marginBottom: 16 }}>
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>{group.title}</th>
              <th style={{ ...th, textAlign: "right" }}>Previous close</th>
              <th style={{ ...th, textAlign: "right" }}>Last</th>
              <th style={{ ...th, textAlign: "right" }}>Vs prev close</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row: EnvShareLine) => (
              <tr key={row.id}>
                <Cell align="left" mono={false}>
                  {row.name}
                </Cell>
                <Cell>{row.prevClose == null ? "—" : fmtLevel(row.prevClose, row.digits)}</Cell>
                <Cell>{row.last == null ? "—" : fmtLevel(row.last, row.digits)}</Cell>
                <Cell color={pctColor(row.changePct)}>
                  {row.changePct == null ? "—" : formatPct(row.changePct)}
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <Disclaimer />
    </div>
  );
}

export function TodayInsightCard({
  payload,
  cardRef,
}: {
  payload: EnvSharePayload;
  cardRef: Ref<HTMLDivElement>;
}) {
  const { mindset, experience, boundaries } = payload.insight;
  const hasInsight = Boolean(mindset || experience || boundaries);

  return (
    <div ref={cardRef} data-env-share-card="today-insight" style={card}>
      <CardHead
        kicker="Today’s insight"
        dateLine={localShareDate(payload.asOf)}
        windowLine={`Before the NSE bell · ${payload.window}`}
      />
      <div style={{ marginTop: 20 }}>
        {hasInsight ? (
          <>
            <InsightBlock title="Mindset" body={mindset} />
            <InsightBlock title="Experience" body={experience} />
            <InsightBlock title="Boundary conditions" body={boundaries} />
          </>
        ) : (
          <div style={{ marginBottom: 18, color: "#9a9288", fontSize: 14 }}>
            Write today’s insight above: mindset, experience, and boundary conditions.
          </div>
        )}
      </div>

      {payload.groups.map((group) => (
        <table key={group.title} style={{ ...tableStyle, marginBottom: 16 }}>
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>{group.title}</th>
              <th style={{ ...th, textAlign: "right" }}>Today&apos;s chance</th>
              <th style={{ ...th, textAlign: "right" }}>Analog hit</th>
              <th style={{ ...th, textAlign: "right" }}>Tape</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row: EnvShareLine) => (
              <tr key={row.id}>
                <Cell align="left" mono={false}>
                  {row.name}
                </Cell>
                <Cell color={pctColor(row.chance1d)}>
                  {row.chance1d == null ? "—" : formatPct(row.chance1d)}
                </Cell>
                <Cell color="#9a9288">{row.hitRate == null ? "—" : formatPct(row.hitRate)}</Cell>
                <Cell align="right" mono={false} color="#9a9288">
                  {row.regime || "—"}
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <Disclaimer />
    </div>
  );
}
