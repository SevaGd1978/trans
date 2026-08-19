import { useEffect, useMemo, useState } from 'react'
import type {
  BomItem,
  CalcParams,
  CustomSupportDims,
  LaborOp,
  Material,
  SavedCalculation,
  SupportSource,
} from '../types'
import {
  CATALOG,
  COATING_LABELS,
  SLIDE_LABELS,
  buildCustomBom,
  buildDefaultBom,
  buildDefaultLabor,
  customToSupport,
  defaultCustomDims,
  estimateFromDn,
  plateMassFromGeometry,
  resolveCustomMass,
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

function initialParams(preselectId: string | null): CalcParams {
  if (preselectId === 'custom') {
    const custom = defaultCustomDims(159)
    return {
      source: 'custom',
      catalogId: CATALOG[0].id,
      custom,
      quantity: 10,
      coating: 'primer',
      slidePair: estimateFromDn(159).slidePair,
      overheadPct: 18,
      shopPct: 25,
      packingPerUnit: 120,
    }
  }
  const initial = CATALOG.find((c) => c.id === preselectId) ?? CATALOG[0]
  return {
    source: 'catalog',
    catalogId: initial.id,
    custom: defaultCustomDims(initial.dn),
    quantity: 10,
    coating: 'primer',
    slidePair: initial.slidePair,
    overheadPct: 18,
    shopPct: 25,
    packingPerUnit: 120,
  }
}

export function Calculator({ materials, preselectId, onSaved, onOpenHistory }: Props) {
  const [step, setStep] = useState(0)
  const [params, setParams] = useState<CalcParams>(() => initialParams(preselectId))
  const [bom, setBom] = useState<BomItem[]>(() => {
    const p = initialParams(preselectId)
    if (p.source === 'custom') return buildCustomBom(p.custom, p.slidePair)
    const s = CATALOG.find((c) => c.id === p.catalogId) ?? CATALOG[0]
    return buildDefaultBom(s, p.slidePair)
  })
  const [labor, setLabor] = useState<LaborOp[]>(() => {
    const p = initialParams(preselectId)
    const support =
      p.source === 'custom'
        ? customToSupport(p.custom, p.slidePair)
        : (CATALOG.find((c) => c.id === p.catalogId) ?? CATALOG[0])
    return buildDefaultLabor(support, p.coating)
  })
  const [savedFlash, setSavedFlash] = useState(false)

  const support = useMemo(() => {
    if (params.source === 'custom') return customToSupport(params.custom, params.slidePair)
    return CATALOG.find((c) => c.id === params.catalogId) ?? CATALOG[0]
  }, [params])

  const plateMassPreview = plateMassFromGeometry(
    params.custom.plateLengthMm,
    params.custom.plateWidthMm,
    params.custom.plateThicknessMm,
  )

  useEffect(() => {
    if (!preselectId) return
    const next = initialParams(preselectId)
    setParams(next)
    if (next.source === 'custom') {
      setBom(buildCustomBom(next.custom, next.slidePair))
      setLabor(buildDefaultLabor(customToSupport(next.custom, next.slidePair), next.coating))
    } else {
      const found = CATALOG.find((c) => c.id === next.catalogId) ?? CATALOG[0]
      setBom(buildDefaultBom(found, found.slidePair))
      setLabor(buildDefaultLabor(found, next.coating))
    }
    setStep(0)
  }, [preselectId])

  const breakdown = useMemo(
    () => computeBreakdown(params, bom, labor, support.massKg, materials),
    [params, bom, labor, support.massKg, materials],
  )

  const rebuildFromCustom = (
    custom: CustomSupportDims,
    slidePair = params.slidePair,
    coating = params.coating,
  ) => {
    const resolved = { ...custom, massKg: resolveCustomMass(custom) }
    setParams((p) => ({ ...p, source: 'custom', custom: resolved, slidePair }))
    setBom(buildCustomBom(resolved, slidePair))
    setLabor(buildDefaultLabor(customToSupport(resolved, slidePair), coating))
  }

  const setSource = (source: SupportSource) => {
    if (source === 'custom') {
      if (params.source === 'custom') return
      const cat = CATALOG.find((c) => c.id === params.catalogId) ?? CATALOG[0]
      const est = estimateFromDn(cat.dn)
      const base: CustomSupportDims = {
        name: `${cat.name} (копия)`,
        dn: cat.dn,
        loadKn: cat.loadKn,
        travelMm: cat.travelMm,
        massKg: cat.massKg,
        massMode: 'geometry',
        bodyMassKg: +(cat.massKg * 0.72).toFixed(2),
        plateLengthMm: est.plateLengthMm,
        plateWidthMm: est.plateWidthMm,
        plateThicknessMm: est.plateThicknessMm,
        boltCount: est.boltCount,
      }
      rebuildFromCustom(base, cat.slidePair)
      return
    }
    const found = CATALOG.find((c) => c.id === params.catalogId) ?? CATALOG[0]
    setParams((p) => ({
      ...p,
      source: 'catalog',
      slidePair: found.slidePair,
    }))
    setBom(buildDefaultBom(found, found.slidePair))
    setLabor(buildDefaultLabor(found, params.coating))
  }

  const applySupport = (catalogId: string) => {
    const next = CATALOG.find((c) => c.id === catalogId)
    if (!next) return
    setParams((p) => ({
      ...p,
      source: 'catalog',
      catalogId,
      slidePair: next.slidePair,
      custom: { ...defaultCustomDims(next.dn), name: `${next.name} (копия)` },
    }))
    setBom(buildDefaultBom(next, next.slidePair))
    setLabor(buildDefaultLabor(next, params.coating))
  }

  const patchCustom = (patch: Partial<CustomSupportDims>, reestimate = false) => {
    let next: CustomSupportDims = { ...params.custom, ...patch }
    if (reestimate && patch.dn != null) {
      const est = estimateFromDn(patch.dn)
      next = {
        ...next,
        name: next.name.includes('Ду')
          ? `Опора скользящая Ду${patch.dn} (свои размеры)`
          : next.name,
        loadKn: est.loadKn,
        travelMm: est.travelMm,
        massKg: est.massKg,
        bodyMassKg: est.bodyMassKg,
        plateLengthMm: est.plateLengthMm,
        plateWidthMm: est.plateWidthMm,
        plateThicknessMm: est.plateThicknessMm,
        boltCount: est.boltCount,
      }
      rebuildFromCustom(next, est.slidePair)
      return
    }
    if (next.massMode === 'geometry') {
      next = { ...next, massKg: resolveCustomMass(next) }
    }
    rebuildFromCustom(next)
  }

  const applySlidePair = (slidePair: CalcParams['slidePair']) => {
    setParams((p) => ({ ...p, slidePair }))
    if (params.source === 'custom') {
      setBom(buildCustomBom(params.custom, slidePair))
    } else {
      setBom(buildDefaultBom(support, slidePair))
    }
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
          <p className="muted">Каталог или свои размеры → BOM → трудозатраты → итог</p>
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
          <div className="source-switch" role="group" aria-label="Источник опоры">
            <button
              type="button"
              className={params.source === 'catalog' ? 'source-btn is-active' : 'source-btn'}
              onClick={() => setSource('catalog')}
            >
              Из каталога
            </button>
            <button
              type="button"
              className={params.source === 'custom' ? 'source-btn is-active' : 'source-btn'}
              onClick={() => setSource('custom')}
            >
              Свои размеры
            </button>
          </div>

          {params.source === 'catalog' ? (
            <label className="field field-wide">
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
          ) : (
            <>
              <label className="field field-wide">
                <span>Наименование</span>
                <input
                  type="text"
                  value={params.custom.name}
                  onChange={(e) => patchCustom({ name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Dн / Ду, мм</span>
                <input
                  type="number"
                  min={20}
                  max={1200}
                  value={params.custom.dn}
                  onChange={(e) =>
                    patchCustom({ dn: Math.max(20, Number(e.target.value) || 20) }, true)
                  }
                />
              </label>
              <label className="field">
                <span>Нагрузка, кН</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={params.custom.loadKn}
                  onChange={(e) =>
                    patchCustom({ loadKn: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </label>
              <label className="field">
                <span>Ход скольжения, мм</span>
                <input
                  type="number"
                  min={0}
                  value={params.custom.travelMm}
                  onChange={(e) =>
                    patchCustom({ travelMm: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </label>
              <label className="field">
                <span>Крепёж, шт</span>
                <input
                  type="number"
                  min={0}
                  value={params.custom.boltCount}
                  onChange={(e) =>
                    patchCustom({ boltCount: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </label>

              <div className="mass-mode field-wide">
                <span className="mass-mode-label">Как задать массу / металл</span>
                <div className="source-switch compact">
                  <button
                    type="button"
                    className={
                      params.custom.massMode === 'geometry' ? 'source-btn is-active' : 'source-btn'
                    }
                    onClick={() => patchCustom({ massMode: 'geometry' })}
                  >
                    По габаритам плиты
                  </button>
                  <button
                    type="button"
                    className={
                      params.custom.massMode === 'manual' ? 'source-btn is-active' : 'source-btn'
                    }
                    onClick={() => patchCustom({ massMode: 'manual' })}
                  >
                    Масса вручную
                  </button>
                </div>
              </div>

              {params.custom.massMode === 'geometry' ? (
                <>
                  <label className="field">
                    <span>Плита: длина, мм</span>
                    <input
                      type="number"
                      min={1}
                      value={params.custom.plateLengthMm}
                      onChange={(e) =>
                        patchCustom({
                          plateLengthMm: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Плита: ширина, мм</span>
                    <input
                      type="number"
                      min={1}
                      value={params.custom.plateWidthMm}
                      onChange={(e) =>
                        patchCustom({
                          plateWidthMm: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Плита: толщина, мм</span>
                    <input
                      type="number"
                      min={1}
                      value={params.custom.plateThicknessMm}
                      onChange={(e) =>
                        patchCustom({
                          plateThicknessMm: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Масса корпуса, кг</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={params.custom.bodyMassKg}
                      onChange={(e) =>
                        patchCustom({
                          bodyMassKg: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </label>
                  <p className="geom-hint field-wide">
                    Плита ≈ {plateMassPreview} кг · итоговая масса ≈ {support.massKg} кг
                    (ρ = 7850 кг/м³)
                  </p>
                </>
              ) : (
                <label className="field">
                  <span>Масса опоры, кг</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={params.custom.massKg}
                    onChange={(e) =>
                      patchCustom({ massKg: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </label>
              )}
            </>
          )}

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
              Для своих размеров проверьте массу плиты и корпуса — они напрямую влияют на
              материалы и покрытие.
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
