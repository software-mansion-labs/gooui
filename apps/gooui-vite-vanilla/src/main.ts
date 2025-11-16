import "./style.css";
import tgpu from "typegpu";
import { CanvasJellySlider } from "gooui";

const appElement = document.querySelector("#app") as HTMLDivElement;

const root = await tgpu.init({
  device: {
    optionalFeatures: ["timestamp-query"],
  },
});

const slider = new CanvasJellySlider({ root });
appElement.appendChild(slider.canvas);
