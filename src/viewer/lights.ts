import * as THREE from "three";
import { AMBIENT_COLOR_HIGH, AMBIENT_COLOR_LOW } from "./shaders";

/** Options used when creating the default Stormworks-style lights. */
export interface CreateStormworksLightsOptions {
  /** Intensity of the hemisphere light. Defaults to `1.6`. */
  hemisphereIntensity?: number;
  /** Intensity of the directional light. Defaults to `1.0`. */
  directionalIntensity?: number;
}

/**
 * Create the default Stormworks-style light objects.
 *
 * The returned array contains a hemisphere light and a directional light. Add
 * them to your scene, group, or TresJS primitive as needed.
 */
export function createStormworksLights(
  options: CreateStormworksLightsOptions = {},
): THREE.Object3D[] {
  const hemi = new THREE.HemisphereLight(
    AMBIENT_COLOR_HIGH,
    AMBIENT_COLOR_LOW,
    options.hemisphereIntensity ?? 1.6,
  );
  const sun = new THREE.DirectionalLight(
    new THREE.Color(0.95, 0.95, 1.0),
    options.directionalIntensity ?? 1.6,
  );

  sun.position.set(0.0, 1.0, -0.5);
  return [hemi, sun];
}

/** Create a group containing the default Stormworks-style lights. */
export function createStormworksLightGroup(
  options: CreateStormworksLightsOptions = {},
): THREE.Group {
  const group = new THREE.Group();

  createStormworksLights(options).forEach((light) => {
    group.add(light);
  });

  return group;
}
