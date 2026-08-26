import {
  compileNativeNaturalSpline,
  evaluateNativeNaturalSpline,
} from '../native-natural-spline.ts'
import { actorHeadingFromVector, actorHeadingIndex } from './actor-heading.ts'
import type { Vector2 } from './vector.ts'

export const NATIVE_COLLEGE_COURTYARD_PATH = Object.freeze([
  { x: 972, y: 1_044 },
  { x: 1_074, y: 839 },
  { x: 1_119, y: 611 },
  { x: 1_167, y: 441 },
  { x: 1_164, y: 275 },
  { x: 1_095, y: 187 },
  { x: 1_017, y: 193 },
  { x: 963, y: 178 },
  { x: 956, y: 105 },
  { x: 957, y: 27 },
] as const)

export const NATIVE_COLLEGE_OFFICE_PATH = Object.freeze([
  { x: 400, y: 773 },
  { x: 380, y: 722 },
  { x: 263, y: 636 },
  { x: 289, y: 509 },
  { x: 396, y: 471 },
  { x: 420, y: 445 },
  { x: 420, y: 415 },
] as const)

export const NATIVE_COLLEGE_TITLE_ALPHA_PATH = Object.freeze([
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
] as const)

export const NATIVE_COLLEGE_PATH_CURSOR_STEP = 0.25
export const NATIVE_COLLEGE_PATH_TARGET_DISTANCE_SQUARED = 100
export const NATIVE_COLLEGE_TITLE_CURSOR_STEP = 0.005200000014156103
export const NATIVE_COLLEGE_TITLE_SWITCH_CURSOR = 4
export const NATIVE_COLLEGE_COVER_FADE_RATE = Math.fround(0.0005)
export const NATIVE_COLLEGE_OFFICE_SPEED_DECAY = Math.fround(0.99000001)
export const NATIVE_COLLEGE_OFFICE_MIN_SPEED = Math.fround(0.5)
export const NATIVE_COLLEGE_OFFICE_PATH_OFFSET = 102.5
export const NATIVE_COLLEGE_CONTACT_INCREMENT = 2
export const NATIVE_COLLEGE_CONTACT_THRESHOLD = 10

export type NativeCollegeIntroPhase =
  | 'courtyard-walk'
  | 'office-walk'
  | 'arch-dialogue'

export interface NativeCollegeIntroState {
  readonly contactCounter: number
  readonly coverAlpha: number
  readonly dialogueSequence: number
  readonly officeSpeed: number
  readonly pathCursor: number
  readonly phase: NativeCollegeIntroPhase
  readonly titleCursor: number
}

export interface NativeCollegeTitlePresentation {
  readonly alpha: number
  readonly record: 7 | 9
  readonly y: 250 | 450
}

const COURTYARD_SPLINE = compileNativeNaturalSpline(NATIVE_COLLEGE_COURTYARD_PATH)
const OFFICE_SPLINE = compileNativeNaturalSpline(NATIVE_COLLEGE_OFFICE_PATH)
const TITLE_ALPHA_SPLINE = compileNativeNaturalSpline(NATIVE_COLLEGE_TITLE_ALPHA_PATH)

export function createNativeCollegeIntroState(): NativeCollegeIntroState {
  return Object.freeze({
    contactCounter: 0,
    coverAlpha: 1,
    dialogueSequence: 0,
    officeSpeed: 1,
    pathCursor: 0,
    phase: 'courtyard-walk',
    titleCursor: 0,
  })
}

export function nativeCollegePathTarget(
  phase: Extract<NativeCollegeIntroPhase, 'courtyard-walk' | 'office-walk'>,
  sourceCursor: number,
  position: Readonly<Vector2>,
): Readonly<{ pathCursor: number; target: Vector2 }> {
  const spline = phase === 'courtyard-walk' ? COURTYARD_SPLINE : OFFICE_SPLINE
  let pathCursor = phase === 'courtyard-walk'
    ? Math.max(1, sourceCursor)
    : Math.max(0, sourceCursor)
  pathCursor = Math.min(spline.extent, pathCursor)
  let target = nativeCollegeSplineTarget(phase, spline, pathCursor)
  while (
    pathCursor < spline.extent
    && squaredDistance(position, target) < NATIVE_COLLEGE_PATH_TARGET_DISTANCE_SQUARED
  ) {
    pathCursor = Math.min(spline.extent, pathCursor + NATIVE_COLLEGE_PATH_CURSOR_STEP)
    target = nativeCollegeSplineTarget(phase, spline, pathCursor)
  }
  return Object.freeze({ pathCursor, target })
}

export function nativeCollegePathHeadingIndex(
  phase: Extract<NativeCollegeIntroPhase, 'courtyard-walk' | 'office-walk'>,
  sourceCursor: number,
  position: Readonly<Vector2>,
): number {
  const { target } = nativeCollegePathTarget(phase, sourceCursor, position)
  return actorHeadingIndex(actorHeadingFromVector(
    target.x - position.x,
    target.y - position.y,
  ))
}

function nativeCollegeSplineTarget(
  phase: Extract<NativeCollegeIntroPhase, 'courtyard-walk' | 'office-walk'>,
  spline: typeof COURTYARD_SPLINE,
  cursor: number,
): Vector2 {
  const target = evaluateNativeNaturalSpline(spline, cursor)
  return phase === 'office-walk'
    ? {
        x: target.x + NATIVE_COLLEGE_OFFICE_PATH_OFFSET,
        y: target.y + NATIVE_COLLEGE_OFFICE_PATH_OFFSET,
      }
    : target
}

export function stepNativeCollegeTitle(
  state: NativeCollegeIntroState,
): NativeCollegeIntroState {
  if (state.phase !== 'courtyard-walk') return state
  return Object.freeze({
    ...state,
    coverAlpha: Math.max(0, Math.fround(state.coverAlpha - NATIVE_COLLEGE_COVER_FADE_RATE)),
    titleCursor: Math.min(
      TITLE_ALPHA_SPLINE.extent,
      state.titleCursor + NATIVE_COLLEGE_TITLE_CURSOR_STEP,
    ),
  })
}

export function nativeCollegeTitlePresentation(
  titleCursor: number,
  coverAlpha: number,
): NativeCollegeTitlePresentation {
  const alpha = clampUnit(evaluateNativeNaturalSpline(TITLE_ALPHA_SPLINE, titleCursor).x)
  return titleCursor <= NATIVE_COLLEGE_TITLE_SWITCH_CURSOR
    ? Object.freeze({ alpha, record: 7, y: 250 })
    : Object.freeze({
        alpha: clampUnit((1 - clampUnit(coverAlpha)) * alpha),
        record: 9,
        y: 450,
      })
}

export function nativeCollegeOfficeSpeed(pathCursor: number, currentSpeed: number): number {
  if (pathCursor <= NATIVE_COLLEGE_TITLE_SWITCH_CURSOR) return 1
  if (currentSpeed <= NATIVE_COLLEGE_OFFICE_MIN_SPEED) return currentSpeed
  return Math.fround(currentSpeed * NATIVE_COLLEGE_OFFICE_SPEED_DECAY)
}

export function nativeCollegeContactStep(
  counter: number,
  eligible: boolean,
): Readonly<{ activate: boolean; counter: number }> {
  if (!eligible) return Object.freeze({ activate: false, counter: 0 })
  const next = counter + NATIVE_COLLEGE_CONTACT_INCREMENT
  return next > NATIVE_COLLEGE_CONTACT_THRESHOLD
    ? Object.freeze({ activate: true, counter: 0 })
    : Object.freeze({ activate: false, counter: next })
}

export function enterNativeCollegeOffice(
  state: NativeCollegeIntroState,
): NativeCollegeIntroState {
  return Object.freeze({
    ...state,
    contactCounter: 0,
    officeSpeed: 1,
    pathCursor: 0,
    phase: 'office-walk',
  })
}

export function enterNativeCollegeDialogue(
  state: NativeCollegeIntroState,
): NativeCollegeIntroState {
  return Object.freeze({
    ...state,
    contactCounter: 0,
    dialogueSequence: state.dialogueSequence + 1,
    phase: 'arch-dialogue',
  })
}

function squaredDistance(left: Readonly<Vector2>, right: Readonly<Vector2>): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}
