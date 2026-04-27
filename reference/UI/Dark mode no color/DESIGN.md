---
name: Soft Brutalist Dark
colors:
  surface: '#141314'
  surface-dim: '#141314'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353435'
  on-surface: '#e5e2e2'
  on-surface-variant: '#c7c6cb'
  inverse-surface: '#e5e2e2'
  inverse-on-surface: '#313031'
  outline: '#919095'
  outline-variant: '#46464b'
  surface-tint: '#c6c6ce'
  primary: '#c6c6ce'
  on-primary: '#2f3037'
  primary-container: '#9b9ba3'
  on-primary-container: '#32333a'
  inverse-primary: '#5d5e65'
  secondary: '#d5c4ab'
  on-secondary: '#392f1d'
  secondary-container: '#534834'
  on-secondary-container: '#c6b69e'
  tertiary: '#c7c8b4'
  on-tertiary: '#303224'
  tertiary-container: '#9c9d8a'
  on-tertiary-container: '#333426'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2ea'
  primary-fixed-dim: '#c6c6ce'
  on-primary-fixed: '#1a1b21'
  on-primary-fixed-variant: '#45464d'
  secondary-fixed: '#f1e0c6'
  secondary-fixed-dim: '#d5c4ab'
  on-secondary-fixed: '#231a0a'
  on-secondary-fixed-variant: '#504532'
  tertiary-fixed: '#e4e4cf'
  tertiary-fixed-dim: '#c7c8b4'
  on-tertiary-fixed: '#1b1d10'
  on-tertiary-fixed-variant: '#464839'
  background: '#141314'
  on-background: '#e5e2e2'
  surface-variant: '#353435'
typography:
  display:
    fontFamily: Epilogue
    fontSize: 72px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-h1:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-h2:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-main:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  mono-label:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
  mono-data:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0em
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
  container-max: 1440px
  gutter: 24px
  margin: 48px
---

## Brand & Style

This design system focuses on the intersection of architectural rigidity and atmospheric luxury. It evolves the "Brutalist Minimalism" aesthetic by stripping away aggressive high-contrast triggers and replacing them with a muted, editorial palette. The brand personality is intellectual, composed, and high-end, evoking the feeling of a digital boutique or a premium architectural journal. 

The visual style utilizes "Soft Brutalism"—preserving the raw structural honesty of hard edges, monospaced data, and visible grids, while softening the impact through textured dark surfaces and desaturated accents. The result is a moody, immersive interface that prioritizes content legibility and spatial discipline over decorative flourish.

## Colors

The palette is anchored by a deep charcoal surface (#1A1A1A) which should be implemented with a subtle grain texture to avoid the clinical feel of pure hex black. 

- **Primary (Lavender Grey):** Used for primary interactive states and highlighted metadata.
- **Secondary (Pale Gold):** Reserved for subtle accents, specialized CTA moments, or featured editorial content.
- **Tertiary (Olive Drab):** Utilized for secondary status indicators or categorized archival information.
- **Neutral (Borders/Text):** High-contrast whites are avoided; instead, use muted greys for text and sharp, low-luminance borders to define the grid without breaking the moody atmosphere.

## Typography

The typographic hierarchy relies on a juxtaposition between expressive, geometric headlines and technical, monospaced metadata. 

1. **Headlines (Epilogue):** Set with tight tracking and substantial weight to create "ink-heavy" focal points. 
2. **Body (Inter):** Highly legible and utilitarian to ensure long-form reading comfort against the dark textured background.
3. **Accents (Space Grotesk):** Used for all labels, tags, and data points. This monospaced feel reinforces the "Brutalist" structural integrity. Always use uppercase for labels to enhance the architectural aesthetic.

## Layout & Spacing

The layout is governed by a strict **12-column fixed grid** that emphasizes vertical alignment and horizontal rhythm. 

- **Grid Lines:** In certain editorial layouts, 1px borders (#2D2D2D) may be used to explicitly define the grid columns, reinforcing the structural minimalism.
- **Rhythm:** Use a 4px base unit. Margins are generous (48px+) to allow the content to "breathe" within the dark void.
- **Alignment:** All elements must snap to the grid. Avoid centering; use left-aligned blocks to maintain the brutalist feel.

## Elevation & Depth

This design system rejects traditional shadows and depth. Instead, it utilizes **Tonal Layering** and **Sharp Outlines**:

- **Layers:** Depth is communicated by shifting the background color from #121212 (Base) to #1A1A1A (Surface) to #242424 (Interactive/Hover).
- **Outlines:** Use 1px solid borders (#2D2D2D) for all containers. On hover or active states, these borders can transition to the accent colors (e.g., Lavender Grey).
- **Flatness:** Do not use blurs, gradients, or soft drop-shadows. The interface should feel like a series of interlocking physical plates.

## Shapes

The shape language is strictly **Sharp (0px)**. Every button, card, input, and container must have right-angled corners. This lack of curvature is essential to maintaining the "Brutalist" structural feel and architectural precision. Visual interest is generated through alignment and color blocking rather than corner treatment.

## Components

- **Buttons:** Sharp 1px borders. Default state is transparent with a Lavender Grey border; hover state is a solid Lavender Grey fill with #1A1A1A text. Use Space Grotesk (Uppercase) for button labels.
- **Input Fields:** Bottom-border only or full 1px box. Focus state changes the border color to Pale Gold. Use monospaced font for placeholder text.
- **Cards:** No shadows. Defined by a 1px #2D2D2D border. Background should be the textured #1A1A1A charcoal.
- **Chips/Tags:** Small, sharp boxes with a Tertiary (Olive Drab) border and monospaced text.
- **Lists:** Separated by horizontal 1px lines. Hovering over a list item should trigger a subtle background color shift to #242424.
- **Navigation:** Minimalist text links in monospaced caps. Use a small square glyph (4x4px) next to the active page link to denote the current location.
- **Architectural Dividers:** Use vertical and horizontal lines to separate content blocks, mimicking the layout of a blueprint or technical manual.