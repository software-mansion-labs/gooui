import "./style.css";
import { CanvasJellySlider } from "gooui";
import tgpu from "typegpu";
import { wood } from "./wood-slider.ts";

const appElement = document.querySelector("#app") as HTMLDivElement;
const root = await tgpu.init();

const container = document.createElement("div");
container.classList.add("slider-container");
appElement.appendChild(container);

const slider = new CanvasJellySlider({
  root,
  ...wood,
});
container.appendChild(slider.canvas);
