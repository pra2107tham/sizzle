/**
 * Spring-mass-damper physics — exact analytical solutions.
 *
 * This is the core physics engine. A damped harmonic oscillator is defined by
 * three parameters:
 *
 *   - **tension** (spring stiffness k): how strongly the spring pulls toward target
 *   - **mass** (m): inertia — higher mass = slower response, more overshoot
 *   - **friction** (damping c): energy dissipation — higher = less oscillation
 *
 * The natural frequency is ω₀ = √(k/m).
 * The damping ratio is ζ = c / (2√(km)).
 *
 * Three regimes:
 *   - **Underdamped** (ζ < 1): oscillates around target, decaying exponentially
 *   - **Critically damped** (ζ ≈ 1): fastest approach without oscillation
 *   - **Overdamped** (ζ > 1): slow, exponential approach without oscillation
 *
 * All solutions are closed-form (no Euler/RK4 integration), so they're stable
 * at any timestep and produce identical results regardless of frame rate.
 *
 * Ported from Cap (https://github.com/CapSoftware/Cap).
 */

import type { SpringConfig } from './types.js'

const CRITICAL_EPSILON = 0.01
const REST_VELOCITY_THRESHOLD = 0.0001
const REST_DISPLACEMENT_THRESHOLD = 0.00001

/**
 * Exact analytical solution for a 1D spring-mass-damper ODE.
 *
 * Given initial displacement and velocity from the target, returns
 * [newDisplacement, newVelocity] after `t` seconds.
 */
export function solveSpring1d(
  displacement: number,
  velocity: number,
  t: number,
  omega0: number,
  zeta: number,
): [number, number] {
  if (zeta < 1 - CRITICAL_EPSILON) {
    // Underdamped: oscillatory decay
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega0 * t)
    const cosT = Math.cos(omegaD * t)
    const sinT = Math.sin(omegaD * t)
    const a = displacement
    const b = (velocity + displacement * zeta * omega0) / Math.max(omegaD, 1e-4)
    const newDisp = decay * (a * cosT + b * sinT)
    const newVel =
      decay *
      ((b * omegaD - a * zeta * omega0) * cosT - (a * omegaD + b * zeta * omega0) * sinT)
    return [newDisp, newVel]
  }

  if (zeta > 1 + CRITICAL_EPSILON) {
    // Overdamped: two real exponential roots
    const sq = Math.sqrt(zeta * zeta - 1)
    const s1 = -omega0 * (zeta - sq)
    const s2 = -omega0 * (zeta + sq)
    const denom = s1 - s2
    if (Math.abs(denom) < 1e-10) {
      const sAvg = 0.5 * (s1 + s2)
      const decay = Math.exp(sAvg * t)
      const newDisp = decay * (displacement + (velocity - displacement * sAvg) * t)
      const newVel =
        decay * ((velocity - displacement * sAvg) + sAvg * (displacement + (velocity - displacement * sAvg) * t))
      return [newDisp, newVel]
    }
    const c1 = (velocity - displacement * s2) / denom
    const c2 = displacement - c1
    const e1 = Math.exp(s1 * t)
    const e2 = Math.exp(s2 * t)
    return [c1 * e1 + c2 * e2, c1 * s1 * e1 + c2 * s2 * e2]
  }

  // Critically damped: fastest non-oscillatory settling
  const decay = Math.exp(-omega0 * t)
  const a = displacement
  const b = velocity + displacement * omega0
  return [decay * (a + b * t), decay * (b - omega0 * (a + b * t))]
}

/** Internal 2D spring state. */
export interface SpringState2D {
  posU: number
  posV: number
  velU: number
  velV: number
  targetU: number
  targetV: number
}

/**
 * Step a 2D spring simulation forward by `dtMs` milliseconds.
 * Mutates `state` in-place. Snaps to rest when displacement and velocity
 * drop below threshold.
 */
export function stepSpring2D(state: SpringState2D, dtMs: number, config: SpringConfig): void {
  if (dtMs <= 0) return

  const t = dtMs / 1000
  const mass = Math.max(config.mass, 0.001)
  const omega0 = Math.sqrt(config.tension / mass)
  const zeta = config.friction / (2 * Math.sqrt(config.tension * mass))

  const [ndU, nvU] = solveSpring1d(state.posU - state.targetU, state.velU, t, omega0, zeta)
  const [ndV, nvV] = solveSpring1d(state.posV - state.targetV, state.velV, t, omega0, zeta)

  state.posU = state.targetU + ndU
  state.posV = state.targetV + ndV
  state.velU = nvU
  state.velV = nvV

  // Snap to rest
  const dispMag = Math.sqrt(ndU * ndU + ndV * ndV)
  const velMag = Math.sqrt(nvU * nvU + nvV * nvV)
  if (dispMag < REST_DISPLACEMENT_THRESHOLD && velMag < REST_VELOCITY_THRESHOLD) {
    state.posU = state.targetU
    state.posV = state.targetV
    state.velU = 0
    state.velV = 0
  }
}
