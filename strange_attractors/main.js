const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const labelTitle = document.querySelector(".attractor-label__title");
const labelHint = document.querySelector(".attractor-label__hint");
const cameraModePanel = document.querySelector(".camera-mode-panel");
const cameraModeValues = document.querySelector(".camera-mode-panel__values");

const PARTICLE_COUNT = 1400;
const SUBSTEPS = 4;
const BASE_SCALE = 15.5;
const TRAIL_FADE = 0.16;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 4;
const ZOOM_SENSITIVITY = 0.0012;
const PAN_SENSITIVITY = 1;
const BACKGROUND_COLOR = "#101010";
const IDENTITY_MATRIX_3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function createDelayBuffer(length, value) {
  return Array.from({ length }, () => value);
}

function createParticleVisuals() {
  return {
    alpha: randomRange(0.18, 0.95),
    size: randomRange(0.7, 2.2)
  };
}

function createSphericalParticle({
  minRadius,
  radiusRange,
  radiusBiasPower,
  zJitter
}) {
  const distanceBias = Math.random() ** radiusBiasPower;
  const radius = minRadius + distanceBias * radiusRange;
  const theta = randomRange(0, Math.PI * 2);
  const phi = Math.acos(randomRange(-1, 1));

  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.sin(phi) * Math.sin(theta),
    z: radius * Math.cos(phi) + randomRange(-zJitter, zJitter),
    ...createParticleVisuals()
  };
}

const attractors = [
  {
    name: "Lorenz Attractor",
    dt: 0.0025,
    escapeRadius: 180,
    camera: {
      matrix: [
        [0.991035, 0, 0.133599],
        [-0.039098, 0.956219, 0.290029],
        [-0.12775, -0.292653, 0.947647]
      ]
    },
    view: {
      offsetX: -61,
      offsetY: -45,
      scale: 0.854
    },
    createParticle() {
      return createSphericalParticle({
        minRadius: 24,
        radiusRange: 66,
        radiusBiasPower: 0.55,
        zJitter: 18
      });
    },
    derivative(x, y, z) {
      const sigma = 10;
      const rho = 28;
      const beta = 8 / 3;

      return {
        dx: sigma * (y - x),
        dy: x * (rho - z) - y,
        dz: x * y - beta * z
      };
    },
    referencePoints: [
      { x: -18, y: -22, z: 10 },
      { x: -18, y: 22, z: 10 },
      { x: 18, y: -22, z: 10 },
      { x: 18, y: 22, z: 10 },
      { x: 0, y: 0, z: 40 },
      { x: 0, y: 0, z: -2 },
      { x: -10, y: 0, z: 20 },
      { x: 10, y: 0, z: 20 }
    ]
  },
  {
    name: "Rossler Attractor",
    dt: 0.01,
    escapeRadius: 120,
    camera: {
      matrix: [
        [0.210527, -0.976222, 0.051656],
        [-0.40336, -0.134876, -0.905046],
        [0.890494, 0.169701, -0.422164]
      ]
    },
    view: {
      offsetX: -100,
      offsetY: 38,
      scale: 1.172
    },
    createParticle() {
      const angle = randomRange(0, Math.PI * 2);
      const radius = randomRange(2, 18);

      return {
        x: Math.cos(angle) * radius + randomRange(-3, 3),
        y: Math.sin(angle) * radius + randomRange(-3, 3),
        z: randomRange(0, 24),
        alpha: randomRange(0.18, 0.95),
        size: randomRange(0.7, 2.2)
      };
    },
    derivative(x, y, z) {
      const a = 0.2;
      const b = 0.2;
      const c = 5.7;

      return {
        dx: -y - z,
        dy: x + a * y,
        dz: b + z * (x - c)
      };
    },
    referencePoints: [
      { x: -14, y: -18, z: 0 },
      { x: -14, y: 18, z: 0 },
      { x: 14, y: -18, z: 0 },
      { x: 14, y: 18, z: 0 },
      { x: 0, y: 0, z: 28 },
      { x: 8, y: 0, z: 12 },
      { x: -8, y: 0, z: 12 }
    ]
  },
  {
    name: "Modified Lu-Chen attractor",
    dt: 0.002,
    escapeRadius: 220,
    camera: {
      matrix: [
        [-0.643825, -0.765091, 0.011151],
        [0.114938, -0.111108, -0.987139],
        [0.756491, -0.634264, 0.159473]
      ]
    },
    view: {
      offsetX: -24,
      offsetY: 79,
      scale: 0.656
    },
    createParticle() {
      const particle = createSphericalParticle({
        minRadius: 18,
        radiusRange: 54,
        radiusBiasPower: 0.6,
        zJitter: 12
      });
      const delayLength = 100;

      return {
        ...particle,
        delayedZ: particle.z,
        zHistory: createDelayBuffer(delayLength, particle.z),
        zHistoryIndex: 0
      };
    },
    derivative(x, y, z, point) {
      const a = 35;
      const b = 3;
      const c = 28;
      const d0 = 1;
      const d1 = 1;
      const d2 = 0;
      const delayedZ = point.delayedZ ?? z;
      const f = d0 * z + d1 * delayedZ - d2 * Math.sin(delayedZ);

      return {
        dx: a * (y - x),
        dy: (c - a) * x - x * f + c * y,
        dz: x * y - b * z
      };
    },
    beforeStep(point) {
      point.delayedZ = point.zHistory[point.zHistoryIndex];
    },
    afterStep(point) {
      point.zHistory[point.zHistoryIndex] = point.z;
      point.zHistoryIndex = (point.zHistoryIndex + 1) % point.zHistory.length;
      point.delayedZ = point.zHistory[point.zHistoryIndex];
    },
    referencePoints: [
      { x: -28, y: -32, z: 0 },
      { x: -28, y: 32, z: 0 },
      { x: 28, y: -32, z: 0 },
      { x: 28, y: 32, z: 0 },
      { x: 0, y: 0, z: 55 },
      { x: 0, y: 0, z: -8 },
      { x: -16, y: 0, z: 24 },
      { x: 16, y: 0, z: 24 }
    ]
  }
];

let width = 0;
let height = 0;
let dpr = 1;
let centerX = 0;
let centerY = 0;
let scale = BASE_SCALE;
let attractorOffsetX = 0;
let attractorOffsetY = 0;
let currentAttractorIndex = 0;

const particles = [];
const cameraModeState = {
  enabled: false,
  matrixOverride: null,
  pointerId: null,
  dragMode: null,
  dragging: false,
  startVector: null,
  startMatrix: null,
  startClientX: 0,
  startClientY: 0,
  offsetX: 0,
  offsetY: 0,
  startOffsetX: 0,
  startOffsetY: 0,
  viewScale: 1
};

function getCurrentAttractor() {
  return attractors[currentAttractorIndex];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function syncCameraModePanel() {
  document.body.classList.toggle("camera-mode", cameraModeState.enabled);
  document.body.classList.toggle("is-dragging", cameraModeState.dragging);

  if (!cameraModeState.enabled) {
    cameraModePanel.classList.remove("is-visible");
    cameraModePanel.setAttribute("aria-hidden", "true");
    labelHint.textContent = "← → or A/D";
    return;
  }

  const activeView = getActiveView();

  cameraModePanel.classList.add("is-visible");
  cameraModePanel.setAttribute("aria-hidden", "false");
  labelHint.textContent = "← → or A/D | C: camera mode";
  cameraModeValues.textContent =
    `offsetX ${Number(activeView.offsetX.toFixed(2))}, ` +
    `offsetY ${Number(activeView.offsetY.toFixed(2))}, ` +
    `scale ${Number(activeView.scale.toFixed(3))}`;
}

function setCameraModeEnabled(enabled) {
  cameraModeState.enabled = enabled;

  if (!enabled) {
    stopCameraDrag();
  }

  syncCameraModePanel();
}

function resetCameraModeOffsets() {
  const { camera, view } = getCurrentAttractor();
  const cameraPreset = getCameraPreset(camera);
  const viewPreset = getViewPreset(view);

  cameraModeState.matrixOverride = cameraPreset.matrix;
  cameraModeState.offsetX = viewPreset.offsetX;
  cameraModeState.offsetY = viewPreset.offsetY;
  cameraModeState.viewScale = clamp(viewPreset.scale, MIN_ZOOM, MAX_ZOOM);
  syncCameraModePanel();
}

function getCameraMatrix(camera) {
  if (camera.matrix) {
    return camera.matrix.map((row) => row.slice());
  }

  return IDENTITY_MATRIX_3.map((row) => row.slice());
}

function getCameraPreset(camera) {
  return {
    matrix: getCameraMatrix(camera)
  };
}

function getViewPreset(view) {
  return {
    offsetX: view?.offsetX ?? 0,
    offsetY: view?.offsetY ?? 0,
    scale: view?.scale ?? 1
  };
}

function formatMatrixValue(value) {
  return Number(value.toFixed(6));
}

function formatMatrixForLog(matrix) {
  return [
    "matrix: [",
    `  [${formatMatrixValue(matrix[0][0])}, ${formatMatrixValue(matrix[0][1])}, ${formatMatrixValue(matrix[0][2])}],`,
    `  [${formatMatrixValue(matrix[1][0])}, ${formatMatrixValue(matrix[1][1])}, ${formatMatrixValue(matrix[1][2])}],`,
    `  [${formatMatrixValue(matrix[2][0])}, ${formatMatrixValue(matrix[2][1])}, ${formatMatrixValue(matrix[2][2])}]`,
    "]"
  ].join("\n");
}

function getActiveCamera() {
  const { camera } = getCurrentAttractor();
  const matrix = cameraModeState.matrixOverride || getCameraPreset(camera).matrix;

  return {
    matrix
  };
}

function getActiveView() {
  return {
    offsetX: cameraModeState.offsetX,
    offsetY: cameraModeState.offsetY,
    scale: cameraModeState.viewScale
  };
}

function logActiveCamera() {
  const activeView = getActiveView();
  console.log(
    `camera: {\n` +
    `${formatMatrixForLog(getActiveCamera().matrix).split("\n").map((line) => `  ${line}`).join("\n")}\n` +
    `},\n` +
    `view: {\n` +
    `  offsetX: ${Number(activeView.offsetX.toFixed(2))},\n` +
    `  offsetY: ${Number(activeView.offsetY.toFixed(2))},\n` +
    `  scale: ${Number(activeView.scale.toFixed(3))}\n` +
    `},`
  );
}

function multiplyMatrix3(a, b) {
  return [
    [
      a[0][0] * b[0][0] + a[0][1] * b[1][0] + a[0][2] * b[2][0],
      a[0][0] * b[0][1] + a[0][1] * b[1][1] + a[0][2] * b[2][1],
      a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2] * b[2][2]
    ],
    [
      a[1][0] * b[0][0] + a[1][1] * b[1][0] + a[1][2] * b[2][0],
      a[1][0] * b[0][1] + a[1][1] * b[1][1] + a[1][2] * b[2][1],
      a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2] * b[2][2]
    ],
    [
      a[2][0] * b[0][0] + a[2][1] * b[1][0] + a[2][2] * b[2][0],
      a[2][0] * b[0][1] + a[2][1] * b[1][1] + a[2][2] * b[2][1],
      a[2][0] * b[0][2] + a[2][1] * b[1][2] + a[2][2] * b[2][2]
    ]
  ];
}

function orthonormalizeMatrix3(matrix) {
  const xAxis = normalizeVector3({
    x: matrix[0][0],
    y: matrix[0][1],
    z: matrix[0][2]
  });
  const ySeed = {
    x: matrix[1][0],
    y: matrix[1][1],
    z: matrix[1][2]
  };
  const zAxis = normalizeVector3(crossVector3(xAxis, ySeed));
  const yAxis = normalizeVector3(crossVector3(zAxis, xAxis));

  return [
    [xAxis.x, xAxis.y, xAxis.z],
    [yAxis.x, yAxis.y, yAxis.z],
    [zAxis.x, zAxis.y, zAxis.z]
  ];
}

function normalizeVector3(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}

function crossVector3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function dotVector3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function buildAxisAngleMatrix(axis, angle) {
  const normalizedAxis = normalizeVector3(axis);
  const { x, y, z } = normalizedAxis;
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  const t = 1 - cosAngle;

  return [
    [
      t * x * x + cosAngle,
      t * x * y - sinAngle * z,
      t * x * z + sinAngle * y
    ],
    [
      t * x * y + sinAngle * z,
      t * y * y + cosAngle,
      t * y * z - sinAngle * x
    ],
    [
      t * x * z - sinAngle * y,
      t * y * z + sinAngle * x,
      t * z * z + cosAngle
    ]
  ];
}

function buildArcballRotation(fromVector, toVector) {
  const dot = clamp(dotVector3(fromVector, toVector), -1, 1);
  const axis = crossVector3(fromVector, toVector);
  const axisLength = Math.hypot(axis.x, axis.y, axis.z);

  if (axisLength < 1e-6) {
    if (dot > 0.9999) {
      return buildAxisAngleMatrix({ x: 0, y: 1, z: 0 }, 0);
    }

    const fallbackAxis = Math.abs(fromVector.x) < 0.9
      ? crossVector3(fromVector, { x: 1, y: 0, z: 0 })
      : crossVector3(fromVector, { x: 0, y: 1, z: 0 });

    return buildAxisAngleMatrix(fallbackAxis, Math.PI);
  }

  return buildAxisAngleMatrix(axis, Math.acos(dot));
}

function projectPointerToArcball(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const radius = Math.min(rect.width, rect.height) * 0.5;
  const localX = (clientX - rect.left - rect.width * 0.5) / radius;
  const localY = (rect.height * 0.5 - (clientY - rect.top)) / radius;
  const lengthSquared = localX * localX + localY * localY;

  if (lengthSquared <= 1) {
    return {
      x: localX,
      y: localY,
      z: Math.sqrt(1 - lengthSquared)
    };
  }

  const normalizedXY = normalizeVector3({ x: localX, y: localY, z: 0 });
  return {
    x: normalizedXY.x,
    y: normalizedXY.y,
    z: 0
  };
}

function startCameraDrag(event) {
  if (!cameraModeState.enabled || cameraModeState.dragging) {
    return;
  }

  event.preventDefault();
  const activeCamera = getActiveCamera();
  const isPanDrag = event.button === 1 || event.button === 2;

  cameraModeState.pointerId = event.pointerId;
  cameraModeState.dragMode = isPanDrag ? "pan" : "rotate";
  cameraModeState.dragging = true;
  cameraModeState.startClientX = event.clientX;
  cameraModeState.startClientY = event.clientY;
  cameraModeState.startOffsetX = cameraModeState.offsetX;
  cameraModeState.startOffsetY = cameraModeState.offsetY;
  cameraModeState.startVector = isPanDrag ? null : projectPointerToArcball(event.clientX, event.clientY);
  cameraModeState.startMatrix = isPanDrag ? null : activeCamera.matrix.map((row) => row.slice());
  canvas.setPointerCapture(event.pointerId);
  syncCameraModePanel();
}

function updateCameraDrag(event) {
  if (!cameraModeState.enabled || !cameraModeState.dragging || event.pointerId !== cameraModeState.pointerId) {
    return;
  }

  if (cameraModeState.dragMode === "pan") {
    cameraModeState.offsetX = cameraModeState.startOffsetX + (event.clientX - cameraModeState.startClientX) * PAN_SENSITIVITY;
    cameraModeState.offsetY = cameraModeState.startOffsetY + (event.clientY - cameraModeState.startClientY) * PAN_SENSITIVITY;
  } else {
    const currentVector = projectPointerToArcball(event.clientX, event.clientY);
    const deltaRotation = buildArcballRotation(cameraModeState.startVector, currentVector);
    const nextMatrix = orthonormalizeMatrix3(multiplyMatrix3(deltaRotation, cameraModeState.startMatrix));
    cameraModeState.matrixOverride = nextMatrix;
  }

  syncCameraModePanel();
}

function stopCameraDrag() {
  if (cameraModeState.pointerId !== null) {
    try {
      canvas.releasePointerCapture(cameraModeState.pointerId);
    } catch (error) {
      // Ignore release errors when capture was already cleared.
    }
  }

  cameraModeState.pointerId = null;
  cameraModeState.dragMode = null;
  cameraModeState.dragging = false;
  cameraModeState.startVector = null;
  cameraModeState.startMatrix = null;
  cameraModeState.startClientX = 0;
  cameraModeState.startClientY = 0;
  syncCameraModePanel();
}

function handleCameraWheel(event) {
  if (!cameraModeState.enabled) {
    return;
  }

  event.preventDefault();
  const zoomFactor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
  cameraModeState.viewScale = clamp(cameraModeState.viewScale * zoomFactor, MIN_ZOOM, MAX_ZOOM);
  syncCameraModePanel();
}

function handleCameraDoubleClick(event) {
  if (!cameraModeState.enabled || event.button !== 0) {
    return;
  }

  event.preventDefault();
  stopCameraDrag();
  resetCameraModeOffsets();
}

function isRotationDragActive() {
  return cameraModeState.enabled
    && cameraModeState.dragging
    && cameraModeState.dragMode === "rotate";
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  centerX = width / 2;
  centerY = height / 2 - height * 0.04;
  scale = Math.min(width, height) / BASE_SCALE;
}

function createParticle() {
  return getCurrentAttractor().createParticle();
}

function resetParticle(particle) {
  const fresh = createParticle();
  particle.x = fresh.x;
  particle.y = fresh.y;
  particle.z = fresh.z;
  particle.alpha = fresh.alpha;
  particle.size = fresh.size;
  particle.delayedZ = fresh.delayedZ;
  particle.zHistory = fresh.zHistory ? fresh.zHistory.slice() : null;
  particle.zHistoryIndex = fresh.zHistoryIndex ?? 0;
}

function seedParticles() {
  particles.length = 0;
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    particles.push(createParticle());
  }
}

function stepAttractor(point) {
  const attractor = getCurrentAttractor();
  const { derivative, dt, beforeStep, afterStep } = attractor;

  if (beforeStep) {
    beforeStep(point);
  }

  const k1 = derivative(point.x, point.y, point.z, point);
  const k2 = derivative(
    point.x + k1.dx * dt * 0.5,
    point.y + k1.dy * dt * 0.5,
    point.z + k1.dz * dt * 0.5,
    point
  );
  const k3 = derivative(
    point.x + k2.dx * dt * 0.5,
    point.y + k2.dy * dt * 0.5,
    point.z + k2.dz * dt * 0.5,
    point
  );
  const k4 = derivative(
    point.x + k3.dx * dt,
    point.y + k3.dy * dt,
    point.z + k3.dz * dt,
    point
  );

  point.x += dt * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx) / 6;
  point.y += dt * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy) / 6;
  point.z += dt * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz) / 6;

  if (afterStep) {
    afterStep(point);
  }
}

function isParticleValid(point) {
  const { escapeRadius } = getCurrentAttractor();

  return Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Number.isFinite(point.z)
    && Math.abs(point.x) < escapeRadius
    && Math.abs(point.y) < escapeRadius
    && Math.abs(point.z) < escapeRadius;
}

function project(point, cameraMatrix) {
  const x1 = point.x * cameraMatrix[0][0] + point.y * cameraMatrix[0][1] + point.z * cameraMatrix[0][2];
  const y1 = point.x * cameraMatrix[1][0] + point.y * cameraMatrix[1][1] + point.z * cameraMatrix[1][2];
  const z2 = point.x * cameraMatrix[2][0] + point.y * cameraMatrix[2][1] + point.z * cameraMatrix[2][2];

  const depth = Math.max(0.18, 210 / (210 + z2 * 2.2));

  return {
    x: centerX + x1 * scale * cameraModeState.viewScale * depth * 0.4,
    y: centerY + y1 * scale * cameraModeState.viewScale * depth * 0.4,
    depth
  };
}

function updateAttractorOffset(cameraMatrix) {
  const { referencePoints } = getCurrentAttractor();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < referencePoints.length; i += 1) {
    const projected = project(referencePoints[i], cameraMatrix);
    minX = Math.min(minX, projected.x);
    maxX = Math.max(maxX, projected.x);
    minY = Math.min(minY, projected.y);
    maxY = Math.max(maxY, projected.y);
  }

  attractorOffsetX = centerX - (minX + maxX) / 2;
  attractorOffsetY = centerY - (minY + maxY) / 2;
}

function drawLabel() {
  labelTitle.textContent = getCurrentAttractor().name;
  syncCameraModePanel();
}

function clearCanvas() {
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);
}

function switchAttractor(direction) {
  currentAttractorIndex = (currentAttractorIndex + direction + attractors.length) % attractors.length;
  resetCameraModeOffsets();
  seedParticles();
  drawLabel();
  clearCanvas();
}

function render() {
  const activeCamera = getActiveCamera();
  const cameraMatrix = activeCamera.matrix;
  updateAttractorOffset(cameraMatrix);

  ctx.fillStyle = `rgba(16, 16, 16, ${TRAIL_FADE})`;
  ctx.fillRect(0, 0, width, height);

  const projected = [];

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];

    if (!isRotationDragActive()) {
      for (let step = 0; step < SUBSTEPS; step += 1) {
        stepAttractor(particle);
      }
    }

    if (!isParticleValid(particle)) {
      resetParticle(particle);
    }

    projected.push({
      ...project(particle, cameraMatrix),
      alpha: particle.alpha,
      size: particle.size
    });
  }

  projected.sort((a, b) => a.depth - b.depth);

  for (let i = 0; i < projected.length; i += 1) {
    const point = projected[i];
    const radius = point.size * point.depth;
    const x = point.x + attractorOffsetX + cameraModeState.offsetX;
    const y = point.y + attractorOffsetY + cameraModeState.offsetY;

    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.05 * point.alpha * point.depth})`;
    ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * point.alpha})`;
    ctx.arc(x, y, Math.max(0.45, radius), 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(render);
}

function handleCanvasContextMenu(event) {
  if (!cameraModeState.enabled) {
    return;
  }

  event.preventDefault();
}

function handlePointerLeave(event) {
  if (!cameraModeState.dragging || event.pointerId !== cameraModeState.pointerId) {
    return;
  }

  stopCameraDrag();
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();

  if (key === "c" || key === "с") {
    setCameraModeEnabled(!cameraModeState.enabled);
  } else if (event.key === "ArrowLeft" || key === "a" || key === "ф") {
    switchAttractor(-1);
  } else if (event.key === "ArrowRight" || key === "d" || key === "в") {
    switchAttractor(1);
  } else if (cameraModeState.enabled && event.key === "Enter") {
    logActiveCamera();
  }
}

function bindEvents() {
  window.addEventListener("resize", resize);
  canvas.addEventListener("contextmenu", handleCanvasContextMenu);
  canvas.addEventListener("pointerdown", startCameraDrag);
  canvas.addEventListener("pointermove", updateCameraDrag);
  canvas.addEventListener("pointerup", stopCameraDrag);
  canvas.addEventListener("pointercancel", stopCameraDrag);
  canvas.addEventListener("wheel", handleCameraWheel, { passive: false });
  canvas.addEventListener("dblclick", handleCameraDoubleClick);
  canvas.addEventListener("pointerleave", handlePointerLeave);
  window.addEventListener("keydown", handleKeydown);
}

function initialize() {
  resize();
  resetCameraModeOffsets();
  seedParticles();
  drawLabel();
  clearCanvas();
  bindEvents();
  requestAnimationFrame(render);
}

initialize();
