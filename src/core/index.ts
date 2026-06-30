import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AMBIENT_COLOR_HIGH,
  AMBIENT_COLOR_LOW,
  applyUniformPatch,
  createAdditiveMaterial,
  createDefaultGlassUniforms,
  createDefaultOpaqueUniforms,
  createGlassMaterial,
  createOpaqueMaterial,
  createUniformStore,
  type ViewerUniformPatch,
  type ViewerUniformStore,
} from "./shaders";
import type { MeshData, MeshFile, PhysFile } from "../parser";

export type { ViewerUniformPatch, ViewerUniformValue } from "./shaders";

export type ViewerObjectId = string;
export type ViewerMaterialKind = "opaque" | "glass" | "additive";
export type ViewerUniformOverrides = Partial<Record<ViewerMaterialKind, ViewerUniformPatch>>;
export type ViewerObjectMatrix = THREE.Matrix4 | ArrayLike<number>;

export interface ViewerOptions {
  antialias?: boolean;
  alpha?: boolean;
  backgroundColor?: number | null;
  enableOrbitControls?: boolean;
  enableDamping?: boolean;
  autoRotate?: boolean;
}

export interface AddViewerObjectOptions {
  id: ViewerObjectId;
  name?: string;
  data: MeshData;
  matrix?: ViewerObjectMatrix;
  visible?: boolean;
  wireframe?: boolean;
  uniforms?: ViewerUniformOverrides;
}

export interface ViewerObjectState {
  id: ViewerObjectId;
  matrix?: ViewerObjectMatrix;
  visible?: boolean;
  wireframe?: boolean;
  uniforms?: ViewerUniformOverrides;
}

export interface ViewerObjectHandle {
  id: ViewerObjectId;
  name?: string;
  root: THREE.Object3D;
}

interface ViewerUniformStores {
  opaque: ViewerUniformStore;
  glass: ViewerUniformStore;
  additive: ViewerUniformStore;
}

interface ViewerObjectRecord {
  id: ViewerObjectId;
  name?: string;
  root: THREE.Object3D;
  meshes: THREE.Mesh[];
  materials: THREE.Material[];
  uniformStores: ViewerUniformStores;
}

interface CreatedObject {
  root: THREE.Object3D;
  meshes: THREE.Mesh[];
  materials: THREE.Material[];
  uniformStores: ViewerUniformStores;
}

export class Viewer {
  readonly canvas: HTMLCanvasElement;

  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly objects = new Map<ViewerObjectId, ViewerObjectRecord>();
  private backgroundColor: number | null;
  private controls?: OrbitControls;
  private renderLoopId?: number;
  private isUpdatingControls = false;

  constructor(canvas: HTMLCanvasElement, options?: ViewerOptions) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: options?.antialias ?? true,
      alpha: options?.alpha ?? true,
    });

    this.scene = new THREE.Scene();
    this.backgroundColor = options?.backgroundColor ?? 0x000000;

    if (this.backgroundColor !== null) {
      this.scene.background = new THREE.Color(this.backgroundColor);
    }

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, 1.5, 4);
    this.camera.lookAt(0, 0, 0);

    if (options?.enableOrbitControls ?? true) {
      const controls = new OrbitControls(this.camera, this.renderer.domElement);
      controls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      controls.enableDamping = options?.enableDamping ?? false;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.target.set(0, 0, 0);
      controls.autoRotate = options?.autoRotate ?? false;
      controls.addEventListener("change", () => {
        this.render();
      });
      this.controls = controls;
      this.updateControls();
      if (this.controls.enableDamping || this.controls.autoRotate) {
        this.startRenderLoop();
      }
    }

    const hemi = new THREE.HemisphereLight(AMBIENT_COLOR_HIGH, AMBIENT_COLOR_LOW, 1.6);
    const sun = new THREE.DirectionalLight(new THREE.Color(0.95, 0.95, 1.0), 1.0);
    sun.position.set(0.0, 1.0, -0.5);

    this.scene.add(hemi);
    this.scene.add(sun);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const pixelRatio =
      typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.render();
  }

  addObject(options: AddViewerObjectOptions): ViewerObjectId {
    const id = options.id;
    if (this.objects.has(id)) {
      throw new Error(`Viewer object already exists: ${id}`);
    }

    const created = this.createObjectFromMeshData(options.data, options.uniforms);
    created.root.name = options.name ?? id;
    created.root.visible = options.visible ?? true;
    created.root.matrixAutoUpdate = false;

    const record: ViewerObjectRecord = {
      id,
      name: options.name,
      root: created.root,
      meshes: created.meshes,
      materials: created.materials,
      uniformStores: created.uniformStores,
    };

    this.objects.set(id, record);
    this.scene.add(created.root);

    if (options.matrix) {
      this.setObjectMatrix(id, options.matrix, false);
    } else {
      created.root.updateMatrix();
    }

    if (options.wireframe !== undefined) {
      this.setObjectWireframe(id, options.wireframe, false);
    }

    this.render();
    return id;
  }

  removeObject(id: ViewerObjectId): void {
    const record = this.objects.get(id);
    if (!record) return;

    this.scene.remove(record.root);
    this.disposeObjectRecord(record);
    this.objects.delete(id);
    this.render();
  }

  clearObjects(): void {
    this.objects.forEach((record) => {
      this.scene.remove(record.root);
      this.disposeObjectRecord(record);
    });
    this.objects.clear();
    this.render();
  }

  getObject(id: ViewerObjectId): ViewerObjectHandle | undefined {
    const record = this.objects.get(id);
    if (!record) return undefined;

    return {
      id: record.id,
      name: record.name,
      root: record.root,
    };
  }

  applyObjectStates(states: ViewerObjectState[]): void {
    states.forEach((state) => {
      this.applyObjectState(state, false);
    });
    this.render();
  }

  applyObjectState(state: ViewerObjectState, shouldRender = true): void {
    if (state.matrix) {
      this.setObjectMatrix(state.id, state.matrix, false);
    }

    if (state.visible !== undefined) {
      this.setObjectVisible(state.id, state.visible, false);
    }

    if (state.wireframe !== undefined) {
      this.setObjectWireframe(state.id, state.wireframe, false);
    }

    if (state.uniforms) {
      this.setObjectUniforms(state.id, state.uniforms, false);
    }

    if (shouldRender) {
      this.render();
    }
  }

  setObjectMatrix(id: ViewerObjectId, matrix: ViewerObjectMatrix, shouldRender = true): void {
    const record = this.objects.get(id);
    if (!record) return;

    record.root.matrix.copy(this.toMatrix4(matrix));
    record.root.matrix.decompose(record.root.position, record.root.quaternion, record.root.scale);
    record.root.updateMatrixWorld(true);

    if (shouldRender) {
      this.render();
    }
  }

  setObjectVisible(id: ViewerObjectId, visible: boolean, shouldRender = true): void {
    const record = this.objects.get(id);
    if (!record) return;

    record.root.visible = visible;

    if (shouldRender) {
      this.render();
    }
  }

  setObjectWireframe(id: ViewerObjectId, enabled: boolean, shouldRender = true): void {
    const record = this.objects.get(id);
    if (!record) return;

    record.materials.forEach((material) => {
      if ("wireframe" in material) {
        material.wireframe = enabled;
      }
    });

    if (shouldRender) {
      this.render();
    }
  }

  setObjectUniforms(
    id: ViewerObjectId,
    uniforms: ViewerUniformOverrides,
    shouldRender = true,
  ): void {
    const record = this.objects.get(id);
    if (!record) return;

    if (uniforms.opaque) {
      applyUniformPatch(record.uniformStores.opaque, uniforms.opaque);
    }

    if (uniforms.glass) {
      applyUniformPatch(record.uniformStores.glass, uniforms.glass);
    }

    if (uniforms.additive) {
      applyUniformPatch(record.uniformStores.additive, uniforms.additive);
    }

    if (shouldRender) {
      this.render();
    }
  }

  resetCamera(): void {
    this.camera.position.set(0, 1.5, 4);
    this.camera.lookAt(0, 0, 0);
    this.controls?.target.set(0, 0, 0);
    this.updateControls();
    this.render();
  }

  setBackgroundColor(color: number | null): void {
    this.backgroundColor = color;

    if (color === null) {
      this.scene.background = null;
    } else {
      this.scene.background = new THREE.Color(color);
    }

    this.render();
  }

  setControlsEnabled(enabled: boolean): void {
    if (this.controls) {
      this.controls.enabled = enabled;
    }
  }

  render(): void {
    this.updateControls();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.stopRenderLoop();
    this.clearObjects();
    this.controls?.dispose();
    this.renderer.dispose();
  }

  private updateControls(): void {
    if (!this.controls || this.isUpdatingControls) return;

    this.isUpdatingControls = true;
    try {
      this.controls.update();
    } finally {
      this.isUpdatingControls = false;
    }
  }

  private startRenderLoop(): void {
    if (this.renderLoopId !== undefined || typeof window === "undefined") return;

    const tick = () => {
      this.render();
      this.renderLoopId = window.requestAnimationFrame(tick);
    };

    this.renderLoopId = window.requestAnimationFrame(tick);
  }

  private stopRenderLoop(): void {
    if (this.renderLoopId === undefined || typeof window === "undefined") return;

    window.cancelAnimationFrame(this.renderLoopId);
    this.renderLoopId = undefined;
  }

  private createObjectFromMeshData(
    mesh: MeshData,
    uniforms: ViewerUniformOverrides = {},
  ): CreatedObject {
    if (mesh.kind === "mesh") {
      return this.createRenderMesh(mesh, uniforms);
    }

    return this.createPhysMeshGroup(mesh, uniforms);
  }

  private createRenderMesh(mesh: MeshFile, uniforms: ViewerUniformOverrides): CreatedObject {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(mesh.vertices.length * 3);
    const normals = new Float32Array(mesh.vertices.length * 3);
    const colors = new Float32Array(mesh.vertices.length * 3);
    const indices = this.createReversedTriangleIndices(mesh.indices);
    const uniformStores = this.createUniformStores(uniforms);
    const materials = [
      createOpaqueMaterial(uniformStores.opaque),
      createGlassMaterial(uniformStores.glass),
      createAdditiveMaterial(uniformStores.additive),
    ];

    mesh.vertices.forEach((vertex, index) => {
      const offset = index * 3;
      positions[offset] = vertex.position.x;
      positions[offset + 1] = vertex.position.y;
      positions[offset + 2] = vertex.position.z;
      normals[offset] = vertex.normal.x;
      normals[offset + 1] = vertex.normal.y;
      normals[offset + 2] = vertex.normal.z;
      colors[offset] = vertex.color.r / 255;
      colors[offset + 1] = vertex.color.g / 255;
      colors[offset + 2] = vertex.color.b / 255;
    });

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    this.addSubmeshGroups(geometry, mesh);
    geometry.computeBoundingSphere();

    const root = new THREE.Mesh(geometry, materials);

    return {
      root,
      meshes: [root],
      materials,
      uniformStores,
    };
  }

  private createPhysMeshGroup(mesh: PhysFile, uniforms: ViewerUniformOverrides): CreatedObject {
    const group = new THREE.Group();
    const uniformStores = this.createUniformStores(uniforms);
    const material = createOpaqueMaterial(uniformStores.opaque);
    const meshes: THREE.Mesh[] = [];

    mesh.subPhysMeshes.forEach((submesh) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(submesh.vertices.length * 3);

      submesh.vertices.forEach((vertex, index) => {
        const offset = index * 3;
        positions[offset] = vertex.x;
        positions[offset + 1] = vertex.y;
        positions[offset + 2] = vertex.z;
      });

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(this.createReversedTriangleIndices(submesh.indices));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();

      const child = new THREE.Mesh(geometry, material);
      meshes.push(child);
      group.add(child);
    });

    return {
      root: group,
      meshes,
      materials: [material],
      uniformStores,
    };
  }

  private createUniformStores(uniforms: ViewerUniformOverrides): ViewerUniformStores {
    const opaque = createUniformStore(createDefaultOpaqueUniforms());
    const glass = createUniformStore(createDefaultGlassUniforms());
    const additive = createUniformStore();

    applyUniformPatch(opaque, uniforms.opaque);
    applyUniformPatch(glass, uniforms.glass);
    applyUniformPatch(additive, uniforms.additive);

    return { opaque, glass, additive };
  }

  private disposeObjectRecord(record: ViewerObjectRecord): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    record.meshes.forEach((mesh) => {
      geometries.add(mesh.geometry);
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => materials.add(item));
      } else {
        materials.add(material);
      }
    });

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  private createReversedTriangleIndices(indices: number[]): number[] {
    const reversed = indices.slice();

    for (let i = 0; i + 2 < reversed.length; i += 3) {
      const next = reversed[i + 1];
      reversed[i + 1] = reversed[i + 2] ?? next;
      reversed[i + 2] = next;
    }

    return reversed;
  }

  private addSubmeshGroups(geometry: THREE.BufferGeometry, mesh: MeshFile): void {
    geometry.clearGroups();

    if (mesh.submeshes.length === 0) {
      geometry.addGroup(0, mesh.indices.length, 0);
      return;
    }

    mesh.submeshes.forEach((submesh) => {
      geometry.addGroup(
        submesh.indexBufferStart,
        submesh.indexBufferLength,
        this.getMaterialIndexForShaderId(submesh.shaderId),
      );
    });
  }

  private getMaterialIndexForShaderId(shaderId: number): number {
    if (shaderId === 1) return 1;
    if (shaderId === 2) return 2;
    return 0;
  }

  private toMatrix4(matrix: ViewerObjectMatrix): THREE.Matrix4 {
    if (matrix instanceof THREE.Matrix4) {
      return matrix;
    }

    if (matrix.length !== 16) {
      throw new Error("Viewer object matrix must have 16 elements");
    }

    return new THREE.Matrix4().fromArray(Array.from(matrix));
  }
}
