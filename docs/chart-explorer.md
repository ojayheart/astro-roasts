# Interactive charts

`RoastWheel` now contains Astrology and Human Design tabs on both teaser and full roast pages. Horizontal swipes switch views; visible tabs also support arrow keys, Home and End. Vertical scrolling preserves the current view. Enlarged chart areas scroll independently and do not trigger the chart switch gesture.

Astrology keeps the cached natal data and existing two-person wheel. Placements and angles have a readable selection list. Exact facts come from the same element enumeration as the chart, including when generated annotations are unavailable. Aspect lines are optional. Label spacing handles the 0° boundary; original degree ticks remain unchanged. Interactive charts render without the loading wheel's rotating/pulsing decoration.

Human Design is calculated locally, on demand, from a known `birth.utc`. It does not call another service or write another database record. Unknown birth times show an explanatory state. Two-person roasts offer a subject selector. The MIT engine from whitspce/hd-chart uses astronomy-engine 2.1.19; attribution is in `lib/vendor/HD-LICENSE.txt`. Design time uses 88° of solar movement, not a fixed number of days. This remains an interpretive system, not a validated personality assessment.

The diagram has the familiar centre shapes with original geometry. All 64 gate positions meet the correct shape boundaries. Default detail shows complete connections; full detail reveals all gates and channels. Half-channel colouring shows Personality, Design or both. Selection dims unrelated connections and provides exact activation information. Shape and spacing do not change gate membership or definition.

## Verification

- `npm test`: 119 tests, including reference Human Design activations, definition, polygon attachment, solar design arc, hanging gates, distinct birth instants and circular label spacing.
- `npm run lint` and `npm run build`.
- `http://localhost:3017/dev-charts` when running `npm run dev -- --port 3017`: development-only solo, duo and unknown-time fixtures. Astrology placements are synthetic QA data. Production renders 404 and contains no fixture data in the page.
- Evaluate `scripts/verify-chart-explorer.browser.js` in that page at 390 × 844: 22 browser assertions covering selection, density, keyboard, zoom, simulated touch gestures, exact fallback facts and subject switching. Native mouse selection at mobile dimensions also verified explanation visibility. Desktop layout visually inspected.

Physical-device swipe behavior and screen-reader output have not been tested. Production rollout is separate from local QA; the fixtures do not call paid chart or annotation APIs.
