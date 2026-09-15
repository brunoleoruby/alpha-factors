export function saveDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function waitFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Screenshot a live HTML node. Canvas fillText overlaps in this Electron build (GPU off). */
export async function downloadHtmlPng(card: HTMLElement, filename: string) {
  try {
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(card, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#1c1916",
    });
    saveDataUrl(dataUrl, filename);
    return;
  } catch {
    /* desktop screenshot fallback */
  }

  card.scrollIntoView({ block: "center", inline: "nearest" });
  await waitFrame();
  const rect = card.getBoundingClientRect();
  if (typeof window.deskShell?.captureRect !== "function") {
    throw new Error("Could not capture table");
  }
  const dataUrl = await window.deskShell.captureRect({
    x: Math.max(0, Math.round(rect.x)),
    y: Math.max(0, Math.round(rect.y)),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  });
  if (!dataUrl) throw new Error("Empty capture");
  saveDataUrl(dataUrl, filename);
}
