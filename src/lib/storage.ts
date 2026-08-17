import type { Material, SavedCalculation } from '../types'
import { MATERIALS } from '../data/catalog'

const CALC_KEY = 'oporascet.calculations'
const MAT_KEY = 'oporascet.materials'

export function loadCalculations(): SavedCalculation[] {
  try {
    const raw = localStorage.getItem(CALC_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedCalculation[]
  } catch {
    return []
  }
}

export function saveCalculation(calc: SavedCalculation): void {
  const list = loadCalculations()
  localStorage.setItem(CALC_KEY, JSON.stringify([calc, ...list]))
}

export function deleteCalculation(id: string): void {
  const list = loadCalculations().filter((c) => c.id !== id)
  localStorage.setItem(CALC_KEY, JSON.stringify(list))
}

export function loadMaterials(): Material[] {
  try {
    const raw = localStorage.getItem(MAT_KEY)
    if (!raw) return structuredClone(MATERIALS)
    return JSON.parse(raw) as Material[]
  } catch {
    return structuredClone(MATERIALS)
  }
}

export function saveMaterials(materials: Material[]): void {
  localStorage.setItem(MAT_KEY, JSON.stringify(materials))
}

export function resetMaterials(): Material[] {
  const next = structuredClone(MATERIALS)
  saveMaterials(next)
  return next
}
