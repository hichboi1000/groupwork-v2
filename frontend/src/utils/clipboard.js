/**
 * navigator.clipboard only exists in secure contexts (HTTPS, or
 * localhost). Testing this app from a phone over LAN — which the
 * project's own .env.example tells people to do, pointing
 * VITE_API_BASE_URL at a bare http://192.168.x.x address — is NOT a
 * secure context, so navigator.clipboard is simply undefined there.
 * Any call site that did `navigator.clipboard.writeText(...)` without
 * a fallback silently threw and never copied anything, with the button
 * still claiming success. This is almost certainly why "the copy
 * button doesn't copy" during beta testing.
 *
 * Returns true/false so callers can show real success/failure feedback
 * instead of assuming it always worked.
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path below
    }
  }
  // Legacy fallback: a temporary offscreen textarea + document.execCommand.
  // Deprecated, but it's the only thing that works without HTTPS, and
  // "actually copies on your phone during a beta test" beats "uses the
  // modern API but silently fails."
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
