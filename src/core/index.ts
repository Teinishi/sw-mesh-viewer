import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { MeshData } from "../parser";

const AMBIENT_COLOR_HIGH = new THREE.Color(118.0 / 255.0, 142.0 / 255.0, 190.0 / 255.0);
const AMBIENT_COLOR_LOW = new THREE.Color(11.0 / 255.0, 16.0 / 255.0, 44.0 / 255.0);
const SKY_COLOR_UP = new THREE.Color(0.0, 61.0 / 255.0, 182.0 / 255.0);
const SKY_COLOR_DOWN = new THREE.Color(139.0 / 255.0, 210.0 / 255.0, 207.0 / 255.0);

export interface ViewerOptions {
  antialias?: boolean;
  alpha?: boolean;
  backgroundColor?: number | null;
  enableOrbitControls?: boolean;
  enableDamping?: boolean;
  autoRotate?: boolean;
}

export class Viewer {
  readonly canvas: HTMLCanvasElement;

  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private meshObject?: THREE.Object3D;
  private wireframe = false;
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
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = options?.enableDamping ?? true;
      this.controls.dampingFactor = 0.08;
      this.controls.enablePan = true;
      this.controls.enableZoom = true;
      this.controls.enableRotate = true;
      this.controls.target.set(0, 0, 0);
      this.controls.autoRotate = options?.autoRotate ?? false;
      this.controls.addEventListener("change", () => {
        this.render();
      });
      this.updateControls();

      if (this.controls.enableDamping || this.controls.autoRotate) {
        this.startRenderLoop();
      }
    }

    // 環境光
    const hemi = new THREE.HemisphereLight(AMBIENT_COLOR_HIGH, AMBIENT_COLOR_LOW, 1.6);
    const sun = new THREE.DirectionalLight(new THREE.Color(0.95, 0.95, 1.0), 2.2);
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

  loadMesh(mesh: MeshData | null | undefined): void {
    void mesh;
    this.clear();

    // 仮で立方体
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array([].concat(...Array(24).fill([1.0, 0.494, 0.0]))),
        3,
      ),
    );

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: 0xffffff,
      roughness: 1.0,
      metalness: 0.0,
      wireframe: this.wireframe,
    });

    material.onBeforeCompile = (shader) => {
      // 特定の頂点カラーを置き換える
      shader.uniforms.overrideColor1 = { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) };
      shader.uniforms.overrideColor2 = { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) };
      shader.uniforms.overrideColor3 = { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) };
      shader.uniforms.overrideColor = { value: 1 };

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
uniform vec4 overrideColor1;
uniform vec4 overrideColor2;
uniform vec4 overrideColor3;
uniform int overrideColor;`,
        )
        .replace(
          "#include <color_vertex>",
          `#ifdef USE_COLOR
vColor.xyz = color.xyz;
if (overrideColor == 1) {
  if (distance(color.rgb, vec3(1.0, 0.494, 0.0)) < 0.01) vColor = overrideColor1;
  else if (distance(color.rgb, vec3(0.608, 0.494, 0.0)) < 0.01) vColor = overrideColor2;
  else if (distance(color.rgb, vec3(0.216, 0.494, 0.0)) < 0.01) vColor = overrideColor3;
}
#endif`,
        );

      // カメラ至近の補助ライト
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
float dist = length(vViewPosition);
float incidence = max(dot(geometryNormal, geometryViewDir), 0.0);
float distanceFactor = 0.05 * (1.0 / max(0.01, dist) - 1.0 / 100.0);
reflectedLight.directDiffuse += diffuseColor.rgb * incidence * distanceFactor * 16.0;`,
      );
    };

    this.meshObject = new THREE.Mesh(geometry, material);
    this.meshObject.position.set(0, 0, 0);
    this.scene.add(this.meshObject);

    this.resetCamera();
    this.render();
  }

  clear(): void {
    if (!this.meshObject) return;

    this.scene.remove(this.meshObject);
    this.meshObject = undefined;
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

    if (this.meshObject instanceof THREE.Mesh) {
      const material = this.meshObject.material;

      if (Array.isArray(material)) {
        material.forEach((entry) => {
          if (entry instanceof THREE.MeshStandardMaterial) {
            entry.wireframe = enabled;
          }
        });
      } else if (material instanceof THREE.MeshStandardMaterial) {
        material.wireframe = enabled;
      }
    }

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
}
