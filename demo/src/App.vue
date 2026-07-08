<script setup lang="ts">
import { computed, ref } from "vue";
import * as THREE from "three";
import { OrbitControls } from "@tresjs/cientos";
import { TresCanvas } from "@tresjs/core";
import { parseMeshData, type MeshData } from "../../src";
import { createStormworksLightGroup, type StormworksUniforms } from "../../src/viewer";
import { SwMeshPrimitive } from "../../src/vue";

interface DemoObject {
  id: string;
  name: string;
  size: number;
  kind: MeshData["kind"];
  data: MeshData;
  visible: boolean;
}

const objects = ref<DemoObject[]>([]);
const isDragging = ref(false);
const errorMessage = ref("");
const wireframe = ref(false);
const objectColor = ref("#ffffff");
const lightGroup = createStormworksLightGroup();

const orbitMouseButtons = {
  LEFT: undefined,
  MIDDLE: THREE.MOUSE.PAN,
  RIGHT: THREE.MOUSE.ROTATE,
};

const visibleCount = computed(() => objects.value.filter((object) => object.visible).length);
const objectColorVec4 = computed<[number, number, number, number]>(() => [
  parseInt(objectColor.value.slice(1, 3), 16) / 255,
  parseInt(objectColor.value.slice(3, 5), 16) / 255,
  parseInt(objectColor.value.slice(5, 7), 16) / 255,
  1,
]);

const uniforms = computed<StormworksUniforms>(() => ({
  opaque: {
    overrideColor: { type: "int", value: 1 },
    overrideColor1: { type: "vec4", value: objectColorVec4.value },
    overrideColor2: { type: "vec4", value: objectColorVec4.value },
    overrideColor3: { type: "vec4", value: objectColorVec4.value },
  },
}));

const resetView = () => {
  wireframe.value = false;
  objectColor.value = "#ffffff";
  objects.value = objects.value.map((object) => ({ ...object, visible: true }));
  errorMessage.value = "";
};

let idCounter = 0;
const addFiles = async (fileList: FileList | File[]) => {
  const files = Array.from(fileList);
  if (files.length === 0) return;

  const loaded: DemoObject[] = [];
  const failed: string[] = [];

  for (const file of files) {
    try {
      const data = parseMeshData(await file.arrayBuffer());
      loaded.push({
        id: `object-${idCounter++}`,
        name: file.name,
        size: file.size,
        kind: data.kind,
        data,
        visible: true,
      });
    } catch (error) {
      failed.push(file.name);
      console.error(error);
    }
  }

  objects.value = [...objects.value, ...loaded];
  errorMessage.value = failed.length > 0 ? `Could not read these files: ${failed.join(", ")}` : "";
};

const handleDrop = async (event: DragEvent) => {
  isDragging.value = false;
  await addFiles(event.dataTransfer?.files ?? []);
};

const handleFileInput = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  await addFiles(input.files ?? []);
  input.value = "";
};

const removeObject = (id: string) => {
  objects.value = objects.value.filter((object) => object.id !== id);
};

const clearObjects = () => {
  objects.value = [];
  errorMessage.value = "";
};

const formatBytes = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};
</script>

<template>
  <main class="demo-shell">
    <section class="demo-card">
      <div class="demo-header">
        <div>
          <h1>SW Mesh Viewer</h1>
          <p>TresJS owns the canvas, camera, controls, and scene.</p>
        </div>

        <div class="demo-controls">
          <label class="color-control">
            <span>Color</span>
            <input v-model="objectColor" type="color" />
          </label>
          <label class="visibility-toggle">
            <input v-model="wireframe" type="checkbox" />
            <span>Wireframe</span>
          </label>
          <button type="button" @click="resetView">Reset</button>
        </div>
      </div>

      <div class="demo-layout">
        <aside
          class="object-panel"
          :class="{ 'object-panel--dragging': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <div class="object-panel__header">
            <div>
              <h2>Objects</h2>
              <p>{{ visibleCount }} / {{ objects.length }} visible</p>
            </div>
            <button type="button" :disabled="objects.length === 0" @click="clearObjects">
              Clear
            </button>
          </div>

          <label class="drop-zone">
            <input multiple type="file" @change="handleFileInput" />
            <span>Drop mesh or phys files here</span>
            <small>or click to choose files</small>
          </label>

          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

          <ul v-if="objects.length > 0" class="object-list">
            <li v-for="object in objects" :key="object.id" class="object-list__item">
              <label class="visibility-toggle">
                <input v-model="object.visible" type="checkbox" />
                <span>Visible</span>
              </label>
              <div class="object-list__text">
                <strong>{{ object.name }}</strong>
                <span>{{ object.kind }} / {{ formatBytes(object.size) }}</span>
              </div>
              <button type="button" aria-label="Remove object" @click="removeObject(object.id)">
                Remove
              </button>
            </li>
          </ul>

          <p v-else class="empty-state">No objects loaded.</p>
        </aside>

        <div class="viewer-frame">
          <TresCanvas clear-color="#ffffff">
            <TresPerspectiveCamera />
            <OrbitControls :enable-damping="false" :mouse-buttons="orbitMouseButtons" />
            <primitive :object="lightGroup" />
            <SwMeshPrimitive
              v-for="object in objects"
              :key="object.id"
              :data="object.data"
              :name="object.name"
              :uniforms="uniforms"
              :visible="object.visible"
              :wireframe="wireframe"
            />
          </TresCanvas>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.demo-shell,
.demo-shell * {
  box-sizing: border-box;
}

.demo-shell {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  color: #1f2937;
  background: #f1f5f9;
  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.demo-card {
  width: min(1180px, 100%);
  height: min(860px, calc(100vh - 48px));
  min-height: 640px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  padding: 24px;
  background: #ffffff;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.demo-header h1 {
  margin: 0 0 8px;
  font-size: 2rem;
}

.demo-header p {
  margin: 0;
  color: #64748b;
}

.demo-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

button,
input {
  font: inherit;
}

button {
  border: 0;
  border-radius: 6px;
  padding: 8px 14px;
  background: #0f766e;
  color: #ffffff;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

button:hover {
  filter: brightness(1.05);
}

.color-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-size: 0.86rem;
}

.color-control input {
  width: 36px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.demo-layout {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
}

.object-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  padding: 16px;
  background: #f8fafc;
}

.object-panel--dragging {
  border-color: #0f766e;
  box-shadow: inset 0 0 0 1px rgba(15, 118, 110, 0.45);
}

.object-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.object-panel__header h2 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.object-panel__header p {
  margin: 0;
  color: #64748b;
  font-size: 0.875rem;
}

.drop-zone {
  display: grid;
  gap: 4px;
  place-items: center;
  min-height: 116px;
  padding: 16px;
  border: 1px dashed #94a3b8;
  border-radius: 8px;
  color: #1e293b;
  cursor: pointer;
  text-align: center;
  background: #ffffff;
}

.drop-zone input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.drop-zone small {
  color: #64748b;
}

.error-message {
  margin: 12px 0 0;
  color: #be123c;
  font-size: 0.875rem;
}

.object-list {
  display: grid;
  align-content: start;
  gap: 8px;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  margin: 16px 0 0;
  overflow: auto;
  list-style: none;
}

.object-list__item {
  display: grid;
  grid-template-columns: minmax(74px, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px;
  border-radius: 8px;
  background: #eef2f7;
}

.object-list__item button {
  padding: 6px 10px;
  background: #dbe3ef;
  color: #1f2937;
}

.object-list__text {
  min-width: 0;
}

.object-list__text strong,
.object-list__text span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.object-list__text strong {
  font-size: 0.925rem;
}

.object-list__text span {
  color: #64748b;
  font-size: 0.8rem;
}

.visibility-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-size: 0.78rem;
  cursor: pointer;
}

.visibility-toggle input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: #0f766e;
  cursor: pointer;
}

.empty-state {
  margin: 16px 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

.viewer-frame {
  min-height: 560px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  overflow: hidden;
}

.viewer-frame > * {
  width: 100%;
  height: 100%;
}

@media (max-width: 820px) {
  .demo-header,
  .demo-layout {
    grid-template-columns: 1fr;
  }

  .demo-header {
    display: grid;
  }

  .object-panel {
    min-height: 360px;
  }

  .demo-card {
    height: auto;
    min-height: 0;
  }

  .viewer-frame {
    height: 520px;
    min-height: 0;
  }
}
</style>
