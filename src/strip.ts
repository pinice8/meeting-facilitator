/** Minimal typing for the Document Picture-in-Picture API (Chromium; not in lib.dom yet). */
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

const STRIP_SIZE = { width: 900, height: 76 };

/** Gives the new window our styles (links need absolute URLs because the window starts as about:blank). */
function prepareWindow(win: Window): HTMLElement {
  const doc = win.document;
  doc.title = "Meeting Facilitator";
  document.head.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
    if (node instanceof HTMLLinkElement) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = node.href;
      doc.head.append(link);
    } else {
      doc.head.append(node.cloneNode(true));
    }
  });
  doc.documentElement.dataset.theme = document.documentElement.dataset.theme ?? "";
  doc.body.style.margin = "0";
  const root = doc.createElement("div");
  doc.body.append(root);
  return root;
}

export interface StripWindow {
  win: Window;
  root: HTMLElement;
}

/**
 * Opens a small always-on-top window for the strip: Document Picture-in-Picture when the browser
 * allows it from here, otherwise a plain pop-up. Rejects if neither is permitted (Teams or the
 * browser may block both when the app runs inside a Teams tab).
 */
export async function openStripWindow(): Promise<StripWindow> {
  const dpip = (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;
  let win: Window | null = null;
  if (dpip) {
    try {
      win = await dpip.requestWindow(STRIP_SIZE);
    } catch {
      win = null; // not allowed here; try a pop-up instead
    }
  }
  win ??= window.open("", "meeting-facilitator-strip", `popup=yes,width=${STRIP_SIZE.width},height=${STRIP_SIZE.height + 40},left=0,top=0`);
  if (!win) throw new Error("the browser or Teams blocked the pop-out window");
  const root = prepareWindow(win);
  if (import.meta.env.DEV) {
    console.info(`[strip] opened via ${dpip && win.opener === null ? "pip-or-popup" : "popup"}, stylesheets=${win.document.styleSheets.length}, head=${win.document.head.childElementCount}`);
  }
  return { win, root };
}
