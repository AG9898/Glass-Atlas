export {
  canUseSpatialMotion,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  watchReducedMotionPreference,
  type MotionPreferenceWindow,
} from './preferences';
export {
  createPublicGsapContext,
  getLoadedPublicGsap,
  loadPublicGsap,
  type PublicGsap,
  type PublicGsapContextScope,
  type PublicGsapContextSetup,
} from './gsap';
export {
  refreshPublicScrollTriggers,
  schedulePublicScrollTriggerRefresh,
  setupPublicScrollTriggerAutoRefresh,
} from './scroll-trigger';
export {
  isPublicSmoothScrollPath,
  publicSmoothScroll,
  PUBLIC_SMOOTH_SCROLL_CONFIG,
  PUBLIC_SMOOTH_SCROLL_CONTENT_SELECTOR,
} from './smooth-scroll';
export {
  isPublicRouteTransitionPath,
  shouldSkipPageTransition,
  PAGE_TRANSITION_COVER_DURATION,
  PAGE_TRANSITION_COVER_EASE,
  PAGE_TRANSITION_COVERED_CLIP_PATH,
  PAGE_TRANSITION_IDLE_CLIP_PATH,
  PAGE_TRANSITION_REVEAL_DURATION,
  PAGE_TRANSITION_REVEAL_EASE,
  PAGE_TRANSITION_REVEALED_CLIP_PATH,
} from './page-transition';
export {
  getWaveGridConfig,
  resolveWaveGridPalette,
  shouldUseWaveGridMotion,
  WAVE_GRID_COMPACT_CONFIG,
  WAVE_GRID_OVERLAY_CONFIG,
  WAVE_GRID_PALETTE_FALLBACKS,
  WAVE_GRID_PALETTE_TOKENS,
  type WaveGridConfig,
  type WaveGridPalette,
  type WaveGridPaletteDocument,
  type WaveGridPaletteKey,
  type WaveGridStyleDeclaration,
  type WaveGridStyleReader,
  type WaveGridVariant,
} from './wave-grid';
export {
  createGridSegments,
  createWaveGridLayers,
  createWaveGridScene,
  updateWaveGridLayer,
  type GridSegment,
  type ThreeModule,
  type WaveGridLayer,
  type WaveGridScene,
} from './wave-grid-engine';
