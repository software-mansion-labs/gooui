import "./style.css";
import { CanvasJellySlider } from "gooui";
import tgpu from "typegpu";
import * as d from "typegpu/data";
import { wood } from "./wood-slider.ts";

const appElement = document.querySelector("#app") as HTMLDivElement;
const root = await tgpu.init();

const slider = new CanvasJellySlider({
  root,
  ...wood,
});
appElement.appendChild(slider.canvas);
