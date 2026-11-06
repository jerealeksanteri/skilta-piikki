/**
 * Minimal in-app navigation guard (the app uses <BrowserRouter>, which has no
 * useBlocker). A page registers a guard; navigation sources that go through
 * `guardedNavigate` (e.g. the bottom tab bar) ask it first.
 *
 * A guard returns true when it has taken over (e.g. opened a "Discard?" dialog)
 * and will call `proceed` itself if the user confirms.
 */
export type NavigationGuard = (proceed: () => void) => boolean;

let currentGuard: NavigationGuard | null = null;

export function setNavigationGuard(guard: NavigationGuard): () => void {
  currentGuard = guard;
  return () => {
    if (currentGuard === guard) currentGuard = null;
  };
}

export function guardedNavigate(proceed: () => void): void {
  if (currentGuard && currentGuard(proceed)) return;
  proceed();
}
