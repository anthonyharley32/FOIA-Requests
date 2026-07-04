/**
 * Spring transition presets for consistent animation feel.
 * Ported from a sibling project's Motion setup (subtle, professional settings).
 */
export const springs = {
  /** Quick interactions: buttons, taps, hovers (200ms, 10% bounce) */
  quick: { type: 'spring', duration: 0.2, bounce: 0.1 },
  /** Standard transitions: modals, messages, tooltips (250ms, 15% bounce) */
  standard: { type: 'spring', duration: 0.25, bounce: 0.15 },
  /** Gentle transitions: slow reveals (300ms, 5% bounce) */
  gentle: { type: 'spring', duration: 0.3, bounce: 0.05 },
}

/**
 * Reusable animation variants for common patterns.
 */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const slideUp = {
  initial: { y: 8, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -4, opacity: 0 },
}

export const scaleIn = {
  initial: { scale: 0.97, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.97, opacity: 0 },
}

/**
 * Stagger configuration for list animations.
 */
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

/**
 * Button interaction presets.
 */
export const buttonTap = {
  whileTap: { scale: 0.97 },
  transition: springs.quick,
}

export const buttonHover = {
  whileHover: { scale: 1.02 },
  transition: springs.quick,
}
