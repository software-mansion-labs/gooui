import "./style.css";
import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";
import { perlin3d } from "@typegpu/noise";
import { CanvasJellySlider } from "gooui";

const appElement = document.querySelector("#app") as HTMLDivElement;

const root = await tgpu.init({
  device: {
    optionalFeatures: ["timestamp-query"],
  },
});

const defaultSlider = new CanvasJellySlider({ root });
appElement.appendChild(defaultSlider.canvas);

const blueSlider = new CanvasJellySlider({
  root,
  jellyColor: d.vec3f(0.3, 0.4, 1),
  glowTint: d.vec3f(0.3, 0.4, 1),
});
appElement.appendChild(blueSlider.canvas);

const checkerBoard = (uv: d.v2f): number => {
  "use gpu";
  const fuv = std.floor(uv);
  return std.abs(fuv.x + fuv.y) % 2;
};






const timeUniform = root.createUniform(d.f32, 0);

function frame(timestamp: number) {
  timeUniform.write(timestamp * 0.001);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const checkerSlider = new CanvasJellySlider({
  root,
  jellyColor: (uv) => {
    "use gpu";
    const suv = uv.mul(d.vec2f(10, 2));

    if (uv.x < 0.5) {
      return d.vec3f(checkerBoard(suv));
    } else {
      const noise = perlin3d.sample(d.vec3f(suv, timeUniform.$));
      return d.vec3f(std.abs(noise) * 5);
    }
  },
});
appElement.appendChild(checkerSlider.canvas);
