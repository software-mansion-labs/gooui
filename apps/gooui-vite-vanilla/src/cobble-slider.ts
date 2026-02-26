import type { TgpuRoot } from 'typegpu';
import { createPbrSlider } from './pbr-material.ts';

export const createCobble = (root: TgpuRoot) =>
  createPbrSlider(root, 'chiseled-cobble', {
    uvScale: [1, 0.2],
    pomScale: 0.019,
  });
