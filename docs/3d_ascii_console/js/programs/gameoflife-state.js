export function createGameOfLifeState() {
  return {
    cols: 0,
    rows: 0,
    cells: [],
    cursorX: 0,
    cursorY: 0,
    running: false,
    generation: 0,
    population: 0,
    lastStepAt: 0,
    stepIntervalMs: 280,
    viewport: null,
    pointerAction: null
  };
}
