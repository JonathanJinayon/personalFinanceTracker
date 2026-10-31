type Theme = "light" | "dark";
type ThemeSetter = (theme: Theme) => void;

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export function switchTheme(theme: Theme, setTheme: ThemeSetter) {
  const transitionDocument = document as ViewTransitionDocument;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion || !transitionDocument.startViewTransition) {
    setTheme(theme);
    return;
  }

  const transition = transitionDocument.startViewTransition(() => {
    setTheme(theme);
  });

  void transition.finished.catch(() => undefined);
}

export function toggleTheme(currentTheme: Theme | undefined, setTheme: ThemeSetter) {
  switchTheme(currentTheme === "dark" ? "light" : "dark", setTheme);
}

export type { Theme };
