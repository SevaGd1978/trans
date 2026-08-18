import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import type { BomItem, CostBreakdown, Material, SavedCalculation } from '../types'
import { materialLineCost, formatRubExact } from './calc'
import { COATING_LABELS, SLIDE_LABELS } from '../data/catalog'

export function exportCalculationToExcel(
  calc: SavedCalculation,
  materials: Material[],
): void {
  const wb = XLSX.utils.book_new()

  const custom = calc.params.custom
  const summary = [
    ['ОпораСчёт — калькуляция себестоимости'],
    ['Название', calc.title],
    ['Опора', calc.supportName],
    ['Источник', calc.params.source === 'custom' ? 'Свои размеры' : 'Каталог'],
    ['Ду / Dн', calc.dn],
    ['Дата', new Date(calc.createdAt).toLocaleString('ru-RU')],
    ['Количество, шт', calc.params.quantity],
    ['Пара скольжения', SLIDE_LABELS[calc.params.slidePair]],
    ['Покрытие', COATING_LABELS[calc.params.coating]],
    ['Цеховые, %', calc.params.shopPct],
    ['Накладные, %', calc.params.overheadPct],
    ...(calc.params.source === 'custom' && custom
      ? [
          ['Нагрузка, кН', custom.loadKn],
          ['Ход, мм', custom.travelMm],
          ['Масса, кг', custom.massKg],
          [
            'Плита, мм',
            `${custom.plateLengthMm}×${custom.plateWidthMm}×${custom.plateThicknessMm}`,
          ],
          ['Масса корпуса, кг', custom.bodyMassKg],
        ]
      : []),
    [],
    ['Статья', 'Сумма, руб'],
    ...breakdownRows(calc.breakdown),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Итог')

  const bomRows = [
    ['Позиция', 'Материал', 'Кол-во', 'Ед.', 'Отход', 'Сумма, руб'],
    ...calc.bom.map((item) => bomRow(item, materials)),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bomRows), 'BOM')

  const laborRows = [
    ['Операция', 'Часы', 'Тариф, руб/ч', 'Сумма, руб'],
    ...calc.labor.map((op) => [
      op.name,
      op.hours,
      op.rate,
      +(op.hours * op.rate).toFixed(2),
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(laborRows), 'Трудозатраты')

  const name = `oporascet-${calc.dn}-${calc.id.slice(0, 6)}.xlsx`
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), name)
}

function breakdownRows(b: CostBreakdown): (string | number)[][] {
  return [
    ['Материалы', b.materials],
    ['Трудозатраты', b.labor],
    ['Покрытие', b.coating],
    ['Упаковка', b.packing],
    ['Цеховые', b.shop],
    ['Накладные', b.overhead],
    ['Себестоимость единицы', b.unitCost],
    ['Итого по партии', b.totalCost],
    ['Проверка', formatRubExact(b.totalCost)],
  ]
}

function bomRow(item: BomItem, materials: Material[]): (string | number)[] {
  const mat = materials.find((m) => m.id === item.materialId)
  return [
    item.name,
    mat?.name ?? item.materialId,
    item.qty,
    item.unit,
    item.wasteFactor,
    +materialLineCost(item, materials).toFixed(2),
  ]
}
