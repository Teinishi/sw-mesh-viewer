import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AMBIENT_COLOR_HIGH,
  AMBIENT_COLOR_LOW,
  createAdditiveMaterial,
  createGlassMaterial,
  createOpaqueMaterial,
} from "./shaders";
import type { MeshData, MeshFile, PhysFile } from "../parser";

export interface ViewerOptions {
  antialias?: boolean;
  alpha?: boolean;
  backgroundColor?: number | null;
  enableOrbitControls?: boolean;
  enableDamping?: boolean;
  autoRotate?: boolean;
}

export interface ViewerMeshEntry {
  id?: string;
  name?: string;
  data: MeshData;
  visible?: boolean;
}

export interface LoadMeshesOptions {
  resetCamera?: boolean;
}

export class Viewer {
  readonly canvas: HTMLCanvasElement;

  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private meshObjects: THREE.Object3D[] = [];
  private wireframe = false; // TODO: 消すか残すか検討
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

    // マウスコントロール
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

    // 環境光
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

  render(): void {
    this.updateControls();
    this.renderer.render(this.scene, this.camera);
  }

  loadMesh(mesh: MeshData): void {
    this.loadMeshes([{ data: mesh, visible: true }], { resetCamera: true });
  }

  loadMeshes(meshes: ViewerMeshEntry[], options?: LoadMeshesOptions): void {
    this.clear();

    const visibleMeshes = meshes.filter((mesh) => mesh.visible !== false);
    visibleMeshes.forEach((mesh, index) => {
      const object = this.createObjectFromMeshData(mesh.data);
      object.name = mesh.name ?? mesh.id ?? `mesh-${index + 1}`;
      object.position.x += (index - (visibleMeshes.length - 1) / 2) * 1.35;
      this.applyWireframe(object, this.wireframe);
      this.meshObjects.push(object);
      this.scene.add(object);
    });

    if (options?.resetCamera ?? true) {
      this.resetCamera();
    }
    this.render();
  }

  clear(): void {
    if (this.meshObjects.length === 0) return;

    this.meshObjects.forEach((object) => {
      this.scene.remove(object);
      object.traverse((entry) => {
        if (!(entry instanceof THREE.Mesh)) return;

        entry.geometry.dispose();
        const material = entry.material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material.dispose();
        }
      });
    });
    this.meshObjects = [];
  }

  resetCamera(): void {
    this.camera.position.set(0, 1.5, 4);
    this.camera.lookAt(0, 0, 0);
    this.controls?.target.set(0, 0, 0);
    this.updateControls();
    this.render();
  }

  setWireframe(enabled: boolean): void {
    this.wireframe = enabled;

    this.meshObjects.forEach((object) => this.applyWireframe(object, enabled));

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

  dispose(): void {
    this.stopRenderLoop();
    this.clear();
    this.controls?.dispose();
    this.renderer.dispose();
  }

  private createObjectFromMeshData(mesh: MeshData): THREE.Object3D {
    if (mesh.kind === "mesh") {
      return this.createRenderMesh(mesh);
    }

    return this.createPhysMeshGroup(mesh);
  }

  private createRenderMesh(mesh: MeshFile): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(mesh.vertices.length * 3);
    const normals = new Float32Array(mesh.vertices.length * 3);
    const colors = new Float32Array(mesh.vertices.length * 3);
    const indices = this.createReversedTriangleIndices(mesh.indices);

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

    return new THREE.Mesh(geometry, [
      createOpaqueMaterial(),
      createGlassMaterial(),
      createAdditiveMaterial(),
    ]);
  }

  private createPhysMeshGroup(mesh: PhysFile): THREE.Group {
    const group = new THREE.Group();

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

      group.add(new THREE.Mesh(geometry, createOpaqueMaterial()));
    });

    return group;
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

  private applyWireframe(object: THREE.Object3D, enabled: boolean): void {
    object.traverse((entry) => {
      if (!(entry instanceof THREE.Mesh)) return;

      const material = entry.material;
      if (Array.isArray(material)) {
        material.forEach((item) => {
          if ("wireframe" in item) {
            item.wireframe = enabled;
          }
        });
      } else if ("wireframe" in material) {
        material.wireframe = enabled;
      }
    });
  }
}
