export type SupportSeries = 'OST-34' | 'TU-36' | 'CUSTOM'

export type CoatingType = 'none' | 'primer' | 'hot-zinc' | 'heat-paint'
export type SlidePair = 'steel-ptfe' | 'steel-steel' | 'graphite'
export type SupportSource = 'catalog' | 'custom'
export type MassMode = 'manual' | 'geometry'

export interface Material {
  id: string
  name: string
  grade: string
  unit: 'kg' | 'pcs' | 'm'
  price: number
  density?: number
  updatedAt: string
}

export interface CatalogSupport {
  id: string
  series: SupportSeries
  name: string
  dn: number
  loadKn: number
  travelMm: number
  slidePair: SlidePair
  massKg: number
  description: string
}

/** Габариты и параметры опоры, заданной вручную */
export interface CustomSupportDims {
  name: string
  dn: number
  loadKn: number
  travelMm: number
  /** Итоговая масса опоры (для покрытия и трудозатрат) */
  massKg: number
  massMode: MassMode
  /** Масса корпуса, кг (режим geometry или ручной ввод) */
  bodyMassKg: number
  plateLengthMm: number
  plateWidthMm: number
  plateThicknessMm: number
  boltCount: number
}

export interface BomItem {
  id: string
  name: string
  materialId: string
  qty: number
  unit: 'kg' | 'pcs' | 'm'
  wasteFactor: number
  editable?: boolean
}

export interface LaborOp {
  id: string
  name: string
  hours: number
  rate: number
}

export interface CalcParams {
  source: SupportSource
  catalogId: string
  custom: CustomSupportDims
  quantity: number
  coating: CoatingType
  slidePair: SlidePair
  overheadPct: number
  shopPct: number
  packingPerUnit: number
}

export interface CostBreakdown {
  materials: number
  labor: number
  shop: number
  overhead: number
  coating: number
  packing: number
  unitCost: number
  totalCost: number
}

export interface SavedCalculation {
  id: string
  createdAt: string
  title: string
  params: CalcParams
  bom: BomItem[]
  labor: LaborOp[]
  breakdown: CostBreakdown
  supportName: string
  dn: number
}

export type AppView = 'home' | 'calculator' | 'catalog' | 'materials' | 'history'
