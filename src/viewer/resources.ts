import * as THREE from "three";

/** Geometry and material resources collected from a Three.js object tree. */
export interface StormworksObjectResources {
  /** Unique buffer geometries referenced by mesh descendants. */
  geometries: THREE.BufferGeometry[];
  /** Unique materials referenced by mesh descendants. */
  materials: THREE.Material[];
}

/** Options that control which resources are disposed from an object tree. */
export interface DisposeStormworksObjectOptions {
  /** Dispose collected geometries. Defaults to `true`. */
  disposeGeometry?: boolean;
  /** Dispose collected materials. Defaults to `true`. */
  disposeMaterial?: boolean;
}

/**
 * Collect unique geometries and materials from all mesh descendants.
 *
 * This helper does not dispose anything; use it when your application needs to
 * inspect or dispose resources with custom ownership rules.
 */
export function collectStormworksObjectResources(
  object: THREE.Object3D,
): StormworksObjectResources {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    geometries.add(child.geometry);

    const material = child.material;
    if (Array.isArray(material)) {
      material.forEach((item) => materials.add(item));
    } else {
      materials.add(material);
    }
  });

  return {
    geometries: Array.from(geometries),
    materials: Array.from(materials),
  };
}

/**
 * Dispose geometries and materials referenced by a Stormworks object tree.
 *
 * Disable material disposal when the object uses materials that are shared with
 * other objects or owned by the calling application.
 */
export function disposeStormworksObject(
  object: THREE.Object3D,
  options: DisposeStormworksObjectOptions = {},
): void {
  const { geometries, materials } = collectStormworksObjectResources(object);
  const disposeGeometry = options.disposeGeometry ?? true;
  const disposeMaterial = options.disposeMaterial ?? true;

  if (disposeGeometry) {
    geometries.forEach((geometry) => geometry.dispose());
  }

  if (disposeMaterial) {
    materials.forEach((material) => material.dispose());
  }
}
