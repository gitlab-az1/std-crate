/* eslint-disable @typescript-eslint/no-namespace,no-inner-declarations */

import { uint_t } from "./defs";


const $protected = Symbol("kVMProtected");


export namespace BinaryLayout {
  interface IBlock {
    offset: uint_t;
    size: uint_t;
  }

  export class Reference {
    public [$protected]: {
      buffer: ArrayBuffer;
      view: DataView;
      freeList: IBlock[];
      size: uint_t;
      nextOffset: uint_t;
      isDisposed: boolean;
    };

    public constructor();
    public constructor(s: uint_t);
    public constructor(s?: uint_t) {
      if(!s) {
        const a = checkVirtualAvailableSize();

        if(a.ge(1024)) {
          s = uint_t.of(a);
        }
      }
    
      const size = uint_t.of(s ?? 1536);
      const buffer = new ArrayBuffer(size.valueOf(true));

      this[$protected] = {
        size,
        buffer,
        freeList: [],
        isDisposed: false,
        view: new DataView(buffer),
        nextOffset: uint_t.of(0),
      };
    }

    public clean(): void {
      if(this[$protected].isDisposed)
        return;
      
      this[$protected].buffer = null!;
      this[$protected].view = null!;
      this[$protected].freeList = null!;

      const buffer = new ArrayBuffer(this[$protected].size.valueOf(true));

      this[$protected] = {
        ...this[$protected],
        buffer,
        view: new DataView(buffer),
        freeList: [],
      };
    }

    public dispose(): void {
      this[$protected].buffer = null!;
      this[$protected].view = null!;
      this[$protected].freeList = null!;
      this[$protected].isDisposed = true;
    }
  }

  export class ptr {
    public [$protected]: { $$: uint_t };

    public constructor(n: number | uint_t) {
      this[$protected] = {
        $$: uint_t.of(n),
      };
    }
  }

  export function malloc($ref: Reference, size: number | uint_t): ptr | null {
    end($ref);

    for(let i = 0; i < $ref[$protected].freeList.length; i++) {
      const blk = $ref[$protected].freeList[i];

      if(blk.size.ge(size)) {
        $ref[$protected].freeList.splice(i, 1);
        return new ptr(blk.offset);
      }
    }

    if($ref[$protected].nextOffset.add(size).gt($ref[$protected].size))
      return null;

    const t = new ptr($ref[$protected].nextOffset);
    $ref[$protected].nextOffset.eqadd(size);

    return t;
  }

  export class Crate {
    public constructor(private readonly _ref: Reference) { }

    public malloc(size: number | uint_t): ptr | null {
      return malloc(this._ref, size);
    }
  }
}

function checkVirtualAvailableSize(): uint_t {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { totalmem, freemem } = require("node:os") as typeof import("node:os");

    const t = totalmem();
    const f = freemem();

    return uint_t.of(t / 8 < f ? t / 8 : f - 1024 ** 3);
  } catch (err: any) {
    // TODO: debug err
    return uint_t.of(-1);
  }
}

function end(o: { [$protected]: { isDisposed: boolean } }): void {
  if(o[$protected].isDisposed) {
    // TODO: THROW
  }
}
