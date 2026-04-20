import {
  AUTO_RESUME_MS,
  CARET_BLINK_MS,
  CHAR_ASPECT,
  COMMAND_HISTORY_LIMIT,
  DEFAULT_PROMPT,
  DEFAULT_VIEW_STATE,
  DRAG_BUTTON,
  NAMED_COLORS,
  PALETTE,
  SHELL_STATE_LINE_LIMIT,
  STORAGE_KEYS,
  UI_INSET_LEFT,
  UI_INSET_TOP
} from "./modules/constants.js";
import { figures } from "./modules/figures.js";
import {
  addVec3,
  clamp,
  crossVec3,
  dotVec3,
  formatSigned,
  normalizeVec3,
  quatFromAxisAngle,
  quatFromVectors,
  quatIdentity,
  quatMultiply,
  quatNormalize,
  quatRotateVec3,
  scaleVec3,
  subVec3
} from "./modules/math3d.js";
import { meshLibrary } from "./modules/mesh-library.js";

const terminal = document.getElementById("terminal");
const figureRenderers = {
  sphere: renderSphere,
  mobius_strip: renderMobiusStrip,
  torus: renderTorus
};

const state = {
  mode: "shell",
  shellLines: [],
  commandInput: "",
  commandHistory: [],
  historyIndex: 0,
  menuIndex: 0,
  sliderIndex: 0,
  settingsVisible: false,
  currentFigureId: null,
  prompt: DEFAULT_PROMPT,
  viewportCols: 120,
  viewportRows: 44,
  renderCols: 100,
  renderRows: 28,
  userQuat: quatIdentity(),
  autoQuat: quatIdentity(),
  panX: 0,
  panY: 0,
  zoom: 6.5,
  userInteracting: false,
  dragging: null,
  dragVector: null,
  lastPointerX: 0,
  lastPointerY: 0,
  animationFrame: 0,
  lastTimestamp: 0,
  autoRotateEnabled: true,
  autoRotateResumeAt: 0,
  measureSpan: null
};

function boot() {
  loadPersistedSettings();
  state.prompt = buildPrompt();
  terminal.tabIndex = 0;
  terminal.setAttribute("role", "application");
  terminal.setAttribute("aria-label", "ASCII_OS console");
  terminal.addEventListener("contextmenu", (event) => event.preventDefault());
  terminal.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  terminal.addEventListener("wheel", onWheel, { passive: false });
  terminal.addEventListener("dblclick", onDoubleClick);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", handleResize);
  createMeasureNode();
  handleResize();
  renderScreen();
  state.animationFrame = requestAnimationFrame(tick);
  terminal.focus();
}

function createMeasureNode() {
  const span = document.createElement("span");
  span.textContent = "M";
  span.style.position = "absolute";
  span.style.visibility = "hidden";
  span.style.pointerEvents = "none";
  span.style.whiteSpace = "pre";
  span.style.font = getComputedStyle(terminal).font;
  document.body.appendChild(span);
  state.measureSpan = span;
}

function handleResize() {
  if (!state.measureSpan) {
    return;
  }

  const style = getComputedStyle(terminal);
  state.measureSpan.style.font = style.font;
  const charRect = state.measureSpan.getBoundingClientRect();
  const rect = terminal.getBoundingClientRect();
  const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const charWidth = Math.max(1, charRect.width);
  const charHeight = Math.max(1, charRect.height);
  const contentWidth = Math.max(0, rect.width - paddingX);
  const contentHeight = Math.max(0, rect.height - paddingY);
  state.viewportCols = Math.max(52, Math.floor(contentWidth / charWidth));
  state.viewportRows = Math.max(26, Math.floor(contentHeight / charHeight));
  renderScreen();
}

function tick(timestamp) {
  const deltaSeconds = state.lastTimestamp ? Math.min(0.05, (timestamp - state.lastTimestamp) / 1000) : 0.016;
  state.lastTimestamp = timestamp;

  if (state.mode === "render") {
    updateAutoRotation(deltaSeconds, timestamp);
  }

  renderScreen(timestamp);
  state.animationFrame = requestAnimationFrame(tick);
}

function updateAutoRotation(deltaSeconds, timestamp) {
  if (state.userInteracting) {
    return;
  }

  if (!state.autoRotateEnabled && timestamp >= state.autoRotateResumeAt) {
    state.autoRotateEnabled = true;
  }

  if (!state.autoRotateEnabled) {
    return;
  }

  const speed = getSliderValue("speed");
  if (speed <= 0) {
    return;
  }

  const yaw = quatFromAxisAngle([0, 1, 0], deltaSeconds * (0.65 + speed * 0.85));
  const pitch = quatFromAxisAngle([1, 0, 0], deltaSeconds * (0.3 + speed * 0.45));
  state.autoQuat = quatNormalize(quatMultiply(yaw, quatMultiply(pitch, state.autoQuat)));
}

function renderScreen(timestamp = performance.now()) {
  if (state.mode === "shell") {
    terminal.textContent = renderShellView(timestamp);
    return;
  }

  if (state.mode === "menu") {
    terminal.textContent = renderMenuView();
    return;
  }

  terminal.textContent = renderRenderView();
}

function renderShellView(timestamp) {
  const caretVisible = Math.floor(timestamp / CARET_BLINK_MS) % 2 === 0;
  const lines = [];
  lines.push(...state.shellLines);
  lines.push(`${state.prompt}${state.commandInput}${caretVisible ? "_" : " "}`);
  return insetTextLines(lines).join("\n");
}

function renderMenuView() {
  const lines = [];
  lines.push("+------------------------------------+");
  lines.push("|             RENDER_3D              |");
  lines.push("+------------------------------------+");
  lines.push("");
  lines.push("+----+-------------------------------+");
  lines.push("| ## | Figure                        |");
  lines.push("+----+-------------------------------+");

  figures.forEach((figure, index) => {
    const cursor = index === state.menuIndex ? ">" : " ";
    const rowNumber = String(index + 1).padStart(2, "0");
    const label = `${cursor} ${figure.label}`.padEnd(29, " ");
    lines.push(`| ${rowNumber} | ${label} |`);
  });

  lines.push("+----+-------------------------------+");
  return insetTextLines(lines).join("\n");
}

function insetTextLines(lines, topInset = UI_INSET_TOP, leftInset = UI_INSET_LEFT) {
  const insetLines = [];
  const leftPadding = " ".repeat(Math.max(0, leftInset));

  for (let i = 0; i < topInset; i += 1) {
    insetLines.push("");
  }

  lines.forEach((line) => {
    insetLines.push(`${leftPadding}${line}`);
  });

  return insetLines;
}

function renderRenderView() {
  const reservedRows = 0;
  state.renderRows = Math.max(12, state.viewportRows - reservedRows);
  state.renderCols = Math.max(42, state.viewportCols);

  const frame = createFrameBuffer(state.renderCols, state.renderRows);
  renderCurrentFigure(frame);
  if (state.settingsVisible) {
    overlaySettings(frame);
  }

  return frame.lines.join("\n");
}

function buildSettingsLines() {
  const figure = getCurrentFigure();
  const lines = [];
  lines.push(`settings / ${state.currentFigureId}`);
  lines.push("");
  lines.push(`view x=${formatSigned(state.panX)} y=${formatSigned(state.panY)} zoom=${state.zoom.toFixed(2)}`);
  lines.push("");

  figure.sliders.forEach((slider, index) => {
    const selected = index === state.sliderIndex;
    lines.push(renderSliderLine(slider, selected));
  });

  return lines;
}

function overlaySettings(frame) {
  const content = buildSettingsLines();
  const innerWidth = Math.max(...content.map((line) => line.length), 18);
  const boxWidth = Math.min(frame.width - 2, innerWidth + 4);
  const boxHeight = Math.min(frame.height - 2, content.length + 2);
  const startX = Math.max(0, Math.floor((frame.width - boxWidth) / 2));
  const startY = Math.max(0, Math.floor((frame.height - boxHeight) / 2));
  const topBottom = `+${"-".repeat(Math.max(0, boxWidth - 2))}+`;

  drawText(frame, startX, startY, topBottom);
  for (let row = 1; row < boxHeight - 1; row += 1) {
    drawText(frame, startX, startY + row, `|${" ".repeat(Math.max(0, boxWidth - 2))}|`);
  }
  drawText(frame, startX, startY + boxHeight - 1, topBottom);

  const visibleContent = content.slice(0, Math.max(0, boxHeight - 2));
  visibleContent.forEach((line, index) => {
    const clipped = line.slice(0, Math.max(0, boxWidth - 4));
    drawText(frame, startX + 2, startY + 1 + index, clipped);
  });

  finalizeFrame(frame);
}

function renderSliderLine(slider, selected) {
  const width = Math.max(10, Math.min(24, state.renderCols - 28));
  const value = slider.value;
  const ratio = (value - slider.min) / (slider.max - slider.min || 1);
  const fill = Math.round(ratio * width);
  const bar = `${"#".repeat(fill)}${"-".repeat(Math.max(0, width - fill))}`;
  const cursor = selected ? ">" : " ";
  return `${cursor} ${slider.label.padEnd(6, " ")} [${bar}] ${value.toFixed(2)}`;
}

function renderCurrentFigure(frame) {
  const figureId = state.currentFigureId;
  const renderer = figureRenderers[figureId];
  if (renderer) {
    renderer(frame);
    return;
  }

  const mesh = meshLibrary[figureId];
  if (mesh) {
    renderMesh(frame, mesh);
  }
}

function createFrameBuffer(width, height) {
  return {
    width,
    height,
    chars: new Array(width * height).fill(" "),
    depth: new Array(width * height).fill(-Infinity),
    lines: []
  };
}

function renderMesh(frame, mesh) {
  const size = getSliderValue("size");
  const resolution = getMeshRenderResolution();
  const rotation = getSceneQuaternion();
  const light = getLightDirection();
  const ambient = getAmbientLight();
  const transformed = mesh.vertices.map((vertex) => {
    const scaled = scaleVec3(vertex, size);
    return quatRotateVec3(rotation, scaled);
  });

  const screenVerts = transformed.map((vertex) => projectPoint(vertex));

  mesh.faces.forEach((face) => {
    const a = transformed[face[0]];
    const b = transformed[face[1]];
    const c = transformed[face[2]];
    const normal = normalizeVec3(crossVec3(subVec3(b, a), subVec3(c, a)));
    const isBackFace = normal[2] >= 0;
    if (!mesh.doubleSided && isBackFace) {
      return;
    }

    const lightDot = -dotVec3(normal, light);
    const diffuse = Math.max(0, mesh.doubleSided ? Math.abs(lightDot) : lightDot);
    const brightness = clamp(ambient, 1, ambient + diffuse * (1 - ambient));
    rasterizeTriangle(
      frame,
      screenVerts[face[0]],
      screenVerts[face[1]],
      screenVerts[face[2]],
      brightness,
      resolution
    );
  });

  finalizeFrame(frame);
}

function renderSphere(frame) {
  const size = getSliderValue("size");
  const light = getLightDirection();
  const ambient = getAmbientLight();
  const radius = 1.25 * size;
  const rotation = getSceneQuaternion();
  const inverseRotation = quatConjugate(rotation);
  const objectOffset = [state.panX, state.panY, 0];
  const cameraOrigin = getCameraOrigin();
  const quality = getSphereRenderResolution();

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      let brightnessSum = 0;
      let hitCount = 0;
      let nearestDepth = Infinity;

      for (let sampleIndex = 0; sampleIndex < quality.samples.length; sampleIndex += 1) {
        const sample = quality.samples[sampleIndex];
        const ray = getCameraRay(x + sample[0], y + sample[1]);
        const localOrigin = quatRotateVec3(inverseRotation, subVec3(cameraOrigin, objectOffset));
        const localDirection = normalizeVec3(quatRotateVec3(inverseRotation, ray.direction));
        const hitDistance = intersectSphere(localOrigin, localDirection, radius);
        if (hitDistance === null) {
          continue;
        }

        const localPoint = addVec3(localOrigin, scaleVec3(localDirection, hitDistance));
        const localNormal = normalizeVec3(localPoint);
        const worldNormal = normalizeVec3(quatRotateVec3(rotation, localNormal));
        const worldPoint = addVec3(ray.origin, scaleVec3(ray.direction, hitDistance));
        const viewAlignment = Math.max(0, -dotVec3(worldNormal, ray.direction));
        const diffuse = Math.max(0, -dotVec3(worldNormal, light));
        const rim = Math.pow(1 - viewAlignment, 2.4) * 0.22;
        const brightness = clamp(
          ambient * 0.72,
          1,
          ambient + diffuse * (1 - ambient) * 0.88 + rim
        );

        brightnessSum += brightness;
        hitCount += 1;
        nearestDepth = Math.min(nearestDepth, worldPoint[2] + state.zoom);
      }

      if (hitCount === 0) {
        continue;
      }

      plotPoint(frame, x, y, nearestDepth, brightnessSum / hitCount);
    }
  }

  finalizeFrame(frame);
}

function renderTorus(frame) {
  const size = getSliderValue("size");
  const light = getLightDirection();
  const ambient = getAmbientLight();
  const quality = getTorusRenderResolution();

  renderImplicitSurface(frame, {
    distanceEstimator(point) {
      return torusDistance(point, 1.45 * size, 0.58 * size);
    },
    maxSteps: quality.maxSteps,
    surfaceEpsilon: quality.surfaceEpsilon,
    normalDelta: quality.normalDelta,
    stepScale: quality.stepScale,
    getBrightness({ worldNormal, rayDirection }) {
      const viewAlignment = Math.max(0, -dotVec3(worldNormal, rayDirection));
      const diffuse = Math.max(0, -dotVec3(worldNormal, light));
      const rim = Math.pow(1 - viewAlignment, 3.2) * 0.18;
      const specular = Math.pow(Math.max(0, diffuse), 7) * 0.08;
      return clamp(
        ambient * 0.58,
        1,
        ambient + diffuse * (1 - ambient) * 0.86 + rim + specular
      );
    }
  });

  finalizeFrame(frame);
}

function renderMobiusStrip(frame) {
  const size = getSliderValue("size");
  const light = getLightDirection();
  const ambient = getAmbientLight();
  const quality = getMobiusRenderResolution();
  const rotation = getSceneQuaternion();
  const grid = [];

  for (let uIndex = 0; uIndex < quality.uSteps; uIndex += 1) {
    const row = [];
    for (let vIndex = 0; vIndex <= quality.vSteps; vIndex += 1) {
      const sample = sampleMobiusStripSurface(
        uIndex / quality.uSteps,
        vIndex / quality.vSteps,
        size
      );
      const worldPoint = quatRotateVec3(rotation, sample.point);
      const worldNormal = normalizeVec3(quatRotateVec3(rotation, sample.normal));
      const lightDot = -dotVec3(worldNormal, light);
      const diffuse = Math.max(0, Math.abs(lightDot));
      const brightness = clamp(
        ambient * 0.72,
        1,
        ambient + diffuse * (1 - ambient) * 0.84 + 0.05 * Math.sin(sample.angle * 6)
      );
      row.push({
        point: worldPoint,
        normal: worldNormal,
        projected: projectPoint(worldPoint),
        brightness
      });
    }
    grid.push(row);
  }

  for (let uIndex = 0; uIndex < quality.uSteps; uIndex += 1) {
    const nextU = (uIndex + 1) % quality.uSteps;
    for (let vIndex = 0; vIndex < quality.vSteps; vIndex += 1) {
      const a = grid[uIndex][vIndex];
      const b = grid[uIndex][vIndex + 1];
      const nextVIndex = nextU === 0 ? quality.vSteps - vIndex : vIndex;
      const c = grid[nextU][nextVIndex];
      const d = grid[nextU][nextVIndex + (nextU === 0 ? -1 : 1)];
      rasterizeSurfaceTriangle(frame, a, c, b, {
        doubleSided: true,
        resolution: quality.rasterResolution
      });
      rasterizeSurfaceTriangle(frame, b, c, d, {
        doubleSided: true,
        resolution: quality.rasterResolution
      });
    }
  }

  finalizeFrame(frame);
}

function renderImplicitSurface(frame, options) {
  const {
    distanceEstimator,
    getBrightness
  } = options;
  const rotation = getSceneQuaternion();
  const inverseRotation = quatConjugate(rotation);
  const cameraOrigin = getCameraOrigin();
  const objectOffset = [state.panX, state.panY, 0];

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const ray = getCameraRay(x + 0.5, y + 0.5);
      const localOrigin = quatRotateVec3(inverseRotation, subVec3(cameraOrigin, objectOffset));
      const localDirection = normalizeVec3(quatRotateVec3(inverseRotation, ray.direction));
      const hitDistance = marchRay(localOrigin, localDirection, distanceEstimator, options);
      if (hitDistance === null) {
        continue;
      }

      const localPoint = addVec3(localOrigin, scaleVec3(localDirection, hitDistance));
      const localNormal = estimateImplicitNormal(localPoint, distanceEstimator, options.normalDelta || 0.03);
      const worldNormal = normalizeVec3(quatRotateVec3(rotation, localNormal));
      const worldPoint = addVec3(ray.origin, scaleVec3(ray.direction, hitDistance));
      const brightness = getBrightness({
        localPoint,
        localNormal,
        worldNormal,
        rayDirection: ray.direction,
        distance: hitDistance
      });

      plotPoint(frame, x, y, worldPoint[2] + state.zoom, brightness);
    }
  }
}

function rasterizeSurfaceTriangle(frame, p0, p1, p2, options) {
  const faceNormal = normalizeVec3(crossVec3(subVec3(p1.point, p0.point), subVec3(p2.point, p0.point)));
  if (faceNormal[0] === 0 && faceNormal[1] === 0 && faceNormal[2] === 0) {
    return;
  }

  const isBackFace = faceNormal[2] >= 0;
  if (!options.doubleSided && isBackFace) {
    return;
  }

  const brightness = (p0.brightness + p1.brightness + p2.brightness) / 3;
  rasterizeTriangle(frame, p0.projected, p1.projected, p2.projected, brightness, options.resolution);
}

function projectPoint(point) {
  const depth = point[2] + state.zoom;
  const scale = Math.min(state.renderCols, state.renderRows) * 0.72;
  const centerX = (state.renderCols - 1) / 2;
  const centerY = (state.renderRows - 1) / 2;
  const x = centerX + ((point[0] + state.panX) * scale) / (depth * CHAR_ASPECT);
  const y = centerY - ((point[1] + state.panY) * scale) / depth;
  return { x, y, depth };
}

function rasterizeTriangle(frame, p0, p1, p2, brightness, resolution = 1) {
  if (p0.depth <= 0 || p1.depth <= 0 || p2.depth <= 0) {
    return;
  }

  const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
  const maxX = Math.min(frame.width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
  const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
  const maxY = Math.min(frame.height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
  const area = edgeFunction(p0, p1, p2);

  if (Math.abs(area) < 1e-6) {
    return;
  }

  const sampleStep = clamp(0.35, 1.8, 1.45 / resolution);
  for (let y = minY; y <= maxY; y += sampleStep) {
    for (let x = minX; x <= maxX; x += sampleStep) {
      const sample = { x: x + sampleStep * 0.5, y: y + sampleStep * 0.5 };
      const w0 = edgeFunction(p1, p2, sample);
      const w1 = edgeFunction(p2, p0, sample);
      const w2 = edgeFunction(p0, p1, sample);
      const hasSameSign =
        (w0 >= 0 && w1 >= 0 && w2 >= 0) ||
        (w0 <= 0 && w1 <= 0 && w2 <= 0);

      if (!hasSameSign) {
        continue;
      }

      const b0 = w0 / area;
      const b1 = w1 / area;
      const b2 = w2 / area;
      const depth = b0 * p0.depth + b1 * p1.depth + b2 * p2.depth;
      plotPoint(frame, x, y, depth, brightness);
    }
  }
}

function plotPoint(frame, x, y, depth, brightness) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= frame.width || iy < 0 || iy >= frame.height || depth <= 0) {
    return;
  }

  const index = iy * frame.width + ix;
  const invDepth = 1 / depth;
  if (invDepth <= frame.depth[index]) {
    return;
  }

  frame.depth[index] = invDepth;
  const paletteIndex = Math.max(0, Math.min(PALETTE.length - 1, Math.round(brightness * (PALETTE.length - 1))));
  frame.chars[index] = PALETTE[paletteIndex];
}

function finalizeFrame(frame) {
  frame.lines = [];
  for (let y = 0; y < frame.height; y += 1) {
    const line = frame.chars.slice(y * frame.width, (y + 1) * frame.width).join("");
    frame.lines.push(line);
  }
}

function drawText(frame, x, y, text) {
  if (y < 0 || y >= frame.height) {
    return;
  }

  for (let i = 0; i < text.length; i += 1) {
    const px = x + i;
    if (px < 0 || px >= frame.width) {
      continue;
    }

    const index = y * frame.width + px;
    frame.chars[index] = text[i];
    frame.depth[index] = Infinity;
  }
}

function getCameraOrigin() {
  return [0, 0, -state.zoom];
}

function getCameraRay(sampleX, sampleY) {
  const scale = Math.min(state.renderCols, state.renderRows) * 0.72;
  const centerX = (state.renderCols - 1) / 2;
  const centerY = (state.renderRows - 1) / 2;
  const screenX = ((sampleX - centerX) * CHAR_ASPECT) / scale;
  const screenY = (centerY - sampleY) / scale;
  return {
    origin: getCameraOrigin(),
    direction: normalizeVec3([screenX, screenY, 1])
  };
}

function quatConjugate(q) {
  return [-q[0], -q[1], -q[2], q[3]];
}

function intersectSphere(origin, direction, radius) {
  const b = 2 * dotVec3(origin, direction);
  const c = dotVec3(origin, origin) - radius * radius;
  const discriminant = b * b - 4 * c;
  if (discriminant < 0) {
    return null;
  }

  const root = Math.sqrt(discriminant);
  const near = (-b - root) * 0.5;
  if (near > 0.001) {
    return near;
  }

  const far = (-b + root) * 0.5;
  return far > 0.001 ? far : null;
}

function marchRay(origin, direction, distanceEstimator, options = {}) {
  const maxSteps = options.maxSteps || 72;
  const maxDistance = options.maxDistance || 32;
  const surfaceEpsilon = options.surfaceEpsilon || 0.02;
  const minStep = options.minStep || 0.012;
  const stepScale = options.stepScale || 0.85;
  let distance = 0;

  for (let step = 0; step < maxSteps && distance <= maxDistance; step += 1) {
    const point = addVec3(origin, scaleVec3(direction, distance));
    const surfaceDistance = distanceEstimator(point);
    if (Math.abs(surfaceDistance) < surfaceEpsilon) {
      return distance;
    }
    distance += Math.max(minStep, surfaceDistance * stepScale);
  }

  return null;
}

function estimateImplicitNormal(point, distanceEstimator, delta) {
  const dx = distanceEstimator([point[0] + delta, point[1], point[2]]) - distanceEstimator([point[0] - delta, point[1], point[2]]);
  const dy = distanceEstimator([point[0], point[1] + delta, point[2]]) - distanceEstimator([point[0], point[1] - delta, point[2]]);
  const dz = distanceEstimator([point[0], point[1], point[2] + delta]) - distanceEstimator([point[0], point[1], point[2] - delta]);
  return normalizeVec3([dx, dy, dz]);
}

function torusDistance(point, majorRadius, minorRadius) {
  const radialDistance = Math.hypot(point[0], point[2]);
  return Math.hypot(radialDistance - majorRadius, point[1]) - minorRadius;
}

function sampleMobiusStripSurface(u, v, size) {
  const angle = u * Math.PI * 2;
  const stripV = (-0.42 + v * 0.84) * size;
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  const halfAngle = angle * 0.5;
  const cosHalfAngle = Math.cos(halfAngle);
  const sinHalfAngle = Math.sin(halfAngle);
  const radius = size + stripV * cosHalfAngle;
  const point = [
    radius * cosAngle,
    stripV * sinHalfAngle * 1.15,
    radius * sinAngle
  ];
  const tangentU = [
    -(size + stripV * cosHalfAngle) * sinAngle - 0.5 * stripV * sinHalfAngle * cosAngle,
    0.5 * stripV * cosHalfAngle * 1.15,
    (size + stripV * cosHalfAngle) * cosAngle - 0.5 * stripV * sinHalfAngle * sinAngle
  ];
  const tangentV = [
    cosHalfAngle * cosAngle,
    sinHalfAngle * 1.15,
    cosHalfAngle * sinAngle
  ];
  return {
    point,
    normal: normalizeVec3(crossVec3(tangentV, tangentU)),
    angle
  };
}

function onKeyDown(event) {
  if (state.mode === "shell") {
    handleShellKeys(event);
    return;
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape", "m", "M"].includes(event.key)) {
    event.preventDefault();
  }

  if (state.mode === "menu") {
    handleMenuKeys(event);
    return;
  }

  handleRenderKeys(event);
}

function handleShellKeys(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.key === "Backspace") {
    event.preventDefault();
    state.commandInput = state.commandInput.slice(0, -1);
    persistShellState();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    runCommand(state.commandInput);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (state.commandHistory.length === 0) {
      return;
    }
    state.historyIndex = Math.max(0, state.historyIndex - 1);
    state.commandInput = state.commandHistory[state.historyIndex] || "";
    persistShellState();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (state.commandHistory.length === 0) {
      return;
    }
    state.historyIndex = Math.min(state.commandHistory.length, state.historyIndex + 1);
    state.commandInput = state.historyIndex === state.commandHistory.length ? "" : state.commandHistory[state.historyIndex];
    persistShellState();
    return;
  }

  if (event.key.length === 1) {
    event.preventDefault();
    state.commandInput += event.key;
    persistShellState();
  }
}

function runCommand(rawInput) {
  const input = rawInput.trim();
  const parts = input ? input.split(/\s+/) : [];
  const command = parts[0] ? parts[0].toLowerCase() : "";
  const args = parts.slice(1);
  state.shellLines.push(`${state.prompt}${rawInput}`);

  if (input) {
    state.commandHistory.push(input);
    if (state.commandHistory.length > COMMAND_HISTORY_LIMIT) {
      state.commandHistory = state.commandHistory.slice(-COMMAND_HISTORY_LIMIT);
    }
    state.historyIndex = state.commandHistory.length;
    persistCommandHistory();
  }

  state.commandInput = "";
  persistShellState();

  if (!input) {
    trimShellBuffer();
    return;
  }

  const handled = executeShellCommand(command, args);
  if (handled) {
    return;
  }

  state.shellLines.push(`unknown command: ${input}`);
  state.shellLines.push("type help");
  trimShellBuffer();
}

function executeShellCommand(command, args) {
  const handlers = {
    help() {
      appendShellLines(getHelpLines());
      trimShellBuffer();
    },
    render3d() {
      if (hasHelpFlag(args)) {
        appendShellLines(getRender3dHelpLines());
        trimShellBuffer();
        return;
      }
      state.mode = "menu";
      state.menuIndex = 0;
      persistUiState();
    },
    sysinfo() {
      appendShellLines(getSystemInfoLines());
      trimShellBuffer();
    },
    pwd() {
      state.shellLines.push(window.location.pathname || "/");
      trimShellBuffer();
    },
    clear() {
      clearShellScreen();
    },
    color() {
      handleColorCommand(args);
      trimShellBuffer();
    },
    reboot() {
      rebootConsole();
    }
  };

  const handler = handlers[command];
  if (!handler) {
    return false;
  }

  handler();
  return true;
}

function appendShellLines(lines) {
  state.shellLines.push(...lines);
}

function handleColorCommand(args) {
  if (hasHelpFlag(args)) {
    getColorHelpLines().forEach((line) => state.shellLines.push(line));
    return;
  }

  if (args.length < 1 || args.length > 2) {
    state.shellLines.push("usage: color <text> [background]");
    state.shellLines.push("tip: color -h");
    return;
  }

  const textColor = parseColorArgument(args[0]);
  const backgroundColor = args.length === 2 ? parseColorArgument(args[1]) : null;

  if (!textColor || (args.length === 2 && !backgroundColor)) {
    state.shellLines.push("invalid color value");
    state.shellLines.push("tip: color -h");
    return;
  }

  const finalBackground = backgroundColor || getConsoleColors().background;
  if (normalizeHexColor(textColor) === normalizeHexColor(finalBackground)) {
    state.shellLines.push("text and background colors must be different");
    return;
  }

  applyConsoleColors(textColor, finalBackground);
  persistConsoleSettings();

  state.shellLines.push(
    args.length === 1
      ? `text color changed to ${textColor}`
      : `text/background changed to ${textColor} ${finalBackground}`
  );
}

function hasHelpFlag(args) {
  return args.includes("-h");
}

function normalizeSliderValue(id, value) {
  if (id === "light_yaw") {
    return normalizeAngle360(value);
  }

  if (id === "light_pitch") {
    return clamp(-90, 90, value);
  }

  return value;
}

function normalizeAngle360(value) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function parseColorArgument(value) {
  const normalized = value.trim().toLowerCase();
  if (NAMED_COLORS[normalized]) {
    return NAMED_COLORS[normalized];
  }

  if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(normalized)) {
    return normalized;
  }

  return null;
}

function buildPrompt() {
  const browser = detectBrowserName();
  const os = detectOsName();
  if (!browser || !os) {
    return DEFAULT_PROMPT;
  }

  return `${browser}@${os} ~> `;
}

function detectBrowserName() {
  const ua = window.navigator.userAgent || "";
  const brands = window.navigator.userAgentData && Array.isArray(window.navigator.userAgentData.brands)
    ? window.navigator.userAgentData.brands.map((brand) => brand.brand).join(" ")
    : "";
  const source = `${brands} ${ua}`.toLowerCase();

  if (source.includes("firefox")) {
    return "firefox";
  }
  if (source.includes("edg")) {
    return "edge";
  }
  if (source.includes("opr") || source.includes("opera")) {
    return "opera";
  }
  if (source.includes("chrome") || source.includes("chromium")) {
    return "chrome";
  }
  if (source.includes("safari") && !source.includes("chrome") && !source.includes("chromium")) {
    return "safari";
  }

  return null;
}

function detectOsName() {
  const nav = window.navigator;
  const platform = (nav.userAgentData && nav.userAgentData.platform) || nav.platform || "";
  const ua = nav.userAgent || "";
  const source = `${platform} ${ua}`.toLowerCase();

  if (source.includes("windows")) {
    return "windows";
  }
  if (source.includes("android")) {
    return "android";
  }
  if (source.includes("iphone") || source.includes("ipad") || source.includes("ios")) {
    return "ios";
  }
  if (source.includes("mac") || source.includes("darwin")) {
    return "macos";
  }
  if (source.includes("linux") || source.includes("x11")) {
    return "linux";
  }

  return null;
}

function normalizeHexColor(value) {
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return hex;
  }

  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  return hex;
}

function getHelpLines() {
  return [
    "+----------+-------+--------------------------------------+",
    "| Command  | Flags | Description                          |",
    "+----------+-------+--------------------------------------+",
    "| help     |       | show this help                       |",
    "| pwd      |       | show current pathname                |",
    "| render3d | -h    | open figure selection                |",
    "| sysinfo  |       | show browser system info             |",
    "| clear    |       | clear terminal text                  |",
    "| color    | -h    | change text/background colors        |",
    "| reboot   |       | clear saved browser data             |",
    "+----------+-------+--------------------------------------+",
  ];
}

function getRender3dHelpLines() {
  return [
    "",
    "usage: render3d",
    "",
    "opens the figure selection screen.",
    "",
    "+----------------+-------------------+",
    "| Menu key       | Action            |",
    "+----------------+-------------------+",
    "| UP / DOWN      | choose figure     |",
    "| ENTER          | render            |",
    "| ESC            | return to shell   |",
    "+----------------+-------------------+",
    "",
    "+----------------+-------------------+",
    "| Figure input   | Action            |",
    "+----------------+-------------------+",
    "| LMB drag       | arcball rotate    |",
    "| RMB or MMB     | pan               |",
    "| Wheel          | zoom              |",
    "| Double LMB     | reset view        |",
    "| M              | open settings     |",
    "| ESC            | close or go back  |",
    "+----------------+-------------------+",
    "",
    "+----------------+-----------------------------------+",
    "| Light param    | Effect                            |",
    "+----------------+-----------------------------------+",
    "| l_yaw          | rotates light 0..360 around the   |",
    "|                | figure on the horizontal plane    |",
    "| l_pit          | tilts light from -90 to 90        |",
    "|                | degrees, bottom to top            |",
    "+----------------+-----------------------------------+",
    ""
  ];
}

function getColorHelpLines() {
  return [
    "",
    "usage: color <text> [background]",
    "",
    "changes terminal text color and optional background color.",
    "supported values:",
    "- green blue gray white black yellow red",
    "- #RRGGBB or #RGB",
    "",
    "examples:",
    "- color green",
    "- color #00ff00 #000000",
    ""
  ];
}

function clearShellScreen() {
  state.shellLines = [];
  state.commandInput = "";
  state.historyIndex = state.commandHistory.length;
  persistShellState();
}

function getSystemInfoLines() {
  const nav = window.navigator;
  const screenInfo = window.screen;
  const tz = safeTimeZone();
  const gpuInfo = getGpuInfo();
  const rows = [
    ["screen", `${screenInfo.width}x${screenInfo.height} px`],
    ["viewport", `${window.innerWidth}x${window.innerHeight} px`],
    ["language", nav.language || "unknown"],
    ["platform", nav.platform || "unknown"],
    ["timezone", tz],
    ["cpu cores", String(nav.hardwareConcurrency || "unknown")],
    ["memory", nav.deviceMemory ? `${nav.deviceMemory} GB` : "unknown"],
    ["touch", nav.maxTouchPoints ? `yes (${nav.maxTouchPoints})` : "no"],
    ["online", nav.onLine ? "yes" : "no"],
    ["user agent", nav.userAgent || "unknown"],
    ["gpu", gpuInfo.renderer || gpuInfo.vendor || "unavailable"]
  ];

  const keyWidth = Math.max(...rows.map(([key]) => key.length), 6);
  const valueWidth = Math.max(...rows.map(([, value]) => value.length), 12);
  const border = `+${"-".repeat(keyWidth + 2)}+${"-".repeat(valueWidth + 2)}+`;
  const lines = [
    border,
    `| ${"Field".padEnd(keyWidth, " ")} | ${"Value".padEnd(valueWidth, " ")} |`,
    border
  ];

  rows.forEach(([key, value]) => {
    lines.push(`| ${key.padEnd(keyWidth, " ")} | ${value.padEnd(valueWidth, " ")} |`);
  });

  lines.push(border);
  return lines;
}

function safeTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  } catch {
    return "unknown";
  }
}

function getGpuInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      return {};
    }

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      return {
        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      };
    }

    return {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER)
    };
  } catch {
    return {};
  }
}

function loadPersistedSettings() {
  const storedConsole = readStorageJson(STORAGE_KEYS.console);
  if (storedConsole && storedConsole.text && storedConsole.background) {
    applyConsoleColors(storedConsole.text, storedConsole.background);
  }

  const storedHistory = readStorageJson(STORAGE_KEYS.history);
  if (Array.isArray(storedHistory)) {
    state.commandHistory = storedHistory
      .filter((entry) => typeof entry === "string" && entry.trim())
      .slice(-COMMAND_HISTORY_LIMIT);
    state.historyIndex = state.commandHistory.length;
  }

  const storedShell = readStorageJson(STORAGE_KEYS.shell);
  if (storedShell && typeof storedShell === "object") {
    if (Array.isArray(storedShell.lines)) {
      state.shellLines = storedShell.lines
        .filter((line) => typeof line === "string")
        .slice(-Math.max(6, state.viewportRows - 3));
    }
    if (typeof storedShell.input === "string") {
      state.commandInput = storedShell.input;
    }
  }

  const storedUi = readStorageJson(STORAGE_KEYS.ui);
  if (storedUi && typeof storedUi === "object") {
    const savedMenuIndex = typeof storedUi.menuIndex === "number" ? Math.floor(storedUi.menuIndex) : 0;
    state.menuIndex = clamp(0, Math.max(0, figures.length - 1), savedMenuIndex);
    if (storedUi.mode === "menu") {
      state.mode = "menu";
    } else if (storedUi.mode === "render") {
      const savedFigureId = typeof storedUi.currentFigureId === "string" ? storedUi.currentFigureId : null;
      const figureExists = figures.some((figure) => figure.id === savedFigureId);
      if (figureExists) {
        state.mode = "render";
        state.currentFigureId = savedFigureId;
        state.settingsVisible = Boolean(storedUi.settingsVisible);
        const savedSliderIndex = typeof storedUi.sliderIndex === "number" ? Math.floor(storedUi.sliderIndex) : 0;
        const sliderCount = getCurrentFigure().sliders.length;
        state.sliderIndex = clamp(0, Math.max(0, sliderCount - 1), savedSliderIndex);
      }
    }
  }

  const storedFigures = readStorageJson(STORAGE_KEYS.figures);
  if (!storedFigures || typeof storedFigures !== "object") {
    return;
  }

  figures.forEach((figure) => {
    const savedFigure = storedFigures[figure.id];
    if (!savedFigure || typeof savedFigure !== "object") {
      return;
    }

      figure.sliders.forEach((slider) => {
        const savedValue = savedFigure[slider.id];
        if (typeof savedValue !== "number" || Number.isNaN(savedValue)) {
          return;
        }

      slider.value = clamp(slider.min, slider.max, normalizeSliderValue(slider.id, savedValue));
    });
  });
}

function persistConsoleSettings() {
  const colors = getConsoleColors();
  writeStorageJson(STORAGE_KEYS.console, colors);
}

function persistCommandHistory() {
  writeStorageJson(STORAGE_KEYS.history, state.commandHistory.slice(-COMMAND_HISTORY_LIMIT));
}

function persistShellState() {
  writeStorageJson(STORAGE_KEYS.shell, {
    lines: state.shellLines.slice(-SHELL_STATE_LINE_LIMIT),
    input: state.commandInput
  });
}

function persistUiState() {
  const persistedMode = state.mode === "render"
    ? "render"
    : state.mode === "menu"
      ? "menu"
      : "shell";

  writeStorageJson(STORAGE_KEYS.ui, {
    mode: persistedMode,
    menuIndex: state.menuIndex,
    currentFigureId: state.currentFigureId,
    settingsVisible: state.settingsVisible,
    sliderIndex: state.sliderIndex
  });
}

function persistFigureSettings() {
  const payload = {};
  figures.forEach((figure) => {
    payload[figure.id] = {};
    figure.sliders.forEach((slider) => {
      payload[figure.id][slider.id] = slider.value;
    });
  });
  writeStorageJson(STORAGE_KEYS.figures, payload);
}

function getConsoleColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue("--text").trim(),
    background: styles.getPropertyValue("--bg").trim()
  };
}

function applyConsoleColors(text, background) {
  document.documentElement.style.setProperty("--text", text);
  document.documentElement.style.setProperty("--bg", background);
}

function readStorageJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorageJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors and keep the terminal usable.
  }
}

function clearPersistedSettings() {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage errors and continue with reload.
  }
}

function rebootConsole() {
  clearPersistedSettings();
  window.location.reload();
}

function trimShellBuffer() {
  const maxLines = Math.max(6, state.viewportRows - 3);
  if (state.shellLines.length > maxLines) {
    state.shellLines = state.shellLines.slice(state.shellLines.length - maxLines);
  }
  persistShellState();
}

function handleMenuKeys(event) {
  if (event.key === "ArrowUp") {
    state.menuIndex = (state.menuIndex - 1 + figures.length) % figures.length;
    persistUiState();
    return;
  }

  if (event.key === "ArrowDown") {
    state.menuIndex = (state.menuIndex + 1) % figures.length;
    persistUiState();
    return;
  }

  if (event.key === "Enter") {
    startFigure(figures[state.menuIndex].id);
    return;
  }

  if (event.key === "Escape") {
    state.mode = "shell";
    state.currentFigureId = null;
    persistUiState();
  }
}

function handleRenderKeys(event) {
  const figure = getCurrentFigure();
  if (event.key === "m" || event.key === "M") {
    state.settingsVisible = !state.settingsVisible;
    persistUiState();
    return;
  }

  if (event.key === "Escape") {
    if (state.settingsVisible) {
      state.settingsVisible = false;
      persistUiState();
      return;
    }
    state.mode = "menu";
    state.currentFigureId = null;
    state.sliderIndex = 0;
    state.settingsVisible = false;
    persistUiState();
    return;
  }

  if (!state.settingsVisible) {
    return;
  }

  if (event.key === "ArrowUp") {
    state.sliderIndex = (state.sliderIndex - 1 + figure.sliders.length) % figure.sliders.length;
    persistUiState();
    return;
  }

  if (event.key === "ArrowDown") {
    state.sliderIndex = (state.sliderIndex + 1) % figure.sliders.length;
    persistUiState();
    return;
  }

  if (event.key === "ArrowLeft") {
    adjustSlider(figure.sliders[state.sliderIndex], -1);
    return;
  }

  if (event.key === "ArrowRight") {
    adjustSlider(figure.sliders[state.sliderIndex], 1);
  }
}

function startFigure(figureId) {
  state.currentFigureId = figureId;
  state.mode = "render";
  state.sliderIndex = 0;
  state.settingsVisible = false;
  persistUiState();
  resetView();
}

function resetView() {
  state.userQuat = quatIdentity();
  state.autoQuat = quatIdentity();
  state.panX = DEFAULT_VIEW_STATE.panX;
  state.panY = DEFAULT_VIEW_STATE.panY;
  state.zoom = DEFAULT_VIEW_STATE.zoom;
  state.userInteracting = false;
  state.autoRotateEnabled = true;
  state.autoRotateResumeAt = 0;
}

function pauseAutoRotate() {
  state.autoRotateEnabled = false;
}

function scheduleAutoRotateResume() {
  state.autoRotateEnabled = false;
  state.autoRotateResumeAt = performance.now() + AUTO_RESUME_MS;
}

function onPointerDown(event) {
  terminal.focus();
  if (state.mode !== "render") {
    return;
  }

  if (event.button === DRAG_BUTTON.ROTATE) {
    state.dragging = "rotate";
    state.userInteracting = true;
    state.dragVector = projectArcballVector(event.clientX, event.clientY);
    pauseAutoRotate();
    return;
  }

  if (event.button === DRAG_BUTTON.PAN_MIDDLE || event.button === DRAG_BUTTON.PAN_RIGHT) {
    state.dragging = "pan";
    state.userInteracting = true;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    pauseAutoRotate();
  }
}

function onPointerMove(event) {
  if (state.mode !== "render" || !state.dragging) {
    return;
  }

  if (state.dragging === "rotate") {
    const nextVector = projectArcballVector(event.clientX, event.clientY);
    const deltaQuat = quatFromVectors(nextVector, state.dragVector);
    state.userQuat = quatNormalize(quatMultiply(deltaQuat, state.userQuat));
    state.dragVector = nextVector;
    pauseAutoRotate();
    return;
  }

  const rect = terminal.getBoundingClientRect();
  const dx = event.clientX - state.lastPointerX;
  const dy = event.clientY - state.lastPointerY;
  const panFactor = state.zoom / Math.max(120, Math.min(rect.width, rect.height));
  state.panX += dx * panFactor * 0.75;
  state.panY -= dy * panFactor * 0.75;
  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
  pauseAutoRotate();
}

function onPointerUp() {
  if (state.dragging) {
    state.userInteracting = false;
    scheduleAutoRotateResume();
  }
  state.dragging = null;
  state.dragVector = null;
}

function onWheel(event) {
  if (state.mode !== "render") {
    return;
  }

  event.preventDefault();
  const delta = Math.sign(event.deltaY);
  state.zoom = clamp(3.2, 11.5, state.zoom + delta * 0.35);
  scheduleAutoRotateResume();
}

function onDoubleClick() {
  if (state.mode !== "render") {
    return;
  }

  resetView();
}

function projectArcballVector(clientX, clientY) {
  const rect = terminal.getBoundingClientRect();
  const size = Math.max(1, Math.min(rect.width, rect.height));
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = 1 - ((clientY - rect.top) / rect.height) * 2;
  const scaledX = (x * rect.width) / size;
  const scaledY = (y * rect.height) / size;
  const lengthSq = scaledX * scaledX + scaledY * scaledY;

  if (lengthSq > 1) {
    const invLength = 1 / Math.sqrt(lengthSq);
    return [scaledX * invLength, scaledY * invLength, 0];
  }

  return [scaledX, scaledY, Math.sqrt(1 - lengthSq)];
}

function adjustSlider(slider, direction) {
  slider.value = clamp(slider.min, slider.max, slider.value + slider.step * direction);
  persistFigureSettings();
}

function getCurrentFigure() {
  return getFigureById(state.currentFigureId) || figures[0];
}

function getSliderValue(id) {
  const slider = getSliderById(id);
  return slider ? slider.value : 0;
}

function getFigureById(figureId) {
  return figures.find((figure) => figure.id === figureId) || null;
}

function getSliderById(sliderId, figure = getCurrentFigure()) {
  return figure.sliders.find((slider) => slider.id === sliderId) || null;
}

function getLightDirection() {
  const yaw = (normalizeAngle360(getSliderValue("light_yaw")) * Math.PI) / 180;
  const pitch = (clamp(-90, 90, getSliderValue("light_pitch")) * Math.PI) / 180;
  const cosPitch = Math.cos(pitch);
  return normalizeVec3([
    -Math.sin(yaw) * cosPitch,
    -Math.sin(pitch),
    Math.cos(yaw) * cosPitch
  ]);
}

function getAmbientLight() {
  return clamp(0, 0.8, getSliderValue("ambient"));
}

function getSphereRenderResolution() {
  const resolution = getSliderValue("resolution");
  const sampleGrid = resolution >= 0.9 ? 3 : resolution >= 0.55 ? 2 : 1;
  return {
    sampleGrid,
    samples: createSubpixelOffsets(sampleGrid)
  };
}

function getTorusRenderResolution() {
  const resolution = getSliderValue("resolution");
  return {
    maxSteps: Math.round(42 + resolution * 74),
    surfaceEpsilon: 0.038 - resolution * 0.02,
    normalDelta: 0.045 - resolution * 0.018,
    stepScale: 0.78 + resolution * 0.1
  };
}

function getMobiusRenderResolution() {
  const resolution = getSliderValue("resolution");
  return {
    uSteps: Math.round(52 + resolution * 92),
    vSteps: Math.round(6 + resolution * 18),
    rasterResolution: 0.65 + resolution * 1.7
  };
}

function getMeshRenderResolution() {
  return getSliderValue("resolution") * 2;
}

function createSubpixelOffsets(sampleGrid) {
  const offsets = [];
  for (let y = 0; y < sampleGrid; y += 1) {
    for (let x = 0; x < sampleGrid; x += 1) {
      offsets.push([
        (x + 0.5) / sampleGrid,
        (y + 0.5) / sampleGrid
      ]);
    }
  }
  return offsets;
}

function getSceneQuaternion() {
  return quatNormalize(quatMultiply(state.userQuat, state.autoQuat));
}

function edgeFunction(a, b, c) {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

boot();
