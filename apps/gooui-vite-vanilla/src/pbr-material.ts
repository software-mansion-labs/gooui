import type { MaterialContext } from 'gooui';
import tgpu, { d, std } from 'typegpu';
import type { TgpuRoot } from 'typegpu';
import { randf } from '@typegpu/noise';

const pbrLayout = tgpu.bindGroupLayout({
  pbrMaps: { texture: d.texture2dArray(d.f32) },
  pbrSampler: { sampler: 'filtering' },
});

// Texture array layer indices
const PBR_ALBEDO = 0;
const PBR_NORMAL = 1;
const PBR_ROUGHNESS = 2;
const PBR_METALLIC = 3;
const PBR_AO = 4;
const PBR_HEIGHT = 5;

export const D_GGX = (NdotH: number, roughness: number): number => {
  'use gpu';
  const a = roughness * roughness;
  const a2 = a * a;
  const denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (Math.PI * denom * denom);
};

export const G_SchlickGGX = (NdotX: number, roughness: number): number => {
  'use gpu';
  const r = roughness + 1.0;
  const k = (r * r) / 8.0;
  return NdotX / (NdotX * (1.0 - k) + k);
};

export const fresnelSchlickVec = (cosTheta: number, f0: d.v3f): d.v3f => {
  'use gpu';
  const t = std.pow(std.max(1.0 - cosTheta, 0.0), 5.0);
  return f0.add(d.vec3f(1.0).sub(f0).mul(t));
};

export interface PbrParams {
  uvScale: [number, number];
  uvRotationDeg?: number;
  pomScale?: number;
  numLayers?: number;
  lightColor?: [number, number, number];
  skyColor?: [number, number, number];
  glowTint?: [number, number, number];
}

export function createPbrMaterial(params: PbrParams): (ctx: MaterialContext) => d.v3f {
  const {
    uvScale: [uScl, vScl],
    uvRotationDeg = 0,
    pomScale: pomScaleNum = 0.005,
    numLayers = 32,
    lightColor: [lr, lg, lb] = [3.5, 2.8, 2.0],
    skyColor: [sr, sg, sb] = [0.2, 0.25, 0.35],
  } = params;

  const cosA = Math.cos((uvRotationDeg * Math.PI) / 180);
  const sinA = Math.sin((uvRotationDeg * Math.PI) / 180);
  const layerStepNum = 1.0 / numLayers;

  return (ctx: MaterialContext): d.v3f => {
    'use gpu';

    const N = ctx.normal;
    // Mirror N.z so the frame is symmetric across Z=0 (avoids the flip from
    // std.sign(position.z) in the slider's normal computation).
    const Nframe = d.vec3f(N.x, N.y, std.abs(N.z));
    // Duff et al. 2017 (Pixar) ONB — closed-form, no threshold switches,
    // smooth everywhere for Nframe.z >= 0. Eliminates seams at bend points.
    const onb_a = d.f32(-1.0) / (d.f32(1.0) + Nframe.z);
    const onb_b = Nframe.x * Nframe.y * onb_a;
    const T = d.vec3f(d.f32(1.0) + Nframe.x * Nframe.x * onb_a, onb_b, -Nframe.x);
    const B = d.vec3f(onb_b, d.f32(1.0) + Nframe.y * Nframe.y * onb_a, -Nframe.y);

    const V = std.neg(ctx.viewDir);

    const tiledUV = ctx.uv.mul(d.vec2f(uScl, vScl));
    const baseUV = d.vec2f(
      tiledUV.x * cosA - tiledUV.y * sinA,
      tiledUV.x * sinA + tiledUV.y * cosA,
    );

    // Parallax Occlusion Mapping
    // Use Nframe (abs N.z) for V_ts.z so it's always positive on visible surfaces
    const V_ts = d.vec3f(std.dot(V, T), std.dot(V, B), std.dot(V, Nframe));
    const vz = std.max(V_ts.z, d.f32(0.001));
    const pomScale = d.f32(pomScaleNum);
    const layerStep = d.f32(layerStepNum);
    const pomFade = std.smoothstep(0.2, 0.6, V_ts.z);
    const stepUV = V_ts.xy
      .div(vz)
      .mul(pomScale * pomFade)
      .mul(layerStep);

    let pomUV = d.vec2f(baseUV);
    let currentLayerDepth = randf.sample() * 3 * layerStep;

    for (let i = 0; i < numLayers; i++) {
      const h = std.textureSampleLevel(
        pbrLayout.$.pbrMaps,
        pbrLayout.$.pbrSampler,
        pomUV,
        PBR_HEIGHT,
        d.f32(0),
      ).x;
      if (currentLayerDepth > h) {
        break;
      }
      currentLayerDepth = currentLayerDepth + layerStep;
      pomUV = pomUV.add(stepUV);
    }

    const uv = pomUV;

    // Sample PBR maps
    const albedo = std.textureSampleLevel(
      pbrLayout.$.pbrMaps,
      pbrLayout.$.pbrSampler,
      uv,
      PBR_ALBEDO,
      d.f32(0),
    ).xyz;
    const normalSample = std.textureSampleLevel(
      pbrLayout.$.pbrMaps,
      pbrLayout.$.pbrSampler,
      uv,
      PBR_NORMAL,
      d.f32(0),
    ).xyz;
    const roughness = std.textureSampleLevel(
      pbrLayout.$.pbrMaps,
      pbrLayout.$.pbrSampler,
      uv,
      PBR_ROUGHNESS,
      d.f32(0),
    ).x;
    const metallic = std.textureSampleLevel(
      pbrLayout.$.pbrMaps,
      pbrLayout.$.pbrSampler,
      uv,
      PBR_METALLIC,
      d.f32(0),
    ).x;
    const ao = std.textureSampleLevel(
      pbrLayout.$.pbrMaps,
      pbrLayout.$.pbrSampler,
      uv,
      PBR_AO,
      d.f32(0),
    ).x;

    // Normal mapping: decode tangent-space normal and transform to world space
    const ntsRaw = normalSample.mul(2.0).sub(d.vec3f(1.0));
    const nts = d.vec3f(ntsRaw.x, ntsRaw.y, ntsRaw.z * 0.8);
    const worldN = std.normalize(T.mul(nts.x).add(B.mul(nts.y)).add(N.mul(nts.z)));

    // Cook-Torrance BRDF
    const L = std.neg(ctx.lightDir);
    const H = std.normalize(V.add(L));

    const NdotV = std.max(std.dot(worldN, V), 0.0001);
    const NdotL = std.max(std.dot(worldN, L), 0.0);
    const NdotH = std.max(std.dot(worldN, H), 0.0);
    const HdotV = std.max(std.dot(H, V), 0.0);

    const f0 = std.mix(d.vec3f(0.04), albedo, metallic);

    const D = D_GGX(NdotH, roughness);
    const G = G_SchlickGGX(NdotV, roughness) * G_SchlickGGX(NdotL, roughness);
    const F = fresnelSchlickVec(HdotV, f0);

    const specular = F.mul((D * G) / std.max(4.0 * NdotV * NdotL, 0.0001));
    const kD = d
      .vec3f(1.0)
      .sub(F)
      .mul(1.0 - metallic);
    const diffuse = kD.mul(albedo).mul(d.f32(1.0 / Math.PI));

    const lightColor = d.vec3f(lr, lg, lb);
    const skyColor = d.vec3f(sr, sg, sb);
    const radiance = lightColor.mul(NdotL);
    const ambient = albedo
      .mul(ao)
      .mul(d.f32(0.3))
      .add(albedo.mul(skyColor).mul(ao * 0.1));

    return ambient.add(diffuse.add(specular).mul(radiance));
  };
}

export async function createPbrSlider(root: TgpuRoot, folder: string, params: PbrParams) {
  const names = ['albedo', 'normal', 'roughness', 'metallic', 'ao', 'height'];
  const bitmaps = await Promise.all(
    names.map(async (name) => {
      const res = await fetch(`/${folder}/${name}.png`);
      return createImageBitmap(await res.blob());
    }),
  );

  const pbrTexture = root['~unstable']
    .createTexture({
      dimension: '2d',
      size: [bitmaps[0].width, bitmaps[0].height, names.length],
      format: 'rgba8unorm',
    })
    .$usage('sampled', 'render');
  pbrTexture.write(bitmaps);

  const pbrSampler = root['~unstable'].createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    mipmapFilter: 'linear',
  });

  const bindGroup = root.createBindGroup(pbrLayout, {
    pbrMaps: pbrTexture,
    pbrSampler,
  });

  const [gt0 = 0, gt1 = 0, gt2 = 0] = params.glowTint ?? [0, 0, 0];

  return {
    material: createPbrMaterial(params),
    glowTint: d.vec3f(gt0, gt1, gt2),
    refractedHighlight: false,
    extraBindGroups: [bindGroup],
  };
}
