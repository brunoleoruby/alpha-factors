export {};

declare global {
  interface DeskShell {
    isDesktop: boolean;
    captureRect: (rect: { x: number; y: number; width: number; height: number }) => Promise<string>;
  }

  interface Window {
    deskShell?: DeskShell;
  }
}
