import type {
  BomItem,
  CalcParams,
  CoatingType,
  CostBreakdown,
  LaborOp,
  Material,
} from '../types'
import { MATERIALS } from '../data/catalog'

function materialById(id: string, materials: Material[]): Material | undefined {
  return materials.find((m) => m.id === id)
}

export function materialLineCost(
  item: BomItem,
  materials: Material[] = MATERIALS,
): number {
  const mat = materialById(item.materialId, materials)
  if (!mat) return 0
  return item.qty * item.wasteFactor * mat.price
}

export function coatingCost(
  coating: CoatingType,
  massKg: number,
  materials: Material[] = MATERIALS,
): number {
  if (coating === 'none') return 0
  const map: Record<Exclude<CoatingType, 'none'>, { materialId: string; factor: number }> = {
    primer: { materialId: 'primer', factor: 0.04 },
    'hot-zinc': { materialId: 'zinc', factor: 1 },
    'heat-paint': { materialId: 'heat-paint', factor: 0.035 },
  }
  const cfg = map[coating]
  const mat = materialById(cfg.materialId, materials)
  if (!mat) return 0
  return massKg * cfg.factor * mat.price
}

export function computeBreakdown(
  params: CalcParams,
  bom: BomItem[],
  labor: LaborOp[],
  supportMassKg: number,
  materials: Material[] = MATERIALS,
): CostBreakdown {
  const materialsCost = bom.reduce((sum, item) => sum + materialLineCost(item, materials), 0)
  const laborCost = labor.reduce((sum, op) => sum + op.hours * op.rate, 0)
  const coating = coatingCost(params.coating, supportMassKg, materials)
  const packing = params.packingPerUnit
  const production = materialsCost + laborCost + coating + packing
  const shop = production * (params.shopPct / 100)
  const overhead = (production + shop) * (params.overheadPct / 100)
  const unitCost = production + shop + overhead
  const totalCost = unitCost * params.quantity

  return {
    materials: round2(materialsCost),
    labor: round2(laborCost),
    shop: round2(shop),
    overhead: round2(overhead),
    coating: round2(coating),
    packing: round2(packing),
    unitCost: round2(unitCost),
    totalCost: round2(totalCost),
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function formatRub(n: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatRubExact(n: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}
