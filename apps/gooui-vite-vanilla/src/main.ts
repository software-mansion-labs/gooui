import './style.css';
import { CanvasJellySlider } from 'gooui';
import tgpu from 'typegpu';
// import { createWood } from "./wood-slider.ts";
// import { createCobble } from "./cobble-slider.ts";
import { createGold } from './gold-slider.ts';
// import { createGrass } from "./grass-slider.ts";

const appElement = document.querySelector('#app') as HTMLDivElement;
const root = await tgpu.init();

// const wood = await createWood(root);
// const cobble = await createCobble(root);
const gold = await createGold(root);
// const grass = await createGrass(root);

const slider = new CanvasJellySlider({
  root,
  // ...wood,
  // ...cobble,
  ...gold,
  // ...grass,
});
appElement.appendChild(slider.canvas);
