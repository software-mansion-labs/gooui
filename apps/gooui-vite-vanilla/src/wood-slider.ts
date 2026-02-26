import type { TgpuRoot } from 'typegpu';
import { createPbrSlider } from './pbr-material.ts';

export const createWood = (root: TgpuRoot) =>
  createPbrSlider(root, 'oak-wood-bare', {
    uvScale: [1, 0.2],
    pomScale: 0.0005,
  });
