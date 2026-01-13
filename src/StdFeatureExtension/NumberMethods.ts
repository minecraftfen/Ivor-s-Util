export function randomRounding(value: number): number {
  const floor = Math.floor(value);
  const chance = value - floor;
  const random = Math.random();
  if (random <= chance) {
    return Math.ceil(value);
  } else {
    return floor;
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export enum RoundingMethod {
  floor = "floor",
  ceil = "ceil",
  round = "round",
  random = "random",
  none = 'none'
}

export const RoundingFunctions: { [K in RoundingMethod]: (value: number) => number } = Object.freeze({
  floor: (value: number) => Math.floor(value),
  ceil: (value: number) => Math.ceil(value),
  round: (value: number) => Math.round(value),
  random: randomRounding,
  none: (value: number) => value,
});
