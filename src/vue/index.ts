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
      h("div", { class: "sw-mesh-viewer" }, [
        h("canvas", {
          ref: canvasRef,
          class: "sw-mesh-viewer__canvas",
        }),
      ]);
  },
});
