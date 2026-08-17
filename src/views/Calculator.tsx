import { useEffect, useMemo, useState } from 'react'
import type { BomItem, CalcParams, LaborOp, Material, SavedCalculation } from '../types'
import {
  CATALOG,
  COATING_LABELS,
  SLIDE_LABELS,
  buildDefaultBom,
  buildDefaultLabor,
} from '../data/catalog'
import { computeBreakdown, formatRub, formatRubExact, materialLineCost } from '../lib/calc'
import { saveCalculation } from '../lib/storage'
import { exportCalculationToExcel } from '../lib/export'

interface Props {
  materials: Material[]
  preselectId: string | null
  onSaved: () => void
  onOpenHistory: () => void
}

const STEPS = ['Параметры', 'BOM', 'Трудозатраты', 'Итог'] as const

export function Calculator({ materials, preselectId, onSaved, onOpenHistory }: Props) {
  const initial = CATALOG.find((c) => c.id === preselectId) ?? CATALOG[0]
  const [step, setStep] = useState(0)
  const [params, setParams] = useState<CalcParams>({
    catalogId: initial.id,
    quantity: 10,
    coating: 'primer',
    slidePair: initial.slidePair,
    overheadPct: 18,
    shopPct: 25,
    packingPerUnit: 120,
  })
  const [bom, setBom] = useState<BomItem[]>(() =>
    buildDefaultBom(initial, initial.slidePair),
  )
  const [labor, setLabor] = useState<LaborOp[]>(() =>
    buildDefaultLabor(initial, 'primer'),
  )
  const [savedFlash, setSavedFlash] = useState(false)

  const support = useMemo(
    () => CATALOG.find((c) => c.id === params.catalogId) ?? CATALOG[0],
    [params.catalogId],
  )

  useEffect(() => {
    if (!preselectId) return
    const found = CATALOG.find((c) => c.id === preselectId)
    if (!found) return
    setParams((p) => ({
      ...p,
      catalogId: found.id,
      slidePair: found.slidePair,
    }))
    setBom(buildDefaultBom(found, found.slidePair))
    setLabor(buildDefaultLabor(found, params.coating))
    setStep(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectId])

  const breakdown = useMemo(
    () => computeBreakdown(params, bom, labor, support.massKg, materials),
    [params, bom, labor, support.massKg, materials],
  )

  const applySupport = (catalogId: string) => {
    const next = CATALOG.find((c) => c.id === catalogId)
    if (!next) return
    setParams((p) => ({ ...p, catalogId, slidePair: next.slidePair }))
    setBom(buildDefaultBom(next, next.slidePair))
    setLabor(buildDefaultLabor(next, params.coating))
  }

  const applySlidePair = (slidePair: CalcParams['slidePair']) => {
    setParams((p) => ({ ...p, slidePair }))
    setBom(buildDefaultBom(support, slidePair))
  }

  const applyCoating = (coating: CalcParams['coating']) => {
    setParams((p) => ({ ...p, coating }))
    setLabor(buildDefaultLabor(support, coating))
  }

  const updateBom = (id: string, patch: Partial<BomItem>) => {
    setBom((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const updateLabor = (id: string, patch: Partial<LaborOp>) => {
    setLabor((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const persist = () => {
    const record: SavedCalculation = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: `${support.name} · Ду${support.dn} · ${params.quantity} шт`,
      params,
      bom,
      labor,
      breakdown,
      supportName: support.name,
      dn: support.dn,
    }
    saveCalculation(record)
    onSaved()
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2200)
  }

  const exportCurrent = () => {
    const record: SavedCalculation = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: `${support.name} · Ду${support.dn}`,
      params,
      bom,
      labor,
      breakdown,
      supportName: support.name,
      dn: support.dn,
    }
    exportCalculationToExcel(record, materials)
  }

  return (
    <section className="panel calc-panel">
      <div className="panel-head">
        <div>
          <h2>Калькулятор себестоимости</h2>
          <p className="muted">Мастер: параметры → BOM → трудозатраты → итог</p>
        </div>
        <div className="stepper" role="tablist" aria-label="Шаги расчёта">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={step === i}
              className={step === i ? 'step is-active' : step > i ? 'step is-done' : 'step'}
              onClick={() => setStep(i)}
            >
              <span className="step-num">{i + 1}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="form-grid">
          <label className="field">
            <span>Типоразмер из каталога</span>
            <select
              value={params.catalogId}
              onChange={(e) => applySupport(e.target.value)}
            >
              {CATALOG.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.series} · Ду{c.dn} · {c.massKg} кг · {c.loadKn} кН
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Количество, шт</span>
            <input
              type="number"
              min={1}
              value={params.quantity}
              onChange={(e) =>
                setParams((p) => ({ ...p, quantity: Math.max(1, Number(e.target.value) || 1) }))
              }
            />
          </label>
          <label className="field">
            <span>Пара скольжения</span>
            <select
              value={params.slidePair}
              onChange={(e) => applySlidePair(e.target.value as CalcParams['slidePair'])}
            >
              {Object.entries(SLIDE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Покрытие</span>
            <select
              value={params.coating}
              onChange={(e) => applyCoating(e.target.value as CalcParams['coating'])}
            >
              {Object.entries(COATING_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Цеховые, %</span>
            <input
              type="number"
              min={0}
              value={params.shopPct}
              onChange={(e) =>
                setParams((p) => ({ ...p, shopPct: Math.max(0, Number(e.target.value) || 0) }))
              }
            />
          </label>
          <label className="field">
            <span>Накладные, %</span>
            <input
              type="number"
              min={0}
              value={params.overheadPct}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  overheadPct: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
          </label>
          <label className="field">
            <span>Упаковка на 1 шт, ₽</span>
            <input
              type="number"
              min={0}
              value={params.packingPerUnit}
              onChange={(e) =>
                setParams((p) => ({
                  ...p,
                  packingPerUnit: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
          </label>
          <aside className="support-summary">
            <h3>{support.name}</h3>
            <p>{support.description}</p>
            <dl>
              <div>
                <dt>Dн</dt>
                <dd>{support.dn} мм</dd>
              </div>
              <div>
                <dt>Нагрузка</dt>
                <dd>{support.loadKn} кН</dd>
              </div>
              <div>
                <dt>Ход</dt>
                <dd>{support.travelMm} мм</dd>
              </div>
              <div>
                <dt>Масса</dt>
                <dd>{support.massKg} кг</dd>
              </div>
            </dl>
          </aside>
        </div>
      )}

      {step === 1 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Позиция</th>
                <th>Материал</th>
                <th>Кол-во</th>
                <th>Отход</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((item) => {
                const mat = materials.find((m) => m.id === item.materialId)
                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      <select
                        value={item.materialId}
                        onChange={(e) => updateBom(item.id, { materialId: e.target.value })}
                      >
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({formatRub(m.price)}/{m.unit})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.qty}
                        onChange={(e) =>
                          updateBom(item.id, { qty: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                      <span className="unit">{mat?.unit ?? item.unit}</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        step={0.01}
                        value={item.wasteFactor}
                        onChange={(e) =>
                          updateBom(item.id, {
                            wasteFactor: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                    </td>
                    <td className="num">{formatRubExact(materialLineCost(item, materials))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {step === 2 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Операция</th>
                <th>Норма, ч</th>
                <th>Тариф, ₽/ч</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {labor.map((op) => (
                <tr key={op.id}>
                  <td>{op.name}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={op.hours}
                      onChange={(e) =>
                        updateLabor(op.id, { hours: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={op.rate}
                      onChange={(e) =>
                        updateLabor(op.id, { rate: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  <td className="num">{formatRubExact(op.hours * op.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {step === 3 && (
        <div className="result-grid">
          <div className="result-main">
            <p className="result-label">Себестоимость единицы</p>
            <p className="result-value">{formatRub(breakdown.unitCost)}</p>
            <p className="result-sub">
              Партия {params.quantity} шт · {formatRub(breakdown.totalCost)}
            </p>
            <ul className="cost-list">
              <li>
                <span>Материалы</span>
                <strong>{formatRubExact(breakdown.materials)}</strong>
              </li>
              <li>
                <span>Трудозатраты</span>
                <strong>{formatRubExact(breakdown.labor)}</strong>
              </li>
              <li>
                <span>Покрытие</span>
                <strong>{formatRubExact(breakdown.coating)}</strong>
              </li>
              <li>
                <span>Упаковка</span>
                <strong>{formatRubExact(breakdown.packing)}</strong>
              </li>
              <li>
                <span>Цеховые ({params.shopPct}%)</span>
                <strong>{formatRubExact(breakdown.shop)}</strong>
              </li>
              <li>
                <span>Накладные ({params.overheadPct}%)</span>
                <strong>{formatRubExact(breakdown.overhead)}</strong>
              </li>
            </ul>
          </div>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={persist}>
              Сохранить расчёт
            </button>
            <button type="button" className="btn btn-secondary" onClick={exportCurrent}>
              Экспорт в Excel
            </button>
            <button type="button" className="btn btn-ghost" onClick={onOpenHistory}>
              Открыть историю
            </button>
            {savedFlash && <p className="flash">Расчёт сохранён в историю</p>}
            <p className="hint">
              Проверьте актуальность цен в справочнике материалов перед утверждением КП.
            </p>
          </div>
        </div>
      )}

      <div className="wizard-nav">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Назад
        </button>
        <div className="live-cost">
          Сейчас: <strong>{formatRub(breakdown.unitCost)}</strong> / шт
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
        >
          Далее
        </button>
      </div>
    </section>
  )
}
