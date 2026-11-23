# sraww brand guidelines

sraww is a local whiteboard for sketching the systems you build. The identity is calm and precise: an open canvas frame with one point of focus, set in a plain geometric wordmark.

**Tagline:** Sketch the systems you build.

## The mark

The symbol is a canvas outline, open at the top right, with one filled point inside. The open corner is where the canvas begins, and the point is the thing you are working on.

Use the symbol alone where space is tight (favicon, app icon, avatars). Use the primary lockup (symbol and wordmark) everywhere else.

## Clear space and size

- **Clear space:** keep a margin around the symbol equal to the diameter of its point. Nothing else should sit inside that margin.
- **Minimum size:** symbol 16 px. Primary lockup 120 px wide. Wordmark on its own 80 px wide.

## Colour

| Role          | Name          | Hex       | Used for                                     |
| ------------- | ------------- | --------- | -------------------------------------------- |
| Accent        | Indigo        | `#4F46E5` | Symbol and app icon field on light           |
| Accent (dark) | Lifted indigo | `#8D8AF7` | Symbol on dark backgrounds                   |
| Ink           | Ink           | `#1C1D2E` | Wordmark on light                            |
| Paper         | Paper         | `#F6F5F1` | Wordmark on dark; symbol inside the app icon |
| Dark ground   | Night         | `#14151F` | Background for dark versions                 |

The mark uses one colour per version: the accent (or its dark form) for the symbol, and ink or paper for the wordmark. Do not add gradients, shadows or outlines.

## Typography

The wordmark is "sraww" in lowercase, Space Grotesk Medium (SIL Open Font License), converted to outlines so the files need no installed font. Do not retype it in another font.

The app's interface keeps its own type: a system sans for controls and an editorial serif for headings.

## Versions

| Use                   | File                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| Symbol, light         | `logo/sraww-symbol.svg`                                                         |
| Symbol, dark          | `logo/sraww-symbol-dark.svg`                                                    |
| Wordmark, light       | `logo/sraww-wordmark.svg`                                                       |
| Wordmark, dark        | `logo/sraww-wordmark-dark.svg`                                                  |
| Primary lockup, light | `logo/sraww-primary-light.svg`                                                  |
| Primary lockup, dark  | `logo/sraww-primary-dark.svg`                                                   |
| App icon              | `logo/sraww-app-icon.svg` (and `logo/png/app-icon-512.png`, `app-icon-192.png`) |
| Apple touch icon      | `logo/png/apple-touch-icon-180.png`                                             |
| Favicon               | `logo/favicon.ico` (16, 32, 48 px); `logo/png/favicon-16.png`, `favicon-32.png` |
| Social avatar         | `logo/png/social-avatar-1024.png`                                               |

PNG renders of the primary lockup are in `logo/png/`.

## Do

- Use the approved colours on the approved backgrounds.
- Place the light version on paper or white, and the dark version on ink or black.
- Keep the symbol square and unrotated.

## Don't

- Don't rotate, stretch, skew or re-proportion the mark.
- Don't recolour outside the palette above, or add effects.
- Don't place the mark on busy photos or patterns.
- Don't rebuild the wordmark from live text.

## Status

- Round 1 concepts (A angular, B organic, C canvas frame) are in `brand/concepts/round-1/`. C was chosen.
- The app still uses the earlier placeholder mark (`assets/icon.svg`) in its favicon and README. Wiring in the new set needs a separate go-ahead.
