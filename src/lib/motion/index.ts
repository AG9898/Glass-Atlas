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
