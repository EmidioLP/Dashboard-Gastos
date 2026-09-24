import type { CategoryTotal } from '../lib/selectors'
import { formatMoney } from '../lib/format'

interface Props {
  data: CategoryTotal[]
  onSelect?: (categoryId: string) => void
}

/** Ranked horizontal bars: one hue for magnitude, category identity carried by icon + name. */
export function CategoryBreakdown({ data, onSelect }: Props) {
  if (!data.length) return <p className="empty">Nenhuma despesa neste mês.</p>
  const max = data[0].total

  return (
    <ol className="breakdown">
      {data.map(({ category, total, share }) => (
        <li key={category.id}>
          <button
            className="breakdown-row"
            onClick={() => onSelect?.(category.id)}
            title={`${category.name}: ${formatMoney(total)} (${(share * 100).toFixed(1)}%) — ver lançamentos`}
          >
            <span className="breakdown-label">
              <span aria-hidden>{category.icon}</span> {category.name}
            </span>
            <span className="breakdown-value">
              {formatMoney(total)} <small>{Math.round(share * 100)}%</small>
            </span>
            <span className="breakdown-track">
              <span className="breakdown-bar" style={{ width: `${(total / max) * 100}%` }} />
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
