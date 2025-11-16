import type { TgpuRoot } from "typegpu";
import type * as d from "typegpu/data";
import type { MaterialContext } from "./data-types.ts";
import { EventHandler } from "./events.ts";
import { JellySlider } from "./jelly-slider.ts";

export interface CanvasJellySliderOptions {
  root: TgpuRoot;
  jellyColor?: d.v3f | ((ctx: MaterialContext) => d.v3f) | undefined;
  glowTint?: d.v3f | ((x: number) => d.v3f) | undefined;
  material?: ((ctx: MaterialContext) => d.v3f) | undefined;
  /**
   * @default true
   */
  refractedHighlight?: boolean | undefined;
}

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

export class CanvasJellySlider {
  readonly canvas: HTMLCanvasElement;

  #canvasCtx: GPUCanvasContext;

  constructor(options: CanvasJellySliderOptions) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.right = "0";
    this.canvas.style.bottom = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
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
      material: options.material,
      refractedHighlight: options.refractedHighlight,
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
      this.canvas.width = resolution[0];
      this.canvas.height = resolution[1];
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
