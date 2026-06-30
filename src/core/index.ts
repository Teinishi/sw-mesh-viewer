import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AMBIENT_COLOR_HIGH,
  AMBIENT_COLOR_LOW,
  //createAdditiveMaterial,
  //createGlassMaterial,
  createOpaqueMaterial,
} from "./shaders";

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

  loadMesh(mesh: null | undefined): void {
    void mesh;
    this.clear();

    // TODO: 仮で立方体を表示しているが、mesh を読み込むようにする
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    // 立方体の全頂点に仮の色を割り当て
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array([].concat(...Array(24).fill([1.0, 0.494, 0.0]))),
        3,
      ),
    );

    const material = createOpaqueMaterial();

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
