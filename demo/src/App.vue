<script setup lang="ts">
import { computed, ref } from "vue";
import {
  MeshBinaryParser,
  MeshViewer,
  Viewer,
  type MeshData,
  type ViewerObjectState,
} from "../../src";

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
      const id = `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
      viewer?.addObject({
        id,
        name: file.name,
        data,
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
