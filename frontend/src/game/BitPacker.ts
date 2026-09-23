export class BitPacker {
  private buffer: ArrayBuffer;
  private view: DataView;
  private offset: number;

  constructor(size: number = 64) {
    this.buffer = new ArrayBuffer(size);
    this.view = new DataView(this.buffer);
    this.offset = 0;
  }

  writeUint8(value: number) {
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeUint16(value: number) {
    this.view.setUint16(this.offset, value, true); // Little endian
    this.offset += 2;
  }

  writeFloat32(value: number) {
    this.view.setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  getBuffer(): ArrayBuffer {
    return this.buffer.slice(0, this.offset);
  }

  static from(buffer: ArrayBuffer): BitReader {
    return new BitReader(buffer);
  }
}

export class BitReader {
  private view: DataView;
  private offset: number;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.offset = 0;
  }

  readUint8(): number {
    const val = this.view.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  readUint16(): number {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readFloat32(): number {
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }

  get isEOF(): boolean {
    return this.offset >= this.view.byteLength;
  }
}
