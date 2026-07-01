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
import type { ViewerObjectState } from "../core";

/** Props accepted by the Vue MeshViewer component. */
export interface MeshViewerProps {
  /** Declarative state patches for objects already added to the exposed Viewer. */
  objects?: ViewerObjectState[];
  /** Scene background color, or null for a transparent background. */
  backgroundColor?: number | null;
  /** Enable WebGL antialiasing. Defaults to true. */
  antialias?: boolean;
  /** Enable renderer alpha. Defaults to true. */
  alpha?: boolean;
}

export { Viewer } from "../core";

/**
 * Vue component that owns a Viewer instance.
 *
 * Add and remove mesh data through the exposed `getViewer()` method, and pass
 * object transforms, visibility, wireframe, and uniforms through the `objects`
 * prop.
 */
export const MeshViewer = defineComponent({
  name: "MeshViewer",
  props: {
    objects: {
      type: Array as PropType<ViewerObjectState[]>,
      default: () => [],
    },
    backgroundColor: {
      type: [Number, null] as PropType<number | null>,
      default: null,
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
  setup(props, { expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const viewer = shallowRef<Viewer | null>(null);
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;

    const resizeViewer = () => {
      if (!viewer.value || !containerRef.value) return;

      const rect = containerRef.value.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width || containerRef.value.clientWidth || 320));
      const height = Math.max(1, Math.floor(rect.height || containerRef.value.clientHeight || 240));
      viewer.value.resize(width, height);
    };

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

      resizeViewer();
      viewer.value.applyObjectStates(props.objects);
      viewer.value.setBackgroundColor(props.backgroundColor ?? null);
      viewer.value.render();
    };

    expose({
      viewer,
      getViewer: () => viewer.value,
    });

    onMounted(() => {
      nextTick(() => {
        syncViewer();

        if (containerRef.value && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            resizeViewer();
          });
          resizeObserver.observe(containerRef.value);
        } else {
          resizeHandler = resizeViewer;
          window.addEventListener("resize", resizeHandler);
        }

        resizeViewer();
      });
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();

      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }

      if (viewer.value) {
        viewer.value.dispose();
        viewer.value = null;
      }
    });

    watch(
      () => props.objects,
      (objects) => {
        if (viewer.value) {
          viewer.value.applyObjectStates(objects);
        }
      },
      { deep: true },
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
      h("div", { ref: containerRef, class: "sw-mesh-viewer", style: viewerRootStyle }, [
        h("canvas", {
          ref: canvasRef,
          class: "sw-mesh-viewer__canvas",
          style: viewerCanvasStyle,
        }),
      ]);
  },
});

const viewerRootStyle = {
  width: "100%",
  height: "100%",
  minWidth: "0",
  minHeight: "0",
};

const viewerCanvasStyle = {
  display: "block",
  width: "100%",
  height: "100%",
};
