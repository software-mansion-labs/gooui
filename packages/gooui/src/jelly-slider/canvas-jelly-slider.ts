import type { TgpuRoot } from "typegpu";
import type * as d from "typegpu/data";
import { EventHandler } from "./events.ts";
import { JellySlider } from "./jelly-slider.ts";

export interface CanvasJellySliderOptions {
  root: TgpuRoot;
  jellyColor?: d.v3f | ((uv: d.v2f) => d.v3f) | undefined;
  glowTint?: d.v3f | ((x: number) => d.v3f) | undefined;
}

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

export class CanvasJellySlider {
  readonly canvas: HTMLCanvasElement;

  #canvasCtx: GPUCanvasContext;

  constructor(options: CanvasJellySliderOptions) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.#canvasCtx = this.canvas.getContext("webgpu") as GPUCanvasContext;

    this.#canvasCtx.configure({
      device: options.root.device,
      format: presentationFormat,
      alphaMode: "premultiplied",
    });

    const jellySlider = new JellySlider({
      root: options.root,
      jellyColor: options.jellyColor,
      glowTint: options.glowTint,
      targetFormat: presentationFormat,
    });

    const eventHandler = new EventHandler(this.canvas);
    let lastTimeStamp = performance.now();

    const resolution = [
      this.canvas.width * window.devicePixelRatio,
      this.canvas.height * window.devicePixelRatio,
    ];
    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((entry) => entry.target === this.canvas);
      if (!entry) return;

      resolution[0] = entry.devicePixelContentBoxSize[0].inlineSize;
      resolution[1] = entry.devicePixelContentBoxSize[0].blockSize;
    });
    observer.observe(this.canvas);

    const render = (timestamp: number) => {
      const deltaTime = Math.min((timestamp - lastTimeStamp) * 0.001, 0.1);
      lastTimeStamp = timestamp;
      eventHandler.update();
      jellySlider.value = eventHandler.currentMouseX;
      jellySlider.update(deltaTime);

      jellySlider.render(
        this.#canvasCtx.getCurrentTexture().createView(),
        resolution[0],
        resolution[1],
      );

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }
}
