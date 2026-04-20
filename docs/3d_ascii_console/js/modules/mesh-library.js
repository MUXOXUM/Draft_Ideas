import { addVec3, crossVec3, dotVec3, normalizeVec3, scaleVec3, subVec3 } from "./math3d.js";

function getMeshCentroid(vertices) {
  if (vertices.length === 0) {
    return [0, 0, 0];
  }

  const sum = vertices.reduce((acc, vertex) => addVec3(acc, vertex), [0, 0, 0]);
  return scaleVec3(sum, 1 / vertices.length);
}

function orientMeshFacesOutward(mesh) {
  const reference = getMeshCentroid(mesh.vertices);
  const faces = mesh.faces.map((face) => {
    const a = mesh.vertices[face[0]];
    const b = mesh.vertices[face[1]];
    const c = mesh.vertices[face[2]];
    const normal = crossVec3(subVec3(b, a), subVec3(c, a));
    const center = scaleVec3(addVec3(addVec3(a, b), c), 1 / 3);
    const direction = subVec3(center, reference);
    return dotVec3(normal, direction) >= 0 ? face : [face[0], face[2], face[1]];
  });

  return { ...mesh, faces };
}

function createCubeMesh() {
  const vertices = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1]
  ];

  const faces = [
    [0, 2, 1], [0, 3, 2],
    [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4],
    [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6],
    [3, 0, 4], [3, 4, 7]
  ];

  return orientMeshFacesOutward({ vertices, faces });
}

function createOctahedronMesh() {
  const vertices = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  ];

  const faces = [
    [0, 2, 4],
    [4, 2, 1],
    [1, 2, 5],
    [5, 2, 0],
    [4, 3, 0],
    [1, 3, 4],
    [5, 3, 1],
    [0, 3, 5]
  ];

  return { vertices, faces };
}

function createSphereMesh() {
  const latSteps = 18;
  const lonSteps = 28;
  const vertices = [];
  const faces = [];

  for (let lat = 0; lat <= latSteps; lat += 1) {
    const theta = (lat / latSteps) * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon < lonSteps; lon += 1) {
      const phi = (lon / lonSteps) * Math.PI * 2;
      vertices.push([
        sinTheta * Math.cos(phi),
        cosTheta,
        sinTheta * Math.sin(phi)
      ]);
    }
  }

  for (let lat = 0; lat < latSteps; lat += 1) {
    for (let lon = 0; lon < lonSteps; lon += 1) {
      const nextLon = (lon + 1) % lonSteps;
      const a = lat * lonSteps + lon;
      const b = lat * lonSteps + nextLon;
      const c = (lat + 1) * lonSteps + lon;
      const d = (lat + 1) * lonSteps + nextLon;

      if (lat > 0) {
        faces.push([a, c, b]);
      }
      if (lat < latSteps - 1) {
        faces.push([b, c, d]);
      }
    }
  }

  return orientMeshFacesOutward({ vertices, faces });
}

function createMobiusStripMesh() {
  const uSteps = 52;
  const vSteps = 12;
  const vertices = [];
  const faces = [];

  for (let uIndex = 0; uIndex < uSteps; uIndex += 1) {
    const u = (uIndex / uSteps) * Math.PI * 2;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    const cosHalfU = Math.cos(u * 0.5);
    const sinHalfU = Math.sin(u * 0.5);

    for (let vIndex = 0; vIndex <= vSteps; vIndex += 1) {
      const v = -0.42 + (vIndex / vSteps) * 0.84;
      const radius = 1 + v * cosHalfU;
      vertices.push([
        radius * cosU,
        v * sinHalfU * 1.15,
        radius * sinU
      ]);
    }
  }

  for (let uIndex = 0; uIndex < uSteps; uIndex += 1) {
    const nextU = (uIndex + 1) % uSteps;
    for (let vIndex = 0; vIndex < vSteps; vIndex += 1) {
      const a = uIndex * (vSteps + 1) + vIndex;
      const b = a + 1;
      const nextVIndex = nextU === 0 ? vSteps - vIndex : vIndex;
      const c = nextU * (vSteps + 1) + nextVIndex;
      const d = c + (nextU === 0 ? -1 : 1);
      faces.push([a, c, b]);
      faces.push([b, c, d]);
    }
  }

  return { vertices, faces, doubleSided: true };
}

function createStarPolyhedronMesh() {
  const vertices = [
    [0, 0, 1.7],
    [0, 0, -1.7],
    [1.7, 0, 0],
    [-1.7, 0, 0],
    [0, 1.7, 0],
    [0, -1.7, 0],
    [0.55, 0.55, 0.55],
    [0.55, 0.55, -0.55],
    [0.55, -0.55, 0.55],
    [0.55, -0.55, -0.55],
    [-0.55, 0.55, 0.55],
    [-0.55, 0.55, -0.55],
    [-0.55, -0.55, 0.55],
    [-0.55, -0.55, -0.55]
  ];

  const faces = [
    [0, 6, 8], [0, 8, 12], [0, 12, 10], [0, 10, 6],
    [1, 9, 7], [1, 13, 9], [1, 11, 13], [1, 7, 11],
    [2, 6, 7], [2, 7, 9], [2, 9, 8], [2, 8, 6],
    [3, 11, 10], [3, 13, 11], [3, 12, 13], [3, 10, 12],
    [4, 10, 11], [4, 11, 7], [4, 7, 6], [4, 6, 10],
    [5, 8, 9], [5, 9, 13], [5, 13, 12], [5, 12, 8]
  ];

  return orientMeshFacesOutward({ vertices, faces });
}

function createIcosahedronMesh() {
  const phi = (1 + Math.sqrt(5)) * 0.5;
  const vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
  ].map(normalizeVec3);

  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];

  return orientMeshFacesOutward({ vertices, faces });
}

export const meshLibrary = {
  cube: createCubeMesh(),
  octahedron: createOctahedronMesh(),
  sphere: createSphereMesh(),
  mobius_strip: createMobiusStripMesh(),
  star_polyhedron: createStarPolyhedronMesh(),
  icosahedron: createIcosahedronMesh()
};
