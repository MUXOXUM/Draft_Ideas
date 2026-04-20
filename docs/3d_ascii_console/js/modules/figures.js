function createRangeSlider(id, label, min, max, step, value) {
  return { id, label, min, max, step, value };
}

function createLightingSliders(ambient) {
  return [
    createRangeSlider("light_yaw", "l_yaw", 0, 360, 5, 40),
    createRangeSlider("light_pitch", "l_pit", -90, 90, 5, 40),
    createRangeSlider("ambient", "amb", 0.0, 0.8, 0.05, ambient)
  ];
}

function createFigureDefinition(id, label, sliders) {
  return { id, label, sliders };
}

export const figures = [
  createFigureDefinition("sphere", "SPHERE", [
    createRangeSlider("size", "size", 0.5, 5.0, 0.1, 2.5),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.25),
    createRangeSlider("resolution", "res", 0.3, 1.0, 0.1, 0.8),
    ...createLightingSliders(0.2)
  ]),
  createFigureDefinition("torus", "TORUS", [
    createRangeSlider("size", "size", 0.5, 2.5, 0.1, 1.6),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.3, 1.0, 0.1, 0.7),
    ...createLightingSliders(0.15)
  ]),
  createFigureDefinition("cube", "CUBE", [
    createRangeSlider("size", "size", 0.5, 3.0, 0.1, 1.8),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.2, 1.0, 0.1, 1.0),
    ...createLightingSliders(0.15)
  ]),
  createFigureDefinition("octahedron", "OCTAHEDRON", [
    createRangeSlider("size", "size", 0.5, 5.0, 0.1, 3.2),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.2, 1.0, 0.1, 1.0),
    ...createLightingSliders(0.15)
  ]),
  createFigureDefinition("icosahedron", "ICOSAHEDRON", [
    createRangeSlider("size", "size", 0.5, 5.0, 0.1, 3.0),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.2, 1.0, 0.1, 1.0),
    ...createLightingSliders(0.14)
  ]),
  createFigureDefinition("star_polyhedron", "STAR POLY", [
    createRangeSlider("size", "size", 0.5, 3.0, 0.1, 2.0),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.3),
    createRangeSlider("resolution", "res", 0.2, 1.0, 0.1, 1.0),
    ...createLightingSliders(0.12)
  ]),
  createFigureDefinition("mobius_strip", "MOBIUS STRIP", [
    createRangeSlider("size", "size", 0.5, 4.0, 0.1, 2.3),
    createRangeSlider("speed", "speed", 0.0, 2.0, 0.1, 0.35),
    createRangeSlider("resolution", "res", 0.3, 1.0, 0.1, 0.9),
    ...createLightingSliders(0.18)
  ])
];
