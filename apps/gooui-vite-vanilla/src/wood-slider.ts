import type { MaterialContext } from "gooui";
import "./style.css";
import { perlin2d } from "@typegpu/noise";
import tgpu from "typegpu";
import * as d from "typegpu/data";
import * as std from "typegpu/std";

const dark = d.vec3f(0.3, 0.15, 0.1);
const light = d.vec3f(0.8, 0.6, 0.4);

export const woodMaterial = (ctx: MaterialContext): d.v3f => {
  "use gpu";
  const uv1 = ctx.uv.mul(10);
  const layer1_1 = perlin2d.sample(uv1);
  const layer1_2 = perlin2d.sample(uv1.mul(2)) * 0.5;
  const layer1_3 = perlin2d.sample(uv1.mul(4)) * 0.25;
  const layer1_4 = perlin2d.sample(uv1.mul(8)) * 0.125;
  const base = layer1_1 + layer1_2 + layer1_3 + layer1_4;

  const uv2 = ctx.uv.add(d.vec2f(-0.2, -0.3)).mul(d.vec2f(10, 15));
  const dispUv = ctx.uv.mul(5);
  const disp = d
    .vec2f(perlin2d.sample(dispUv), perlin2d.sample(dispUv.add(d.vec2f(100))))
    .mul(1);
  const ringLayer = std.sin(std.length(uv2.add(disp)) * 5) * 0.5 + 0.5;

  const albedo = d
    .vec3f(std.mix(dark, light, std.saturate(ringLayer * 0.8 + base * 0.5)))
    .mul(0.7);

  // Lighting
  const att = std.max(0, std.dot(ctx.normal, std.neg(ctx.lightDir)));

  return albedo.mul(att + 0.5);
};

export const wood = {
  material: woodMaterial,
  // No glow
  glowTint: d.vec3f(),
  refractedHighlight: false,
};
