# sw-mesh-viewer

Stormworks mesh parser and Three.js viewer utilities.

This package parses `mesh` and `phys` binary files and renders them with
Three.js. Objects are added and removed imperatively, while frequently changed
state such as transforms, visibility, wireframe mode, and shader uniforms can be
updated separately.

## Installation

```bash
npm install github:Teinishi/sw-mesh-viewer
```

## Viewer Usage

```ts
import * as THREE from "three";
import { MeshBinaryParser, Viewer } from "sw-mesh-viewer";

const canvas = document.querySelector("canvas")!;
const viewer = new Viewer(canvas, {
  backgroundColor: 0x111827,
});

const file = await fetch("/example.mesh").then((response) => response.arrayBuffer());
const data = new MeshBinaryParser().parse(file);

viewer.addObject({
  id: "example",
  name: "example.mesh",
  data,
  matrix: new THREE.Matrix4().makeTranslation(0, 0, 0),
  uniforms: {
    opaque: {
      overrideColor: { type: "int", value: 1 },
      overrideColor1: { type: "vec4", value: [1, 1, 1, 1] },
    },
  },
});

viewer.setObjectVisible("example", true);
viewer.setObjectWireframe("example", false);
viewer.resize(canvas.clientWidth, canvas.clientHeight);
viewer.render();
```

## Vue Usage

```html
<script setup lang="ts">
  import { computed, ref } from "vue";
  import { MeshBinaryParser, MeshViewer, Viewer, type ViewerObjectState } from "sw-mesh-viewer";

  const meshViewer = ref<{ getViewer: () => Viewer | null } | null>(null);
  const visible = ref(true);

  const objects = computed<ViewerObjectState[]>(() => [
    {
      id: "body",
      visible: visible.value,
      wireframe: false,
    },
  ]);

  async function addFile(file: File) {
    const data = new MeshBinaryParser().parse(await file.arrayBuffer());
    meshViewer.value?.getViewer()?.addObject({
      id: "body",
      name: file.name,
      data,
    });
  }
</script>

<template>
  <MeshViewer ref="meshViewer" :objects="objects" :background-color="0x111827" />
</template>
```

Use the exposed `Viewer` instance for object lifetime operations such as
`addObject`, `removeObject`, and `clearObjects`. Use the `objects` prop for
state updates that may change often.

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
