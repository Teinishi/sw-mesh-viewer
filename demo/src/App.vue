<script setup lang="ts">
import { ref } from "vue";
import { MeshViewer } from "../../src";

const wireframe = ref(false);
const backgroundColor = ref<number | null>(0x111827);

const toggleBackground = () => {
  backgroundColor.value = backgroundColor.value === null ? 0x111827 : null;
};

const resetView = () => {
  wireframe.value = false;
  backgroundColor.value = 0x111827;
};
</script>

<template>
  <main class="demo-shell">
    <section class="demo-card">
      <div class="demo-header">
        <div>
          <h1>SW Mesh Viewer</h1>
          <p>Drag to orbit, scroll to zoom, and right-drag to pan.</p>
        </div>

        <div class="demo-controls">
          <label class="toggle">
            <input v-model="wireframe" type="checkbox" />
            <span>Wireframe</span>
          </label>
          <button type="button" @click="toggleBackground">Toggle background</button>
          <button type="button" @click="resetView">Reset</button>
        </div>
      </div>

      <div class="viewer-frame">
        <MeshViewer :mesh-data="null" :wireframe="wireframe" :background-color="backgroundColor" />
      </div>
    </section>
  </main>
</template>
