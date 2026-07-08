# sw-mesh-viewer

[Visit demo](https://teinishi.github.io/sw-mesh-viewer/)

[Visit docs](https://teinishi.github.io/sw-mesh-viewer/docs/)

Stormworks mesh parser and Three.js utilities.

This package parses `mesh` and `phys` binary files and turns them into
Three.js objects, materials, and lights. It does not own a canvas, renderer,
scene, camera, or controls. Those runtime concerns stay in your app or in a
renderer such as TresJS.

## Installation

```bash
npm install github:Teinishi/sw-mesh-viewer
```

## Three.js Usage

```ts
import * as THREE from "three";
import { parseMeshData } from "sw-mesh-viewer";
import {
  createStormworksLights,
  createStormworksObject,
  disposeStormworksObject,
} from "sw-mesh-viewer/viewer";

const scene = new THREE.Scene();
scene.add(...createStormworksLights());

const file = await fetch("/example.mesh").then((response) => response.arrayBuffer());
const data = parseMeshData(file);
const object = createStormworksObject(data, { name: "example.mesh" });

scene.add(object);

// Later, when your app removes the object:
scene.remove(object);
disposeStormworksObject(object);
```

## Materials And Uniforms

```ts
import {
  applyStormworksUniforms,
  createStormworksMaterials,
  createStormworksObject,
} from "sw-mesh-viewer/viewer";

const materials = createStormworksMaterials({
  uniforms: {
    opaque: {
      overrideColor: { type: "int", value: 1 },
      overrideColor1: { type: "vec4", value: [1, 1, 1, 1] },
    },
  },
});

const object = createStormworksObject(data, { materials });

applyStormworksUniforms(materials, {
  opaque: {
    overrideColor1: { type: "vec4", value: [1, 0.53, 0.27, 1] },
  },
});
```

If you share one material set across multiple objects, uniform changes affect
all objects using that set. Create one material set per object when each object
needs independent color or shader state.

## Vue And TresJS Usage

`SwMeshPrimitive` is a thin TresJS wrapper. It renders a TresJS `primitive`,
updates uniforms from props, and disposes internally created geometry/materials
on unmount.

```html
<script setup lang="ts">
  import { ref } from "vue";
  import { TresCanvas } from "@tresjs/core";
  import { OrbitControls } from "@tresjs/cientos";
  import { parseMeshData, type MeshData } from "sw-mesh-viewer";
  import { createStormworksLightGroup, type StormworksUniforms } from "sw-mesh-viewer/viewer";
  import { SwMeshPrimitive } from "sw-mesh-viewer/vue";

  const data = ref<MeshData | null>(null);
  const lights = createStormworksLightGroup();
  const uniforms = ref<StormworksUniforms>({
    opaque: {
      overrideColor: { type: "int", value: 1 },
      overrideColor1: { type: "vec4", value: [1, 1, 1, 1] },
    },
  });

  async function loadFile(file: File) {
    data.value = parseMeshData(await file.arrayBuffer());
  }
</script>

<template>
  <TresCanvas clear-color="#111827">
    <TresPerspectiveCamera :position="[0, 1.5, 4]" />
    <OrbitControls />
    <primitive :object="lights" />
    <SwMeshPrimitive v-if="data" :data="data" :uniforms="uniforms" />
  </TresCanvas>
</template>
```

When you pass your own `materials` prop to `SwMeshPrimitive`, the component
does not dispose those external materials unless `dispose-external-materials`
is explicitly enabled.

## Development

- Install dependencies:

```bash
npm install
```

- Run the unit tests:

```bash
npm run test
```

- Build the library:

```bash
npm run build
```
