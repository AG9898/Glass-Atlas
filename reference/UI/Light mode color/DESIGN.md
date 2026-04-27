---
name: Soft Editorial Brutalism
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#424842'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#737972'
  outline-variant: '#c2c8c0'
  surface-tint: '#4a654f'
  primary: '#4a654f'
  on-primary: '#ffffff'
  primary-container: '#8daa91'
  on-primary-container: '#253f2b'
  inverse-primary: '#b0ceb4'
  secondary: '#735758'
  on-secondary: '#ffffff'
  secondary-container: '#fcd7d7'
  on-secondary-container: '#785c5c'
  tertiary: '#466179'
  on-tertiary: '#ffffff'
  tertiary-container: '#8ba6c0'
  on-tertiary-container: '#203c52'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cceacf'
  primary-fixed-dim: '#b0ceb4'
  on-primary-fixed: '#062010'
  on-primary-fixed-variant: '#334d38'
  secondary-fixed: '#ffdada'
  secondary-fixed-dim: '#e2bebe'
  on-secondary-fixed: '#2a1617'
  on-secondary-fixed-variant: '#5a4041'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#aecae5'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#2e4960'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-xl:
    fontFamily: Epilogue
    fontSize: 80px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Epilogue
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Epilogue
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-caps:
    fontFamily: Epilogue
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.1em
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  xxl: 80px
  grid-gutter: 1px
---

## Brand & Style

This design system occupies the space between raw structural integrity and high-end editorial sophistication. It leverages the "Soft Brutalist" aesthetic—a movement that preserves the honest, grid-obsessed layout of classical Brutalism but replaces its aggressive industrialism with a serene, muted palette. 

The target audience is design-conscious users in the creative, architectural, or luxury lifestyle sectors who value clarity, deliberate structure, and a calm emotional response. The UI should feel like a premium printed monograph: permanent, intellectual, and spacious.

## Colors

The palette is anchored by a warm, paper-like surface (#F9F7F2) that reduces the harshness typically found in pure white digital interfaces. The primary accents—Sage Green, Dusty Rose, and Slate Blue—are desaturated and sophisticated, used to highlight intent without overwhelming the content.

- **Primary (Sage Green):** Use for success states, primary actions, and key thematic highlights.
- **Secondary (Dusty Rose):** Use for accent details, decorative elements, and secondary call-to-outs.
- **Tertiary (Slate Blue):** Use for informative icons, subtle interactive states, and background variations.
- **Neutral:** A deep charcoal (#1A1A1A) provides the necessary weight for typography and the 1px structural grid lines.

## Typography

This design system utilizes **Epilogue** exclusively to maintain a cohesive, geometric, and editorial atmosphere. The typeface's versatility allows it to function as both a high-impact display face and a legible body font.

Headlines should be set with tight leading and negative letter-spacing to emphasize the "blocky" nature of the layout. Body text requires generous line-height to ensure readability against the structural grid. Labels are strictly uppercase with increased letter-spacing to act as wayfinding markers within the interface.

## Layout & Spacing

The layout is governed by a rigid, visible grid system. Elements are separated by **1px solid neutral (#1A1A1A)** lines rather than shadows or whitespace alone. 

- **Grid:** Use a 12-column fluid grid for web layouts, but ensure the structural 1px lines define the containers.
- **Rhythm:** Spacing follows a base-4 scale. Content within grid cells should maintain a minimum padding of 24px (lg) to ensure the "Soft" aspect of the Brutalism remains visible through ample breathing room.
- **Alignment:** All elements must snap to the 1px grid. Avoid floating elements; every component should feel like it is "locked" into a frame.

## Elevation & Depth

This design system is intentionally flat. It rejects shadows and blurs in favor of **Bold Borders** and **Tonal Stacking**.

- **Structural Depth:** Depth is communicated by "stacking" 1px bordered boxes. When a modal or menu appears, it does not float with a shadow; it appears as a sharp-edged box with a 1px border, perhaps offset by 4px to create a "shadow" made of a solid accent color block.
- **Visual Hierarchy:** Focus is directed through the use of the accent colors (#8DAA91, #C7A5A5, #7E99B3) as background fills for specific grid cells, rather than through Z-axis elevation.

## Shapes

The shape language is strictly **Sharp (0px)**. To maintain the editorial aesthetic, there are no rounded corners in the design system. This applies to buttons, input fields, cards, and even state indicators. The geometric purity of the square/rectangle reinforces the architectural and "printed" feel of the interface.

## Components

- **Buttons:** Rectangular with 1px solid neutral borders. The default state uses the surface color; the primary state uses a Sage Green (#8DAA91) fill. On hover, buttons should shift their fill color or slightly offset their position by 2px, revealing a solid black "shadow" box underneath.
- **Inputs:** Simple boxes defined by 1px neutral borders. Labels sit at the top-left, often separated by a horizontal 1px line, mimicking a technical form.
- **Chips:** Small, sharp-edged rectangles with a Slate Blue (#7E99B3) or Dusty Rose (#C7A5A5) background and the `label-caps` type style.
- **Cards:** Cards are simply grid cells. They should use 1px borders to separate content. For featured content, use a background fill of one of the soft accent colors.
- **Lists:** Items are separated by 1px horizontal lines. Hover states involve a full-width background color change to the soft surface or a light tint of an accent color.
- **Grid Lines:** Use 1px lines to separate the navigation, the sidebar, and the main content area, ensuring the entire screen looks like a perfectly measured blueprint.