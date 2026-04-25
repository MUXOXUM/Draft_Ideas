export function dotVec3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function crossVec3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

export function normalizeVec3(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

export function scaleVec3(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

export function subVec3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function addVec3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function clamp(min, max, value) {
  return Math.min(max, Math.max(min, value));
}

export function formatSigned(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function quatIdentity() {
  return [0, 0, 0, 1];
}

export function quatMultiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}

export function quatNormalize(q) {
  const length = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

export function quatFromAxisAngle(axis, angle) {
  const unit = normalizeVec3(axis);
  const half = angle * 0.5;
  const sinHalf = Math.sin(half);
  return quatNormalize([
    unit[0] * sinHalf,
    unit[1] * sinHalf,
    unit[2] * sinHalf,
    Math.cos(half)
  ]);
}

export function quatFromVectors(from, to) {
  const a = normalizeVec3(from);
  const b = normalizeVec3(to);
  const dot = clamp(-1, 1, dotVec3(a, b));

  if (dot < -0.999999) {
    const axis = normalizeVec3(Math.abs(a[0]) < 0.9 ? crossVec3(a, [1, 0, 0]) : crossVec3(a, [0, 1, 0]));
    return quatFromAxisAngle(axis, Math.PI);
  }

  const cross = crossVec3(a, b);
  return quatNormalize([cross[0], cross[1], cross[2], 1 + dot]);
}

export function quatRotateVec3(q, v) {
  const x = v[0];
  const y = v[1];
  const z = v[2];
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];

  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx
  ];
}
