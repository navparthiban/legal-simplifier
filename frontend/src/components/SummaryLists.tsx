import type { Risk } from '../lib/types';

/** The 3-line shimmer placeholder — ported from `_SKEL` in index.html. */
function Skeleton() {
  return (
    <>
      <li>
        <span className="sum-skeleton sum-skeleton-l"></span>
      </li>
      <li>
        <span className="sum-skeleton sum-skeleton-m"></span>
      </li>
      <li>
        <span className="sum-skeleton sum-skeleton-s"></span>
      </li>
    </>
  );
}

/** Mirrors `fillList`: renders non-null items, or the skeleton while `items` is
 *  null (field not yet complete in the stream). */
export function SummaryList({ id, items }: { id: string; items: string[] | null }) {
  return (
    <ul className="summary-list" id={id}>
      {items == null ? (
        <Skeleton />
      ) : (
        items.filter((text) => text != null).map((text, i) => <li key={i}>{text}</li>)
      )}
    </ul>
  );
}

/** Mirrors `fillRisks`. */
export function RiskList({ id, risks }: { id: string; risks: Risk[] | null }) {
  return (
    <ul className="risk-list" id={id}>
      {risks == null
        ? // fillRisks is only ever called with an array, but the skeleton path
          // sets the same _SKEL markup into #sumRisks — keep that parity.
          [
            <li key="s-l">
              <span className="sum-skeleton sum-skeleton-l"></span>
            </li>,
            <li key="s-m">
              <span className="sum-skeleton sum-skeleton-m"></span>
            </li>,
            <li key="s-s">
              <span className="sum-skeleton sum-skeleton-s"></span>
            </li>,
          ]
        : risks.map((r, i) => (
            <li className="risk-item" key={i}>
              <span className="risk-item-title">{r.title || ''}</span>
              <span className="risk-item-body">{r.description || ''}</span>
            </li>
          ))}
    </ul>
  );
}
