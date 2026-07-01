import * as THREE from "three";

/** A supported runtime value that can be assigned to shader uniforms. */
export type ViewerUniformValue =
  | { type: "int"; value: number }
  | { type: "vec3"; value: [number, number, number] | THREE.Vector3 | THREE.Color }
  | { type: "vec4"; value: [number, number, number, number] | THREE.Vector4 };

/** A named collection of uniform values to apply to a material family. */
export type ViewerUniformPatch = Record<string, ViewerUniformValue>;

/** Mutable Three.js uniform references used by viewer-owned materials. */
export type ViewerUniformStore = Record<string, THREE.IUniform>;

/** Upper hemisphere light color used by the default viewer lighting. */
export const AMBIENT_COLOR_HIGH = new THREE.Color(118.0 / 255.0, 142.0 / 255.0, 190.0 / 255.0);

/** Lower hemisphere light color used by the default viewer lighting. */
export const AMBIENT_COLOR_LOW = new THREE.Color(11.0 / 255.0, 16.0 / 255.0, 44.0 / 255.0);
const SKY_COLOR_UP = new THREE.Color(0.0, 61.0 / 255.0, 182.0 / 255.0);
const SKY_COLOR_DOWN = new THREE.Color(139.0 / 255.0, 210.0 / 255.0, 207.0 / 255.0);

const GLASS_VERTEX_SHADER = /* glsl */ `
out vec3 vWorldPosition;
out vec3 vWorldNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLASS_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 skyColorUp;
uniform vec3 skyColorDown;

in vec3 vWorldPosition;
in vec3 vWorldNormal;

void main() {
  vec3 cameraToFragment = normalize(vWorldPosition - cameraPosition);
  vec3 reflectedDir = reflect(cameraToFragment, normalize(vWorldNormal));

  float reflectionFactor = max(0.0, -dot(vWorldNormal, cameraToFragment));
  reflectionFactor = pow(1.0 - reflectionFactor, 5.0);
  reflectionFactor = clamp(reflectionFactor, 0.0, 1.0);

  float angleFactor = reflectedDir.y * 0.5 + 0.5;
  vec3 skyColor = mix(skyColorDown, skyColorUp, angleFactor);

  gl_FragColor = vec4(skyColor * reflectionFactor * 0.823, 0.0);
}
`;

/** Create mutable Three.js uniforms from typed viewer uniform values. */
export function createUniformStore(defaults: ViewerUniformPatch = {}): ViewerUniformStore {
  const store: ViewerUniformStore = {};

  applyUniformPatch(store, defaults);

  return store;
}

/** Apply typed uniform values to an existing uniform store. */
export function applyUniformPatch(store: ViewerUniformStore, patch: ViewerUniformPatch = {}): void {
  Object.entries(patch).forEach(([name, uniform]) => {
    const value = createUniformRuntimeValue(uniform);
    if (store[name]) {
      store[name].value = value;
    } else {
      store[name] = { value };
    }
  });
}

/** Create the default uniform values used by opaque mesh materials. */
export function createDefaultOpaqueUniforms(): ViewerUniformPatch {
  return {
    overrideColor1: { type: "vec4", value: [1.0, 1.0, 1.0, 1.0] },
    overrideColor2: { type: "vec4", value: [1.0, 1.0, 1.0, 1.0] },
    overrideColor3: { type: "vec4", value: [1.0, 1.0, 1.0, 1.0] },
    overrideColor: { type: "int", value: 1 },
  };
}

/** Create the default uniform values used by glass mesh materials. */
export function createDefaultGlassUniforms(): ViewerUniformPatch {
  return {
    skyColorUp: {
      type: "vec3",
      value: SKY_COLOR_UP,
    },
    skyColorDown: {
      type: "vec3",
      value: SKY_COLOR_DOWN,
    },
  };
}

/** Create the default opaque material used for shaderId 0 submeshes. */
export function createOpaqueMaterial(uniforms = createUniformStore(createDefaultOpaqueUniforms())) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
uniform vec4 overrideColor1;
uniform vec4 overrideColor2;
uniform vec4 overrideColor3;
uniform int overrideColor;`,
      )
      .replace(
        "#include <color_vertex>",
        /* glsl */ `#ifdef USE_COLOR
vColor.xyz = color.xyz;
if (overrideColor == 1) {
  if (distance(color.rgb, vec3(1.0, 0.494, 0.0)) < 0.01) vColor = overrideColor1;
  else if (distance(color.rgb, vec3(0.608, 0.494, 0.0)) < 0.01) vColor = overrideColor2;
  else if (distance(color.rgb, vec3(0.216, 0.494, 0.0)) < 0.01) vColor = overrideColor3;
}
#endif`,
      );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <aomap_fragment>",
      /* glsl */ `#include <aomap_fragment>
float dist = length(vViewPosition);
float incidence = max(dot(geometryNormal, geometryViewDir), 0.0);
float distanceFactor = 0.05 * (1.0 / max(0.01, dist) - 1.0 / 100.0);
reflectedLight.directDiffuse += diffuseColor.rgb * incidence * distanceFactor * 16.0;`,
    );
  };

  return material;
}

/** Create the default glass material used for shaderId 1 submeshes. */
export function createGlassMaterial(uniforms = createUniformStore(createDefaultGlassUniforms())) {
  return new THREE.ShaderMaterial({
    vertexShader: GLASS_VERTEX_SHADER,
    fragmentShader: GLASS_FRAGMENT_SHADER,
    uniforms: { ...uniforms },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
  });
}

/** Create the default additive material used for shaderId 2 submeshes. */
export function createAdditiveMaterial(uniforms = createUniformStore()) {
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
  };

  return material;
}

/** Create the material used for phys files. */
export function createPhysMaterial(uniforms = createUniformStore()) {
  const material = new THREE.MeshLambertMaterial({ color: 0xa0a0a0 });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
  };

  return material;
}

function createUniformRuntimeValue(
  uniform: ViewerUniformValue,
): number | THREE.Vector3 | THREE.Vector4 | THREE.Color {
  if (uniform.type === "int") {
    return uniform.value;
  }

  if (uniform.type === "vec3") {
    if (uniform.value instanceof THREE.Vector3 || uniform.value instanceof THREE.Color) {
      return uniform.value.clone();
    }

    return new THREE.Vector3(...uniform.value);
  }

  if (uniform.value instanceof THREE.Vector4) {
    return uniform.value.clone();
  }

  return new THREE.Vector4(...uniform.value);
}
