import { CATALOG, SERIES_LABELS, SLIDE_LABELS } from '../data/catalog'

interface Props {
  onCalculate: (catalogId: string) => void
}

export function CatalogView({ onCalculate }: Props) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Каталог скользящих опор</h2>
          <p className="muted">Серии ОСТ 34 и ТУ 36 — типоразмеры для быстрого старта расчёта</p>
        </div>
      </div>
      <div className="catalog-list">
        {CATALOG.map((item) => (
          <article key={item.id} className="catalog-row">
            <div>
              <p className="eyebrow">{SERIES_LABELS[item.series]} · Ду{item.dn}</p>
              <h3>{item.name}</h3>
              <p className="muted">{item.description}</p>
            </div>
            <dl className="meta">
              <div>
                <dt>Нагрузка</dt>
                <dd>{item.loadKn} кН</dd>
              </div>
              <div>
                <dt>Ход</dt>
                <dd>{item.travelMm} мм</dd>
              </div>
              <div>
                <dt>Масса</dt>
                <dd>{item.massKg} кг</dd>
              </div>
              <div>
                <dt>Пара</dt>
                <dd>{SLIDE_LABELS[item.slidePair]}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onCalculate(item.id)}
            >
              В калькулятор
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
