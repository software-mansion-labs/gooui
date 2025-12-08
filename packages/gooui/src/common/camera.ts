import type { TgpuRoot, TgpuUniform } from "typegpu";
import * as d from "typegpu/data";
import * as m from "wgpu-matrix";

export const Camera = d.struct({
  view: d.mat4x4f,
  proj: d.mat4x4f,
  viewInv: d.mat4x4f,
  projInv: d.mat4x4f,
});

function halton(index: number, base: number) {
  let result = 0;
  let f = 1 / base;
  let i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f = f / base;
  }
  return result;
}

function* haltonSequence(base: number) {
  let index = 1;
  while (true) {
    yield halton(index, base);
    index++;
  }
}

export interface PerspectiveCamera {
  type: "perspective";
  fov: number;
  near: number;
  far: number;

  width: number;
  height: number;
}

export interface OrthographicCamera {
  type: "orthographic";
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;

  width: number;
  height: number;
}

export class CameraController {
  #uniform: TgpuUniform<typeof Camera>;
  #view: d.m4x4f;
  #proj: d.m4x4f;
  #viewInv: d.m4x4f;
  #projInv: d.m4x4f;
  #baseProj: d.m4x4f;
  #baseProjInv: d.m4x4f;
  #haltonX: Generator<number>;
  #haltonY: Generator<number>;
  #options: PerspectiveCamera | OrthographicCamera;

  constructor(
    root: TgpuRoot,
    position: d.v3f,
    target: d.v3f,
    up: d.v3f,
    options: PerspectiveCamera | OrthographicCamera,
  ) {
    this.#options = options;

    this.#view = m.mat4.lookAt(position, target, up, d.mat4x4f());
    if (options.type === "perspective") {
      this.#baseProj = m.mat4.perspective(
        options.fov,
        options.width / options.height,
        options.near,
        options.far,
        d.mat4x4f(),
      );
    } else {
      this.#baseProj = m.mat4.ortho(
        options.left,
        options.right,
        options.bottom,
        options.top,
        options.near,
        options.far,
        d.mat4x4f(),
      );
    }

    this.#proj = this.#baseProj;

    this.#viewInv = m.mat4.invert(this.#view, d.mat4x4f());
    this.#baseProjInv = m.mat4.invert(this.#baseProj, d.mat4x4f());
    this.#projInv = this.#baseProjInv;

    this.#uniform = root.createUniform(Camera, {
      view: this.#view,
      proj: this.#proj,
      viewInv: this.#viewInv,
      projInv: this.#projInv,
    });

    this.#haltonX = haltonSequence(2);
    this.#haltonY = haltonSequence(3);
  }

  jitter() {
    const [jx, jy] = [
      this.#haltonX.next().value,
      this.#haltonY.next().value,
    ] as [number, number];

    const jitterX = ((jx - 0.5) * 2.0) / this.#options.width;
    const jitterY = ((jy - 0.5) * 2.0) / this.#options.height;

    const jitterMatrix = m.mat4.identity(d.mat4x4f());
    jitterMatrix[12] = jitterX; // x translation in NDC
    jitterMatrix[13] = jitterY; // y translation in NDC

    const jitteredProj = m.mat4.mul(jitterMatrix, this.#baseProj, d.mat4x4f());
    const jitteredProjInv = m.mat4.invert(jitteredProj, d.mat4x4f());

    this.#uniform.writePartial({
      proj: jitteredProj,
      projInv: jitteredProjInv,
    });
  }

  updateView(position: d.v3f, target: d.v3f, up: d.v3f) {
    this.#view = m.mat4.lookAt(position, target, up, d.mat4x4f());
    this.#viewInv = m.mat4.invert(this.#view, d.mat4x4f());

    this.#uniform.writePartial({
      view: this.#view,
      viewInv: this.#viewInv,
    });
  }

  updateProjection(options: PerspectiveCamera | OrthographicCamera) {
    this.#options = options;

    if (options.type === "perspective") {
      this.#baseProj = m.mat4.perspective(
        options.fov,
        options.width / options.height,
        options.near,
        options.far,
        d.mat4x4f(),
      );
    } else {
      this.#baseProj = m.mat4.ortho(
        options.left,
        options.right,
        options.bottom,
        options.top,
        options.near,
        options.far,
        d.mat4x4f(),
      );
    }
    this.#baseProjInv = m.mat4.invert(this.#baseProj, d.mat4x4f());

    this.#uniform.writePartial({
      proj: this.#baseProj,
      projInv: this.#baseProjInv,
    });
  }

  get cameraUniform() {
    return this.#uniform;
  }
}
