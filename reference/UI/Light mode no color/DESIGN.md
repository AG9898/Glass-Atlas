---
name: Editorial Brutalist
colors:
  surface: '#fdf8f8'
  surface-dim: '#ddd9d8'
  surface-bright: '#fdf8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3f2'
  surface-container: '#f1edec'
  surface-container-high: '#ebe7e6'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#444748'
  inverse-surface: '#313030'
  inverse-on-surface: '#f4f0ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#43617c'
  on-secondary: '#ffffff'
  secondary-container: '#c1e0ff'
  on-secondary-container: '#46647e'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b1a'
  on-tertiary-container: '#868382'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#abcae8'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#2b4963'
  tertiary-fixed: '#e6e2df'
  tertiary-fixed-dim: '#cac6c4'
  on-tertiary-fixed: '#1c1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#fdf8f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-xl:
    fontFamily: Epilogue
    fontSize: 84px
    fontWeight: '800'
    lineHeight: 90%
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 100%
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 110%
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Newsreader
    fontSize: 22px
    fontWeight: '400'
    lineHeight: 160%
  body-md:
    fontFamily: Newsreader
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 160%
  label-bold:
    fontFamily: Epilogue
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 120%
  label-sm:
    fontFamily: Epilogue
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 120%
spacing:
  base: 8px
  xs: 4px
  sm: 16px
  md: 32px
  lg: 64px
  xl: 128px
  gutter: 24px
  margin: 40px
---

## Brand & Style

The design system is defined by an intellectual tension between raw structural honesty and sophisticated literary elegance. It targets a discerning audience that values content over decoration. The "Graceful Brutalism" aesthetic is achieved by stripping away all unnecessary UI ornamentation—shadows, rounded corners, and gradients—and replacing them with architectural layouts, deliberate whitespace, and high-contrast typographic pairings. The emotional response is one of clarity, authority, and unpretentious modernism.

## Colors

This design system utilizes a restricted, high-impact palette. The background is an off-white neutral that reduces the harshness of pure white while maintaining a "raw paper" feel. Deep black is used for all primary communication, including text and structural borders. A muted cobalt blue serves as the sole accent color, reserved strictly for interactive cues, links, and highlights to ensure it remains a meaningful signifier rather than a decorative element.

## Typography

Typography is the primary visual driver of the design system. It employs a high-contrast pairing of **Epilogue** for structural and high-impact elements and **Newsreader** for long-form editorial content. Headlines should be set with tight leading and aggressive tracking to emphasize the brutalist influence. Body copy is optimized for immersion, utilizing the elegant serifs of Newsreader with generous line height to ensure maximum readability against the minimal backdrop.

## Layout & Spacing

The design system uses a fixed 12-column grid with a philosophy of "raw exposure." Instead of hiding the grid, the layout often highlights it through the use of 2px black horizontal and vertical rules. Spacing is intentional and often asymmetrical; large "voids" of whitespace are used to separate content sections rather than contained boxes. Elements should align strictly to the grid lines, creating a sense of architectural stability.

## Elevation & Depth

There is zero use of Z-axis depth through shadows or blurs. Hierarchy is established exclusively through scale, line weight, and typographic dominance. Layers are represented as flat planes. If an element needs to appear "above" another (such as a navigation bar or a modal), it should use a solid fill of the background color and be delineated by a 2px black border. This maintains the "Brutalist Minimalism" requirement for a raw, unpolished, and two-dimensional interface.

## Shapes

The design system utilizes a strictly sharp aesthetic. All UI elements, including buttons, input fields, and image containers, have a 0px border radius. This lack of curvature reinforces the raw and uncompromising nature of the brutalist style. Any visual interest should come from the intersection of sharp lines and the contrast between filled and hollow rectangular shapes.

## Components

### Buttons
Buttons are rectangular with 2px solid black borders. The default state is a transparent background with black text. The hover state features a solid black fill with white text or a solid muted cobalt fill.

### Input Fields
Inputs are stripped of their containers. Use a single 2px bottom border that changes to the accent cobalt blue upon focus. Labels should be small, bold, and uppercase, placed directly above the line.

### Lists & Navigation
Lists are separated by 1px horizontal rules that span the full width of their container. Navigation links use the Epilogue font and transition to the accent color on hover, without underlines.

### Articles & Feed
Avoid cards entirely. Articles in a feed are separated by 2px horizontal rules and significant vertical whitespace. Featured images should be full-bleed to the grid columns with no rounding or shadows.

### Chips & Tags
Tags are simple text elements in bold uppercase sans-serif. If a container is necessary, use a thin 1px black border with sharp corners and no fill.

### Dividers
Dividers are a core component of the design system. Use them liberally to define sections. Vary the weight between 1px (subtle separation) and 4px (major section breaks) to create visual rhythm.