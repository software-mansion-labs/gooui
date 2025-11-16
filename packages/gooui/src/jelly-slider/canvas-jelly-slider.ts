import type { TgpuRoot } from "typegpu";
import { EventHandler } from "./events.ts";

export interface CanvasJellySliderOptions {
  root: TgpuRoot;
}

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

export class CanvasJellySlider {
  readonly canvas: HTMLCanvasElement;

  #canvasCtx: GPUCanvasContext;

  constructor(options: CanvasJellySliderOptions) {
    this.canvas = document.createElement("canvas");
    this.#canvasCtx = this.canvas.getContext("webgpu") as GPUCanvasContext;

    this.#canvasCtx.configure({
      device: options.root.device,
      format: presentationFormat,
      alphaMode: "premultiplied",
    });

    const eventHandler = new EventHandler(this.canvas);
    let lastTimeStamp = performance.now();

    const update = (timestamp: number) => {
      const deltaTime = Math.min((timestamp - lastTimeStamp) * 0.001, 0.1);
      lastTimeStamp = timestamp;
      eventHandler.update();
      // this.#slider.setDragX(eventHandler.currentMouseX);
      // this.#slider.update(deltaTime);
    };
  }
}
