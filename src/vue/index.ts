import {
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from "vue";
import { Viewer } from "../core";
import type { MeshData } from "../parser";

export interface MeshViewerProps {
  meshData?: MeshData | null;
  backgroundColor?: number | null;
  wireframe?: boolean;
  antialias?: boolean;
  alpha?: boolean;
}

export { Viewer } from "../core";

export const MeshViewer = defineComponent({
  name: "MeshViewer",
  props: {
    meshData: {
      type: Object as PropType<MeshData | null>,
      default: null,
    },
    backgroundColor: {
      type: [Number, null] as PropType<number | null>,
      default: null,
    },
    wireframe: {
      type: Boolean,
      default: false,
    },
    antialias: {
      type: Boolean,
      default: true,
    },
    alpha: {
      type: Boolean,
      default: true,
    },
  },
  setup(props) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const viewer = shallowRef<Viewer | null>(null);
    let resizeHandler: (() => void) | null = null;

    const syncViewer = () => {
      const canvas = canvasRef.value;
      if (!canvas) return;

      if (!viewer.value) {
        viewer.value = new Viewer(canvas, {
          antialias: props.antialias,
          alpha: props.alpha,
          backgroundColor: props.backgroundColor,
        });
      }

      const width = canvas.clientWidth || 320;
      const height = canvas.clientHeight || 240;
      viewer.value.resize(width, height);
      viewer.value.loadMesh(props.meshData ?? null);
      viewer.value.setWireframe(Boolean(props.wireframe));
      viewer.value.setBackgroundColor(props.backgroundColor ?? null);
      viewer.value.render();
    };

    onMounted(() => {
      nextTick(() => {
        syncViewer();
      });

      resizeHandler = () => {
        if (!viewer.value || !canvasRef.value) return;

        const width = canvasRef.value.clientWidth || 320;
        const height = canvasRef.value.clientHeight || 240;
        viewer.value.resize(width, height);
      };

      window.addEventListener("resize", resizeHandler);
    });

    onBeforeUnmount(() => {
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }

      if (viewer.value) {
        viewer.value.dispose();
        viewer.value = null;
      }
    });

    watch(
      () => props.meshData,
      () => {
        if (viewer.value) {
          viewer.value.loadMesh(props.meshData ?? null);
          viewer.value.render();
        }
      },
    );

    watch(
      () => props.wireframe,
      (value) => {
        if (viewer.value) {
          viewer.value.setWireframe(Boolean(value));
        }
      },
    );

    watch(
      () => props.backgroundColor,
      (value) => {
        if (viewer.value) {
          viewer.value.setBackgroundColor(value ?? null);
        }
      },
    );

    return () =>
      h("div", { class: "sw-mesh-viewer" }, [
        h("canvas", {
          ref: canvasRef,
          class: "sw-mesh-viewer__canvas",
        }),
      ]);
  },
});
