import { describe, expect, it } from "vitest";
import { MeshBinaryParser } from "../src/parser";

function writeFloat32LE(view: DataView, offset: number, value: number): number {
  view.setFloat32(offset, value, true);
  return offset + 4;
}

function writeUint16LE(view: DataView, offset: number, value: number): number {
  view.setUint16(offset, value, true);
  return offset + 2;
}

function writeUint32LE(view: DataView, offset: number, value: number): number {
  view.setUint32(offset, value, true);
  return offset + 4;
}

function buildMeshBytes(): Uint8Array {
  const bytes = new Uint8Array(256);
  const view = new DataView(bytes.buffer);
  let offset = 0;

  offset = writeAscii(view, offset, "mesh");
  offset = writeUint16LE(view, offset, 7);
  offset = writeUint16LE(view, offset, 1);
  offset = writeUint16LE(view, offset, 1);
  offset = writeUint16LE(view, offset, 19);
  offset = writeUint16LE(view, offset, 0);

  offset = writeFloat32LE(view, offset, 1);
  offset = writeFloat32LE(view, offset, 2);
  offset = writeFloat32LE(view, offset, 3);
  offset = writeUint8(view, offset, 1);
  offset = writeUint8(view, offset, 2);
  offset = writeUint8(view, offset, 3);
  offset = writeUint8(view, offset, 4);
  offset = writeFloat32LE(view, offset, 0);
  offset = writeFloat32LE(view, offset, 0);
  offset = writeFloat32LE(view, offset, 1);

  offset = writeUint32LE(view, offset, 3);
  offset = writeUint16LE(view, offset, 0);
  offset = writeUint16LE(view, offset, 0);
  offset = writeUint16LE(view, offset, 0);

  offset = writeUint16LE(view, offset, 1);
  offset = writeUint32LE(view, offset, 0);
  offset = writeUint32LE(view, offset, 0);
  offset = writeUint16LE(view, offset, 0);
  offset = writeUint16LE(view, offset, 0);
  offset = writeFloat32LE(view, offset, 0);
  offset = writeFloat32LE(view, offset, 0);
  offset = writeFloat32LE(view, offset, 0);
  offset = writeFloat32LE(view, offset, 0);
  offset = writeFloat32LE(view, offset, 0);
  offset = writeFloat32LE(view, offset, 0);
  offset = writeUint16LE(view, offset, 0);
  offset = writeUint16LE(view, offset, 0);
  offset = writeFloat32LE(view, offset, 1);
  offset = writeFloat32LE(view, offset, 1);
  offset = writeFloat32LE(view, offset, 1);

  return bytes.subarray(0, offset);
}

function writeUint8(view: DataView, offset: number, value: number): number {
  view.setUint8(offset, value);
  return offset + 1;
}

function writeAscii(view: DataView, offset: number, value: string): number {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
  return offset + value.length;
}

describe("MeshBinaryParser", () => {
  it("parses a mesh file from a Uint8Array", () => {
    const parser = new MeshBinaryParser();
    const parsed = parser.parse(buildMeshBytes());

    expect(parsed.kind).toBe("mesh");
    if (parsed.kind !== "mesh") return;

    expect(parsed.vertices).toHaveLength(1);
    expect(parsed.indices).toEqual([0, 0, 0]);
    expect(parsed.submeshes).toHaveLength(1);
    expect(parsed.submeshes[0]?.name).toBe("");
  });
});
