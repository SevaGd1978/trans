import type { Material, SavedCalculation } from '../types'
import { formatRub } from '../lib/calc'
import { deleteCalculation } from '../lib/storage'
import { exportCalculationToExcel } from '../lib/export'
import { COATING_LABELS } from '../data/catalog'

interface Props {
  items: SavedCalculation[]
  materials: Material[]
  onChange: () => void
  onRecalculate: (catalogId: string) => void
}

export function HistoryView({ items, materials, onChange, onRecalculate }: Props) {
  if (items.length === 0) {
    return (
      <section className="panel empty-state">
        <h2>История расчётов</h2>
        <p className="muted">Пока нет сохранённых калькуляций. Сделайте расчёт и нажмите «Сохранить».</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>История расчётов</h2>
          <p className="muted">Локальное хранение в браузере · можно выгрузить в Excel</p>
        </div>
      </div>
      <div className="history-list">
        {items.map((item) => (
          <article key={item.id} className="history-row">
            <div>
              <h3>{item.title}</h3>
              <p className="muted">
                {new Date(item.createdAt).toLocaleString('ru-RU')} ·{' '}
                {item.params.source === 'custom' ? 'Свои размеры · ' : ''}
                {COATING_LABELS[item.params.coating]}
              </p>
            </div>
            <p className="history-cost">{formatRub(item.breakdown.unitCost)} / шт</p>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  onRecalculate(
                    item.params.source === 'custom' ? 'custom' : item.params.catalogId,
                  )
                }
              >
                {item.params.source === 'custom' ? 'Свои размеры' : 'Открыть типоразмер'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => exportCalculationToExcel(item, materials)}
              >
                Excel
              </button>
              <button
                type="button"
                className="btn btn-ghost danger"
                onClick={() => {
                  deleteCalculation(item.id)
                  onChange()
                }}
              >
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
