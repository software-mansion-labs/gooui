import type { TgpuRoot } from 'typegpu';
import { createPbrSlider } from './pbr-material.ts';

export const createGrass = (root: TgpuRoot) =>
  createPbrSlider(root, 'whispy-grass', {
    uvScale: [0.4, 0.06],
    pomScale: 0.001,
    numLayers: 4,
  });
