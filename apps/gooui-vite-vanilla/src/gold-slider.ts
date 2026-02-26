import type { TgpuRoot } from 'typegpu';
import { createPbrSlider } from './pbr-material.ts';

export const createGold = (root: TgpuRoot) =>
  createPbrSlider(root, 'fancy-scaled-gold', {
    uvScale: [1, 0.2],
    pomScale: 0.001,
    glowTint: [0.8, 0.6, 0.0],
  });
