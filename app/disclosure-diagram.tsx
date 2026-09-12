// covenant. the boundary, as a picture.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS AT ALL
// ---------------------------------------------------------------------------
//
// the product is a negative: five figures go in and do not come out. a
// paragraph can assert that, but the reader has to hold both halves in their
// head at once to feel it, and a judge reading asynchronously at speed will not.
// the picture puts both halves side by side so the asymmetry is the first thing
// seen rather than a conclusion drawn.
//
// it earns its place only because the right-hand box is visibly shorter than the
// left. that is the entire argument. if a later edit pads it out to match, the
// diagram has stopped saying anything and should be deleted rather than kept.
//
// ---------------------------------------------------------------------------
// WHY IT IS HAND-WRITTEN SVG
// ---------------------------------------------------------------------------
//
// no chart library. there is no data here, only a fixed arrangement of five
// rectangles, and a dependency that ships a layout engine to draw five
// rectangles is a dependency whose defaults, gradients and tooltips then have to
// be argued down. every stroke and fill is `currentColor` under a tailwind text
// class, so both schemes follow the theme with no second palette to maintain and
// no fixed hex to go wrong in dark mode.
//
// arrowheads are explicit paths rather than `<marker>` elements. markers need a
// document-unique id, and a page that later renders this twice would have two
// elements claiming the same id, which is invalid and resolves differently
// across browsers.
//
// ---------------------------------------------------------------------------
// WHY IT LIVES HERE AND NOT IN app/components
// ---------------------------------------------------------------------------
//
// it names the five borrower figures as words. that is fine on the front page,
// which discloses nothing, and it would be a bad module for the lender's bundle
// to start importing. app/components is the shared drawer both views reach into.
// this is colocated with its one caller so reaching for it is deliberate.

/** the five figures the agent holds. names only, never values. */
const FILING = [
  "revenue",
  "earnings",
  "total debt",
  "cash",
  "interest expense",
];

/** what crosses. the whole of what crosses. */
const DISCLOSED = ["covenant verdict", "advance rate"];

export default function DisclosureDiagram() {
  return (
    // min-width rather than letting the viewBox scale to a phone: at 360px wide
    // the 13px labels would render at about 6px and the diagram would be a
    // decoration of itself. it scrolls instead.
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 760 300"
        role="img"
        aria-labelledby="boundary-title boundary-desc"
        className="w-full min-w-[38rem] font-mono"
      >
        <title id="boundary-title">what crosses the disclosure boundary</title>
        <desc id="boundary-desc">
          five borrower figures, revenue, earnings, total debt, cash and
          interest expense, enter the published covenant program. two results
          leave it and cross to the lender: a covenant verdict and an advance
          rate. the five figures do not cross.
        </desc>

        {/* column headings */}
        <g
          className="text-zinc-500"
          fill="currentColor"
          fontSize="12"
          letterSpacing="0.04em"
        >
          <text x="0" y="14">
            the agent holds
          </text>
          <text x="300" y="14">
            the program decides
          </text>
          <text x="590" y="14">
            the lender receives
          </text>
        </g>

        {/* boxes, arrows and the boundary. one colour, hairline weight. */}
        <g
          className="text-zinc-400 dark:text-zinc-600"
          stroke="currentColor"
          fill="none"
          strokeWidth="1"
        >
          <rect x="0.5" y="32.5" width="200" height="156" />
          <rect x="300.5" y="32.5" width="170" height="156" />
          <rect x="590.5" y="68.5" width="169" height="84" />

          {/* filing into the program */}
          <path d="M201 110 H292" />
          {/* the program's results, across the boundary */}
          <path d="M471 110 H582" />

          {/* the boundary itself. everything to its right is public to the
              lender, everything to its left is not. */}
          <path d="M530 4 V266" strokeDasharray="3 5" />
        </g>

        {/* arrowheads, filled, same colour */}
        <g className="text-zinc-400 dark:text-zinc-600" fill="currentColor">
          <path d="M299 110 L291 106 L291 114 Z" />
          <path d="M589 110 L581 106 L581 114 Z" />
        </g>

        {/* the five figures */}
        <g
          className="text-zinc-900 dark:text-zinc-100"
          fill="currentColor"
          fontSize="13"
        >
          {FILING.map((row, i) => (
            <text key={row} x="16" y={58 + i * 26}>
              {row}
            </text>
          ))}
        </g>

        {/* the program */}
        <g
          className="text-zinc-900 dark:text-zinc-100"
          fill="currentColor"
          fontSize="13"
          textAnchor="middle"
        >
          <text x="385" y="98">
            the covenant tests,
          </text>
          <text x="385" y="122">
            published in full
          </text>
        </g>

        {/* the two results */}
        <g
          className="text-zinc-900 dark:text-zinc-100"
          fill="currentColor"
          fontSize="13"
        >
          {DISCLOSED.map((row, i) => (
            <text key={row} x="606" y={100 + i * 26}>
              {row}
            </text>
          ))}
        </g>

        {/* the two notes that make the asymmetry explicit rather than implied */}
        <g className="text-zinc-500" fill="currentColor" fontSize="12">
          <text x="0" y="212">
            never leaves the agent&rsquo;s console
          </text>
          <text x="590" y="286">
            nothing else crosses
          </text>
        </g>
      </svg>
    </div>
  );
}
