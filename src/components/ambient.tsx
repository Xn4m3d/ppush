/**
 * Background atmosphere — three colour nebulae drifting slowly, the dawn glow
 * anchored at the bottom of the viewport, and a grain layer.
 *
 * Purely decorative: `position: fixed`, negative `z-index`, no state, no JS.
 * The colours come from the theme tokens (`globals.css`), so the night/day
 * switch carries it along. `prefers-reduced-motion` freezes the nebulae
 * instead of removing them.
 */
export function Ambient() {
  return (
    <div aria-hidden>
      <div className="sky">
        <i className="n1" />
        <i className="n2" />
        <i className="n3" />
      </div>
      <div className="horizon" />
      <div className="grain" />
    </div>
  );
}
