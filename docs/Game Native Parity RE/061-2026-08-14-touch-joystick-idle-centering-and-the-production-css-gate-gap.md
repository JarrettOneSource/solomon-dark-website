# 2026-08-14 — Touch joystick idle centering and the production-CSS gate gap

## Defect

- On the deployed site the touch joystick knob idled down-right of the base
  ring instead of centered, and rode that same offset during drags. Dev-server
  sessions never reproduced it.
- The knob was centered by two cooperating declarations: stylesheet
  `top/left: 50%` plus the independent CSS `translate: -50% -50%` property,
  while the React inline style drove the drag offset through `transform`.
- The production pipeline (Lightning CSS targets) folds the independent
  `translate` property into the `transform` shorthand:
  `transform:translate(0)translate(-50%,-50%)`. The runtime inline
  `transform: translate(Xpx, Ypx)` then overrides the entire merged shorthand,
  discarding the centering. The knob renders with its top-left corner on the
  base center — half a knob (32 logical px) down-right, scaled by the mobile
  viewport transform.

## Why every gate missed it

- The device journey (`smoke:game:devices`) asserts knob-center geometry, but
  only against the Vite dev server, whose unminified CSS keeps the independent
  `translate` property. The defect exists only in the compiled bundle, a
  surface no browser gate exercised.

## Correction

- The knob's inline style now owns the whole transform:
  `translate(-50%, -50%) translate(Xpx, Ypx)`; the stylesheet keeps no
  `transform` or `translate` on the knob. One owner, nothing for the pipeline
  to fold, nothing for the inline style to shadow. This was the codebase's
  only independent transform property.
- The component is game-wide, not Hub-specific (Hub and Boneyard both mount
  it), so it is rebranded: `HubTouchJoystick.tsx` → `input/TouchJoystick.tsx`,
  classes `hub-touch-joystick*` → `game-touch-joystick*`, styles moved out of
  `hub.css` into component-owned `input/touch-joystick.css`.
- New gate `smoke:game:built-joystick` drives the PRODUCTION bundle: vite
  preview over `backend/wwwroot` plus a real game host injected through the
  `window.solomonDarkRuntime.gameEndpoint` seam. It settles the knob (10
  identical samples) and asserts idle center, touch-follow, and release
  recentering within 1 px.

## Validation receipt

- Full frontend suite passes (`376` tests) with the rename; lint and game
  architecture boundaries clean.
- Built-bundle smoke: idle knob `(51.13, 325.00)` equal to base center to the
  hundredth, follow and release branches green, zero page errors.
- Mutation receipt: restoring the split-ownership CSS and bare inline offset
  rebuilds into the folded shorthand and the gate fails at
  `idle knob must center in the base (x 65.00 vs 51.13)` — the exact escaped
  defect, at mobile viewport scale. The fix restored, the gate returns green.
