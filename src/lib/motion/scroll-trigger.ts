import { browser } from '$app/environment';
import { getLoadedPublicGsap } from './gsap';

type RefreshReason = 'route' | 'layout' | 'media' | 'manual';

const pendingRefreshes = new Map<RefreshReason, number>();

export async function refreshPublicScrollTriggers(): Promise<void> {
  const motion = await getLoadedPublicGsap();
  motion?.ScrollTrigger.refresh();
}

export function schedulePublicScrollTriggerRefresh(reason: RefreshReason = 'manual'): () => void {
  if (!browser) return () => undefined;

  const existingFrame = pendingRefreshes.get(reason);
  if (existingFrame !== undefined) window.cancelAnimationFrame(existingFrame);

  const frame = window.requestAnimationFrame(() => {
    pendingRefreshes.delete(reason);
    void refreshPublicScrollTriggers();
  });

  pendingRefreshes.set(reason, frame);

  return () => {
    const pendingFrame = pendingRefreshes.get(reason);
    if (pendingFrame === frame) {
      window.cancelAnimationFrame(frame);
      pendingRefreshes.delete(reason);
    }
  };
}

export function setupPublicScrollTriggerAutoRefresh(): () => void {
  if (!browser) return () => undefined;

  const scheduleLayoutRefresh = () => schedulePublicScrollTriggerRefresh('layout');
  const scheduleMediaRefresh = () => schedulePublicScrollTriggerRefresh('media');

  window.addEventListener('resize', scheduleLayoutRefresh, { passive: true });
  window.addEventListener('load', scheduleMediaRefresh, { once: true });
  void document.fonts?.ready.then(scheduleMediaRefresh);

  return () => {
    window.removeEventListener('resize', scheduleLayoutRefresh);
    window.removeEventListener('load', scheduleMediaRefresh);
    schedulePublicScrollTriggerRefresh('layout')();
    schedulePublicScrollTriggerRefresh('media')();
  };
}
