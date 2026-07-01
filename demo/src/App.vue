<script setup lang="ts">
import { computed, ref } from "vue";
import { MeshBinaryParser, type MeshData } from "../../src";
import { Viewer, MeshViewer, type ViewerObjectState } from "../../src/vue";

interface MeshViewerExpose {
  getViewer: () => Viewer | null;
}

interface DemoObject {
  id: string;
  name: string;
  size: number;
  kind: MeshData["kind"];
  visible: boolean;
}

const backgroundColor = ref<number | null>(0x111827);
const objects = ref<DemoObject[]>([]);
const isDragging = ref(false);
const errorMessage = ref("");
const meshViewerRef = ref<MeshViewerExpose | null>(null);

const viewerObjects = computed<ViewerObjectState[]>(() =>
  objects.value.map((object) => ({
    id: object.id,
    visible: object.visible,
  })),
);

const visibleCount = computed(() => objects.value.filter((object) => object.visible).length);

const getViewer = () => meshViewerRef.value?.getViewer() ?? null;

const toggleBackground = () => {
  backgroundColor.value = backgroundColor.value === null ? 0x111827 : null;
};

const resetView = () => {
  backgroundColor.value = 0x111827;
  objects.value = objects.value.map((object) => ({ ...object, visible: true }));
  errorMessage.value = "";
};

let idCounter = 0;
const addFiles = async (fileList: FileList | File[]) => {
  const files = Array.from(fileList);
  if (files.length === 0) return;

  const parser = new MeshBinaryParser();
  const loaded: DemoObject[] = [];
  const failed: string[] = [];
  const viewer = getViewer();

  for (const file of files) {
    try {
      const data = parser.parse(await file.arrayBuffer());
      const id = `object-${idCounter++}`;
      viewer?.addObject(id, data, {
        name: file.name,
        visible: true,
      });
      loaded.push({
        id,
        name: file.name,
        size: file.size,
        kind: data.kind,
        visible: true,
      });
    } catch (error) {
      failed.push(file.name);
      console.error(error);
    }
  }

  objects.value = [...objects.value, ...loaded];
  errorMessage.value =
    failed.length > 0 ? `読み込めないファイルがありました: ${failed.join(", ")}` : "";
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
  getViewer()?.removeObject(id);
  objects.value = objects.value.filter((object) => object.id !== id);
};

const clearObjects = () => {
  getViewer()?.clearObjects();
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
          <p>Right-drag to orbit, scroll to zoom, and middle-drag to pan.</p>
        </div>

        <div class="demo-controls">
          <button type="button" @click="toggleBackground">Toggle background</button>
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
                <span>{{ object.kind }} · {{ formatBytes(object.size) }}</span>
              </div>
              <button type="button" aria-label="Remove object" @click="removeObject(object.id)">
                Remove
              </button>
            </li>
          </ul>

          <p v-else class="empty-state">No objects loaded.</p>
        </aside>

        <div class="viewer-frame">
          <MeshViewer
            ref="meshViewerRef"
            :objects="viewerObjects"
            :background-color="backgroundColor"
          />
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
  color: #e5e7eb;
  background: #10131a;
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
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 24px;
  background: #171b24;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
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
  color: #94a3b8;
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
  background: #2dd4bf;
  color: #062622;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

button:hover {
  filter: brightness(1.05);
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
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 16px;
  background: #111827;
}

.object-panel--dragging {
  border-color: #2dd4bf;
  box-shadow: inset 0 0 0 1px rgba(45, 212, 191, 0.65);
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
  color: #94a3b8;
  font-size: 0.875rem;
}

.drop-zone {
  display: grid;
  gap: 4px;
  place-items: center;
  min-height: 116px;
  padding: 16px;
  border: 1px dashed rgba(148, 163, 184, 0.65);
  border-radius: 8px;
  color: #f8fafc;
  cursor: pointer;
  text-align: center;
  background: #0f172a;
}

.drop-zone input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.drop-zone small {
  color: #94a3b8;
}

.error-message {
  margin: 12px 0 0;
  color: #fda4af;
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
  background: #1f2937;
}

.object-list__item button {
  padding: 6px 10px;
  background: #334155;
  color: #e5e7eb;
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
  color: #94a3b8;
  font-size: 0.8rem;
}

.visibility-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #cbd5e1;
  font-size: 0.78rem;
  cursor: pointer;
}

.visibility-toggle input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: #2dd4bf;
  cursor: pointer;
}

.empty-state {
  margin: 16px 0 0;
  color: #94a3b8;
  font-size: 0.9rem;
}

.viewer-frame {
  min-height: 560px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  overflow: hidden;
  background: #020617;
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
