import type { Material } from '../types'
import { formatRub } from '../lib/calc'
import { resetMaterials } from '../lib/storage'

interface Props {
  materials: Material[]
  onChange: (materials: Material[]) => void
}

export function MaterialsView({ materials, onChange }: Props) {
  const update = (id: string, price: number) => {
    onChange(
      materials.map((m) =>
        m.id === id
          ? { ...m, price, updatedAt: new Date().toISOString().slice(0, 10) }
          : m,
      ),
    )
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Справочник материалов</h2>
          <p className="muted">Цены используются в BOM и статье покрытия. Хранятся локально в браузере.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onChange(resetMaterials())}
        >
          Сбросить к демо-ценам
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Материал</th>
              <th>Марка</th>
              <th>Ед.</th>
              <th>Цена, ₽</th>
              <th>Обновлено</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.grade}</td>
                <td>{m.unit}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={m.price}
                    onChange={(e) => update(m.id, Math.max(0, Number(e.target.value) || 0))}
                  />
                </td>
                <td className="muted">
                  {m.updatedAt}
                  <span className="price-hint">{formatRub(m.price)}/{m.unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
