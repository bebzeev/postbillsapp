export const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const isTouch = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia
    ? window.matchMedia('(pointer: coarse)').matches
    : 'ontouchstart' in window);
