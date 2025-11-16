import "./style.css";
import { CanvasJellySlider } from "gooui";
import tgpu from "typegpu";

const appElement = document.querySelector("#app") as HTMLDivElement;
const root = await tgpu.init();

const slider = new CanvasJellySlider({ root });
appElement.appendChild(slider.canvas);
