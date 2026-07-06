export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export type MotionPreferenceWindow = Pick<Window, 'matchMedia'>;

function getDefaultWindow(): MotionPreferenceWindow | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

export function prefersReducedMotion(targetWindow = getDefaultWindow()): boolean {
  if (!targetWindow) return true;

  return targetWindow.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function canUseSpatialMotion(targetWindow = getDefaultWindow()): boolean {
  return !prefersReducedMotion(targetWindow);
}

export function watchReducedMotionPreference(
  onChange: (prefersReduced: boolean) => void,
  targetWindow = getDefaultWindow(),
): () => void {
  if (!targetWindow) {
    onChange(true);
    return () => undefined;
  }

  const query = targetWindow.matchMedia(REDUCED_MOTION_QUERY);
  const handleChange = (event: MediaQueryListEvent) => onChange(event.matches);

  onChange(query.matches);
  query.addEventListener('change', handleChange);

  return () => query.removeEventListener('change', handleChange);
}
