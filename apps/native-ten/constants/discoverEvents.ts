type View = "discover" | "dashboard";
type Listener = (view: View) => void;

const listeners = new Set<Listener>();
// null means the user has never made a manual choice — gate logic can decide
let manualOverride: View | null = null;

export const discoverEvents = {
  /**
   * Returns the user's manual view override, or null if they haven't chosen yet.
   * Use this to check whether the gate auto-redirect should be suppressed.
   */
  getOverride(): View | null {
    return manualOverride;
  },
  /** Returns the effective current view (falls back to "discover" if no override). */
  current(): View {
    return manualOverride ?? "discover";
  },
  on(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Call when the user manually picks a view. Sets the override and notifies listeners. */
  emit(view: View) {
    manualOverride = view;
    listeners.forEach((fn) => fn(view));
  },
  /** Call when the gate (not the user) sets the view — updates current but NOT the override. */
  setGateView(view: View) {
    listeners.forEach((fn) => fn(view));
  },
};
