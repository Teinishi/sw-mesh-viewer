import * as THREE from "three";
import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  shallowRef,
  watch,
  type PropType,
} from "vue";
import type { MeshData } from "../parser";
import {
  applyStormworksUniforms,
  createStormworksMaterials,
  createStormworksObject,
  disposeStormworksObject,
  setStormworksWireframe,
  type StormworksMaterialSet,
  type StormworksUniforms,
} from "../viewer";

/** Props accepted by the TresJS-compatible Stormworks mesh primitive. */
export interface SwMeshPrimitiveProps {
  /** Parsed Stormworks mesh or physics mesh data to render. */
  data: MeshData;
  /** Optional display name assigned to the created Three.js object. */
  name?: string;
  /** Uniform patches applied to the component's active material set. */
  uniforms?: StormworksUniforms;
  /** Enable wireframe mode on materials that support it. */
  wireframe?: boolean;
  /** Visibility applied to the created root object. */
  visible?: boolean;
  /**
   * Optional external material set.
   *
   * When omitted, the component creates and owns a fresh material set.
   */
  materials?: StormworksMaterialSet;
  /** Dispose resources created for the current object on replacement or unmount. Defaults to `true`. */
  dispose?: boolean;
  /**
   * Dispose externally supplied materials when the object is replaced or unmounted.
   *
   * This is disabled by default because external materials are often shared by
   * the parent application.
   */
  disposeExternalMaterials?: boolean;
}

/**
 * Render parsed Stormworks mesh data as a TresJS primitive.
 *
 * The component creates a Three.js object from `data`, updates uniforms and
 * wireframe state from props, and disposes internally created resources when
 * the object is replaced or the component unmounts.
 */
export const SwMeshPrimitive = defineComponent({
  name: "SwMeshPrimitive",
  props: {
    data: {
      type: Object as PropType<MeshData>,
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    uniforms: {
      type: Object as PropType<StormworksUniforms>,
      default: () => ({}),
    },
    wireframe: {
      type: Boolean,
      default: false,
    },
    visible: {
      type: Boolean,
      default: true,
    },
    materials: {
      type: Object as PropType<StormworksMaterialSet | undefined>,
      default: undefined,
    },
    dispose: {
      type: Boolean,
      default: true,
    },
    disposeExternalMaterials: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { expose }) {
    const objectRef = shallowRef<THREE.Object3D | null>(null);
    const ownedMaterialsRef = shallowRef<StormworksMaterialSet | null>(null);
    const objectOwnsMaterialsRef = shallowRef(false);

    const activeMaterials = computed(() => props.materials ?? ownedMaterialsRef.value);

    const disposeCurrentObject = () => {
      const object = objectRef.value;
      if (!object || !props.dispose) return;

      disposeStormworksObject(object, {
        disposeMaterial: objectOwnsMaterialsRef.value || props.disposeExternalMaterials,
      });
    };

    const createObject = () => {
      disposeCurrentObject();

      const materials = props.materials ?? createStormworksMaterials({ uniforms: props.uniforms });
      ownedMaterialsRef.value = props.materials ? null : materials;
      objectOwnsMaterialsRef.value = !props.materials;
      objectRef.value = createStormworksObject(props.data, {
        name: props.name,
        materials,
      });
      objectRef.value.visible = props.visible;
      setStormworksWireframe(objectRef.value, props.wireframe);
    };

    createObject();

    watch(
      () => props.data,
      () => {
        createObject();
      },
    );

    watch(
      () => props.materials,
      () => {
        createObject();
      },
    );

    watch(
      () => props.name,
      (name) => {
        if (objectRef.value) {
          objectRef.value.name = name;
        }
      },
    );

    watch(
      () => props.visible,
      (visible) => {
        if (objectRef.value) {
          objectRef.value.visible = visible;
        }
      },
    );

    watch(
      () => props.wireframe,
      (wireframe) => {
        if (objectRef.value) {
          setStormworksWireframe(objectRef.value, wireframe);
        }
      },
    );

    watch(
      () => props.uniforms,
      (uniforms) => {
        const materials = activeMaterials.value;
        if (materials) {
          applyStormworksUniforms(materials, uniforms);
        }
      },
      { deep: true },
    );

    onBeforeUnmount(() => {
      disposeCurrentObject();
      objectRef.value = null;
      ownedMaterialsRef.value = null;
      objectOwnsMaterialsRef.value = false;
    });

    expose({
      object: objectRef,
      getObject: () => objectRef.value,
    });

    return () => {
      const object = objectRef.value;
      return object ? h("primitive", { object }) : null;
    };
  },
});

export type {
  StormworksMaterialSet,
  StormworksUniforms,
  StormworksUniformPatch,
  StormworksUniformValue,
} from "../viewer";
