import * as THREE from "three";
import type { MeshData, MeshFile, PhysFile } from "../parser";
import { createStormworksMaterials, type StormworksMaterialSet } from "./materials";

/** Options shared by helpers that create Three.js objects from parsed Stormworks data. */
export interface CreateStormworksObjectOptions {
  /** Optional display name assigned to the root Three.js object. */
  name?: string;
  /** Materials used by the created object. Defaults to a fresh material set. */
  materials?: StormworksMaterialSet;
}

/** Options used when creating a render mesh object from parsed `mesh` data. */
export interface CreateStormworksMeshOptions {
  /** Optional display name assigned to the created mesh. */
  name?: string;
  /** Materials used for opaque, glass, and additive submeshes. */
  materials?: StormworksMaterialSet;
}

/** Options used when creating a physics mesh group from parsed `phys` data. */
export interface CreateStormworksPhysMeshOptions {
  /** Optional display name assigned to the created group. */
  name?: string;
  /** Material set whose `phys` material is used for each child mesh. */
  materials?: StormworksMaterialSet;
}

/**
 * Create a Three.js object from parsed Stormworks mesh-related data.
 *
 * Render mesh files become a single `THREE.Mesh`. Physics mesh files become a
 * `THREE.Group` containing one mesh per physics section.
 */
export function createStormworksObject(
  data: MeshData,
  options: CreateStormworksObjectOptions = {},
): THREE.Object3D {
  if (data.kind === "mesh") {
    return createStormworksMesh(data, options);
  }

  return createStormworksPhysMeshGroup(data, options);
}

/**
 * Create a renderable Three.js mesh from parsed Stormworks `mesh` data.
 *
 * The returned mesh owns its geometry. It uses material groups mapped from the
 * file's submesh shader ids: opaque, glass, and additive.
 */
export function createStormworksMesh(
  mesh: MeshFile,
  options: CreateStormworksMeshOptions = {},
): THREE.Mesh<THREE.BufferGeometry, THREE.Material[]> {
  const geometry = createStormworksMeshGeometry(mesh);
  const materials = options.materials ?? createStormworksMaterials();
  const object = new THREE.Mesh(geometry, [materials.opaque, materials.glass, materials.additive]);

  object.name = options.name ?? "";
  return object;
}

/**
 * Create a Three.js group from parsed Stormworks `phys` data.
 *
 * Each physics section becomes a child mesh using the `phys` material from the
 * supplied material set.
 */
export function createStormworksPhysMeshGroup(
  mesh: PhysFile,
  options: CreateStormworksPhysMeshOptions = {},
): THREE.Group {
  const group = new THREE.Group();
  const materials = options.materials ?? createStormworksMaterials();

  group.name = options.name ?? "";

  mesh.subPhysMeshes.forEach((submesh) => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(submesh.vertices.length * 3);

    submesh.vertices.forEach((vertex, index) => {
      const offset = index * 3;
      positions[offset] = vertex.x;
      positions[offset + 1] = vertex.y;
      positions[offset + 2] = -vertex.z;
    });

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(
      submesh.indices.length > 0
        ? submesh.indices
        : createFallbackTriangleIndices(submesh.vertices.length),
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    group.add(new THREE.Mesh(geometry, materials.phys));
  });

  return group;
}

/**
 * Create buffer geometry for parsed Stormworks render mesh data.
 *
 * The geometry includes `position`, `normal`, and `color` attributes, reversed
 * triangle winding, and material groups derived from submesh shader ids.
 */
export function createStormworksMeshGeometry(mesh: MeshFile): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(mesh.vertices.length * 3);
  const normals = new Float32Array(mesh.vertices.length * 3);
  const colors = new Float32Array(mesh.vertices.length * 3);

  mesh.vertices.forEach((vertex, index) => {
    const offset = index * 3;
    positions[offset] = vertex.position.x;
    positions[offset + 1] = vertex.position.y;
    positions[offset + 2] = -vertex.position.z;
    normals[offset] = vertex.normal.x;
    normals[offset + 1] = vertex.normal.y;
    normals[offset + 2] = -vertex.normal.z;
    colors[offset] = vertex.color.r / 255;
    colors[offset + 1] = vertex.color.g / 255;
    colors[offset + 2] = vertex.color.b / 255;
  });

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(mesh.indices);
  addSubmeshGroups(geometry, mesh);
  geometry.computeBoundingSphere();

  return geometry;
}

function createFallbackTriangleIndices(vertexCount: number): number[] {
  return Array.from({ length: vertexCount }, (_, index) => index);
}

function addSubmeshGroups(geometry: THREE.BufferGeometry, mesh: MeshFile): void {
  geometry.clearGroups();

  if (mesh.submeshes.length === 0) {
    geometry.addGroup(0, mesh.indices.length, 0);
    return;
  }

  mesh.submeshes.forEach((submesh) => {
    geometry.addGroup(
      submesh.indexBufferStart,
      submesh.indexBufferLength,
      getMaterialIndexForShaderId(submesh.shaderId),
    );
  });
}

function getMaterialIndexForShaderId(shaderId: number): number {
  if (shaderId === 1) return 1;
  if (shaderId === 2) return 2;
  return 0;
}
