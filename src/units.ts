import type { Goals } from './types'
import { round } from './utils'

type Unit = Goals['unit']

const LB_PER_KG = 2.20462
const CM_PER_INCH = 2.54

export const toDisplayWeight = (kg: number, unit: Unit): number =>
  round(unit === 'lb' ? kg * LB_PER_KG : kg)

export const fromDisplayWeight = (value: number, unit: Unit): number =>
  round(unit === 'lb' ? value / LB_PER_KG : value, 2)

export const toDisplayLength = (cm: number, unit: Unit): number =>
  round(unit === 'lb' ? cm / CM_PER_INCH : cm)

export const fromDisplayLength = (value: number, unit: Unit): number =>
  round(unit === 'lb' ? value * CM_PER_INCH : value, 2)
