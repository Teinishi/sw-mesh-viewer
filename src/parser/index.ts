/** A three-dimensional vector stored in a parsed mesh file. */
export interface MeshVec3 {
  x: number;
  y: number;
  z: number;
}

/** A per-vertex RGBA color stored as 8-bit channel values. */
export interface MeshColor4 {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** A render mesh vertex with position, color, and normal data. */
export interface MeshVertex {
  position: MeshVec3;
  color: MeshColor4;
  normal: MeshVec3;
}

/** A material range inside a mesh index buffer. */
export interface SubMesh {
  /** Start offset in the parent MeshFile.indices array. */
  indexBufferStart: number;
  /** Number of indices used by this submesh. */
  indexBufferLength: number;
  /** Material selector: 0 = opaque, 1 = glass, 2 = additive. */
  shaderId: number;
  boundsMin: MeshVec3;
  boundsMax: MeshVec3;
  name: string;
}

/** Parsed render mesh data. */
export interface MeshFile {
  kind: "mesh";
  vertices: MeshVertex[];
  indices: number[];
  submeshes: SubMesh[];
}

/** A collision/physics mesh section. */
export interface PhysMesh {
  vertices: MeshVec3[];
  indices: number[];
}

/** Parsed physics mesh data. */
export interface PhysFile {
  kind: "phys";
  subPhysMeshes: PhysMesh[];
}

/** Any parsed Stormworks mesh-related file supported by this package. */
export type MeshData = MeshFile | PhysFile;

function toUint8Array(input: ArrayBuffer | ArrayBufferView | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  throw new TypeError("Unsupported input type for mesh parser");
}

/** Binary parser for Stormworks mesh and physics mesh files. */
export class MeshBinaryParser {
  private view!: DataView;
  private offset = 0;

  /** Parse a mesh or phys binary payload into structured mesh data. */
  parse(input: ArrayBuffer | ArrayBufferView | Uint8Array): MeshData {
    const bytes = toUint8Array(input);
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
    const signature = this.readAscii(4);

    if (signature === "mesh") {
      return this.parseMesh();
    }

    if (signature === "phys") {
      return this.parsePhys();
    }

    throw new Error(`Unsupported mesh signature: ${signature}`);
  }

  private parseMesh(): MeshFile {
    const h0 = this.readUint16LE();
    const h1 = this.readUint16LE();
    const vertexCount = this.readUint16LE();
    const h3 = this.readUint16LE();
    const h4 = this.readUint16LE();

    const vertices: MeshVertex[] = [];
    for (let i = 0; i < vertexCount; i += 1) {
      const position = this.readVec3();
      const color = this.readColor4();
      const normal = this.readVec3();
      vertices.push({ position, color, normal });
    }

    const indexCount = this.readUint32LE();
    const indices: number[] = [];
    for (let i = 0; i < indexCount; i += 1) {
      indices.push(this.readUint16LE());
    }

    const submeshCount = this.readUint16LE();
    const submeshes: SubMesh[] = [];
    for (let i = 0; i < submeshCount; i += 1) {
      const indexBufferStart = this.readUint32LE();
      const indexBufferLength = this.readUint32LE();
      const h2 = this.readUint16LE();
      const shaderId = this.readUint16LE();
      const boundsMin = this.readVec3();
      const boundsMax = this.readVec3();
      const h6 = this.readUint16LE();
      const nameLength = this.readUint16LE();
      const name = this.readAscii(nameLength);
      const h8 = this.readVec3();

      void h0;
      void h1;
      void h2;
      void h3;
      void h4;
      void h6;
      void h8;

      submeshes.push({
        indexBufferStart,
        indexBufferLength,
        shaderId,
        boundsMin,
        boundsMax,
        name,
      });
    }

    return { kind: "mesh", vertices, indices, submeshes };
  }

  private parsePhys(): PhysFile {
    const h0 = this.readUint16LE();
    const subPhysCount = this.readUint16LE();

    const subPhysMeshes: PhysMesh[] = [];
    for (let i = 0; i < subPhysCount; i += 1) {
      const vertexCount = this.readUint16LE();
      const vertices: MeshVec3[] = [];
      for (let j = 0; j < vertexCount; j += 1) {
        vertices.push(this.readVec3());
      }

      const indexCount = this.readUint16LE();
      const indices: number[] = [];
      for (let j = 0; j < indexCount; j += 1) {
        indices.push(this.readUint32LE());
      }

      subPhysMeshes.push({ vertices, indices });
    }

    void h0;
    return { kind: "phys", subPhysMeshes };
  }

  private readVec3(): MeshVec3 {
    return {
      x: this.readFloat32LE(),
      y: this.readFloat32LE(),
      z: this.readFloat32LE(),
    };
  }

  private readColor4(): MeshColor4 {
    return {
      r: this.readUint8(),
      g: this.readUint8(),
      b: this.readUint8(),
      a: this.readUint8(),
    };
  }

  private readAscii(length: number): string {
    let text = "";
    for (let i = 0; i < length; i += 1) {
      text += String.fromCharCode(this.readUint8());
    }
    return text;
  }

  private readUint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  private readUint16LE(): number {
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  private readUint32LE(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  private readFloat32LE(): number {
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }
}

export class MeshDataParser extends MeshBinaryParser {}
export class MeshParser extends MeshBinaryParser {}
