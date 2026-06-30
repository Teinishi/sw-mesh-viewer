import * as THREE from "three";

export const AMBIENT_COLOR_HIGH = new THREE.Color(118.0 / 255.0, 142.0 / 255.0, 190.0 / 255.0);
export const AMBIENT_COLOR_LOW = new THREE.Color(11.0 / 255.0, 16.0 / 255.0, 44.0 / 255.0);
const SKY_COLOR_UP = new THREE.Color(0.0, 61.0 / 255.0, 182.0 / 255.0);
const SKY_COLOR_DOWN = new THREE.Color(139.0 / 255.0, 210.0 / 255.0, 207.0 / 255.0);

const GLASS_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLASS_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 skyColorUp;
uniform vec3 skyColorDown;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
    // Fragment -> Camera
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);

    // Camera -> Fragment (元シェーダーと同じ向き)
    vec3 cameraToFragment = -viewDir;

    vec3 reflectedDir = reflect(cameraToFragment, normalize(vWorldNormal));

    float reflectionFactor = max(0.0, dot(vWorldNormal, viewDir));
    reflectionFactor = pow(1.0 - reflectionFactor, 5.0);

    float angleFactor = reflectedDir.y * 0.5 + 0.5;

    vec3 skyColor = mix(
        skyColorDown,
        skyColorUp,
        angleFactor
    );

    gl_FragColor = vec4(
        skyColor * reflectionFactor * 0.823,
        0.0
    );
}
`;

export function createOpaqueMaterial() {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0,
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

    // カメラ至近の補助ライト
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

export function createGlassMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: GLASS_VERTEX_SHADER,
    fragmentShader: GLASS_FRAGMENT_SHADER,

    uniforms: {
      skyColorUp: {
        value: SKY_COLOR_UP,
      },
      skyColorDown: {
        value: SKY_COLOR_DOWN,
      },
    },

    transparent: true,
    depthWrite: false,

    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
  });
}

export function createAdditiveMaterial() {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
