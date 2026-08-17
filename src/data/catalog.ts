import type { CatalogSupport, Material, LaborOp, BomItem, CoatingType, SlidePair } from '../types'

export const MATERIALS: Material[] = [
  {
    id: 'st3',
    name: 'Лист / прокат Ст3сп',
    grade: 'Ст3сп',
    unit: 'kg',
    price: 92,
    density: 7850,
    updatedAt: '2026-08-01',
  },
  {
    id: '09g2s',
    name: 'Лист 09Г2С',
    grade: '09Г2С',
    unit: 'kg',
    price: 118,
    density: 7850,
    updatedAt: '2026-08-01',
  },
  {
    id: 'ptfe',
    name: 'Вкладыш Фторопласт-4',
    grade: 'Ф-4',
    unit: 'pcs',
    price: 1450,
    updatedAt: '2026-07-15',
  },
  {
    id: 'graphite',
    name: 'Вкладыш графитовый',
    grade: 'ГС',
    unit: 'pcs',
    price: 980,
    updatedAt: '2026-07-15',
  },
  {
    id: 'bolt-m16',
    name: 'Болт М16 с гайкой и шайбой',
    grade: 'кл.8.8',
    unit: 'pcs',
    price: 42,
    updatedAt: '2026-08-01',
  },
  {
    id: 'primer',
    name: 'Грунт ГФ-021',
    grade: 'ГФ-021',
    unit: 'kg',
    price: 185,
    updatedAt: '2026-06-20',
  },
  {
    id: 'zinc',
    name: 'Горячее цинкование',
    grade: 'ISO 1461',
    unit: 'kg',
    price: 48,
    updatedAt: '2026-08-01',
  },
  {
    id: 'heat-paint',
    name: 'Термостойкая эмаль',
    grade: 'КО-8101',
    unit: 'kg',
    price: 620,
    updatedAt: '2026-06-20',
  },
]

export const CATALOG: CatalogSupport[] = [
  {
    id: 'ost-57',
    series: 'OST-34',
    name: 'Опора скользящая ОСТ 34-10-617-93',
    dn: 57,
    loadKn: 4.5,
    travelMm: 50,
    slidePair: 'steel-ptfe',
    massKg: 6.8,
    description: 'Для трубопроводов Ду50, корпус из листа, плита скольжения с Ф-4.',
  },
  {
    id: 'ost-89',
    series: 'OST-34',
    name: 'Опора скользящая ОСТ 34-10-617-93',
    dn: 89,
    loadKn: 8.2,
    travelMm: 80,
    slidePair: 'steel-ptfe',
    massKg: 12.4,
    description: 'Для трубопроводов Ду80, усиленная плита и антифрикционный вкладыш.',
  },
  {
    id: 'ost-159',
    series: 'OST-34',
    name: 'Опора скользящая ОСТ 34-10-617-93',
    dn: 159,
    loadKn: 18,
    travelMm: 100,
    slidePair: 'steel-ptfe',
    massKg: 28.5,
    description: 'Для трубопроводов Ду150, сварной корпус, комплект крепежа.',
  },
  {
    id: 'ost-219',
    series: 'OST-34',
    name: 'Опора скользящая ОСТ 34-10-617-93',
    dn: 219,
    loadKn: 32,
    travelMm: 120,
    slidePair: 'steel-steel',
    massKg: 46,
    description: 'Для трубопроводов Ду200, сталь–сталь, повышенная нагрузка.',
  },
  {
    id: 'tu-108',
    series: 'TU-36',
    name: 'Опора скользящая ТУ 36-44-15',
    dn: 108,
    loadKn: 12,
    travelMm: 90,
    slidePair: 'steel-ptfe',
    massKg: 16.2,
    description: 'Серия ТУ: компактный корпус, ход до 90 мм.',
  },
  {
    id: 'tu-273',
    series: 'TU-36',
    name: 'Опора скользящая ТУ 36-44-15',
    dn: 273,
    loadKn: 45,
    travelMm: 150,
    slidePair: 'graphite',
    massKg: 62,
    description: 'Для высоких температур: графитовый вкладыш, усиленная плита.',
  },
]

const LABOR_BASE: Omit<LaborOp, 'hours'>[] = [
  { id: 'cut', name: 'Заготовка / резка', rate: 850 },
  { id: 'machine', name: 'Механообработка', rate: 1100 },
  { id: 'weld', name: 'Сварка / сборка', rate: 980 },
  { id: 'coat', name: 'Покрытие / окраска', rate: 720 },
  { id: 'qc', name: 'Контроль качества', rate: 650 },
]

export function buildDefaultBom(support: CatalogSupport, slidePair: SlidePair): BomItem[] {
  const steelId = support.dn >= 159 ? '09g2s' : 'st3'
  const bodyMass = +(support.massKg * 0.72).toFixed(2)
  const plateMass = +(support.massKg * 0.18).toFixed(2)
  const insertId =
    slidePair === 'graphite' ? 'graphite' : slidePair === 'steel-ptfe' ? 'ptfe' : ''

  const items: BomItem[] = [
    {
      id: 'body',
      name: 'Корпус опоры',
      materialId: steelId,
      qty: bodyMass,
      unit: 'kg',
      wasteFactor: 1.08,
    },
    {
      id: 'plate',
      name: 'Плита скольжения',
      materialId: steelId,
      qty: plateMass,
      unit: 'kg',
      wasteFactor: 1.05,
    },
    {
      id: 'bolts',
      name: 'Крепёж М16',
      materialId: 'bolt-m16',
      qty: support.dn >= 159 ? 8 : 4,
      unit: 'pcs',
      wasteFactor: 1,
    },
  ]

  if (insertId) {
    items.splice(2, 0, {
      id: 'insert',
      name: slidePair === 'graphite' ? 'Вкладыш графитовый' : 'Вкладыш Ф-4',
      materialId: insertId,
      qty: 1,
      unit: 'pcs',
      wasteFactor: 1,
    })
  }

  return items
}

export function buildDefaultLabor(support: CatalogSupport, coating: CoatingType): LaborOp[] {
  const scale = Math.max(0.7, support.massKg / 20)
  return LABOR_BASE.map((op) => {
    let hours = 0.35 * scale
    if (op.id === 'cut') hours = 0.25 * scale
    if (op.id === 'machine') hours = 0.4 * scale
    if (op.id === 'weld') hours = 0.55 * scale
    if (op.id === 'coat') hours = coating === 'none' ? 0.05 : 0.3 * scale
    if (op.id === 'qc') hours = 0.15 * scale
    return { ...op, hours: +hours.toFixed(2) }
  })
}

export const COATING_LABELS: Record<CoatingType, string> = {
  none: 'Без покрытия',
  primer: 'Грунт ГФ-021',
  'hot-zinc': 'Горячее цинкование',
  'heat-paint': 'Термостойкая эмаль',
}

export const SLIDE_LABELS: Record<SlidePair, string> = {
  'steel-ptfe': 'Сталь — Фторопласт-4',
  'steel-steel': 'Сталь — Сталь',
  graphite: 'Сталь — Графит',
}

export const SERIES_LABELS: Record<string, string> = {
  'OST-34': 'ОСТ 34',
  'TU-36': 'ТУ 36',
}
