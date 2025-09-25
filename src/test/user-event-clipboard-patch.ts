// Lightweight safe wrapper to call @testing-library/user-event Clipboard helpers
// with document.defaultView to avoid teardown errors when globalThis.window
// may not have a navigator/clipboard present.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const userEventClipboard = require('@testing-library/user-event/dist/esm/utils/dataTransfer/Clipboard.js');
  // Replace module exports with safe wrappers so that any internal
  // module-level afterEach/afterAll callbacks that call these functions
  // won't throw if the Window/navigator were cleared during environment
  // teardown. We keep the original functions and call them with
  // document.defaultView when possible, otherwise swallow errors.
  try {
    const origReset = userEventClipboard.resetClipboardStubOnView;
    const origDetach = userEventClipboard.detachClipboardStubFromView;
    userEventClipboard.resetClipboardStubOnView = (win: any) => {
      try {
        return origReset(win || (typeof document !== 'undefined' && (document as any).defaultView) || (globalThis as any).window);
      } catch (e) {
        // ignore
      }
    };
    userEventClipboard.detachClipboardStubFromView = (win: any) => {
      try {
        return origDetach(win || (typeof document !== 'undefined' && (document as any).defaultView) || (globalThis as any).window);
      } catch (e) {
        // ignore
      }
    };
  } catch (e) {
    // ignore if not present
  }
} catch (e) {
  // ignore if user-event not installed
}
