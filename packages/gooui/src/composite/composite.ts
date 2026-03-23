import { common, d, TgpuRoot } from 'typegpu';

type DisplacementCtx = d.InferGPU<typeof DisplacementCtx>;
const DisplacementCtx = d.struct({
  uv: d.vec2f,
});

type ColorCtx = d.InferGPU<typeof ColorCtx>;
const ColorCtx = d.struct({
  uv: d.vec2f,
});

export interface DisplacementLayer {
  type: 'displacement';
  /**
   * @returns A 2d vector describing the displacement for each pixel between -1 and 1
   */
  computeDisplacement: (ctx: d.ref<DisplacementCtx>) => d.v2f;
  scale: number;
}

export interface ColorLayer {
  type: 'color';
  computeColor: (ctx: d.ref<ColorCtx>) => d.v4f;
  scale: number;
  blendMode:
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity';
}

export type Layer = DisplacementLayer | ColorLayer;

interface CompositeOptions {
  root: TgpuRoot;
  layers: Layer[];
}

interface Composite {
  readonly options: CompositeOptions;
  readonly groupElement: HTMLDivElement;
  destroy(): void;
}

let lastCompositeId = 0;
function generateCompositeId(): string {
  return `gooui-composite-${lastCompositeId++}`;
}

export function createComposite(options: CompositeOptions): Composite {
  const { root, layers } = options;
  const id = generateCompositeId();

  const groupElement = document.createElement('div');

  const ops: (() => void)[] = [];

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];

    if (layer.type === 'displacement') {
      const renderPipeline = root.createRenderPipeline({
        vertex: common.fullScreenTriangle,
        fragment: ({ uv }) => {
          'use gpu';
          const ctx = DisplacementCtx({ uv });
          const disp = layer.computeDisplacement(d.ref(ctx));
          return d.vec4f(disp * 0.5 + 0.5, 0, 1);
        },
      });

      const filterId = `${id}-filter-${i}`;
      const canvas = document.createElement('canvas');
      canvas.style.display = 'none';
      canvas.width = 256;
      canvas.height = 256;
      document.body.appendChild(canvas);

      const backdropper = document.createElement('div');
      backdropper.style.position = 'absolute';
      backdropper.style.inset = '0';
      backdropper.style.backdropFilter = `url(#${filterId})`;
      groupElement.appendChild(backdropper);

      const svg = document.createElement('svg');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.position = 'absolute';
      svg.style.overflow = 'hidden';

      const defs = document.createElement('defs');
      svg.appendChild(defs);
      defs.innerHTML = `
        <filter
          id="${filterId}"
          colorInterpolationFilters="sRGB"
          width="100%"
          height="100%"
          x="0%"
          y="0%"
        >
          <feImage ref={feImageRef} preserveAspectRatio="none" result="map" />
          <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale="${Number(layer.scale) /* ensuring the injected scale is a number */}"
              xChannelSelector="R"
              yChannelSelector="G"
            />
        </filter>
      `;
      const feImage = defs.querySelector(`feImage`) as SVGFEImageElement;
      groupElement.appendChild(svg);

      const ctx = root.configureContext({ canvas, alphaMode: 'premultiplied' });

      ops.push(() => {
        // Funky browser behavior can change the canvas size unexpectedly, so we reset it to 256x256
        if (canvas.width !== 256 || canvas.height !== 256) {
          canvas.width = 256;
          canvas.height = 256;
        }

        // TODO: Add ability to pass arbitrary uniforms
        // uniforms.write({ time: performance.now() / 1000 });

        renderPipeline.withColorAttachment({ view: ctx }).draw(3);

        // Feed canvas pixels into the SVG feImage each frame
        const dataURL = canvas.toDataURL();
        feImage.setAttribute('href', dataURL);
      });
    } else if (layer.type === 'color') {
      const renderPipeline = root.createRenderPipeline({
        vertex: common.fullScreenTriangle,
        fragment: ({ uv }) => {
          'use gpu';
          const ctx = ColorCtx({ uv });
          const color = layer.computeColor(d.ref(ctx));
          return color;
        },
      });

      const canvas = document.createElement('canvas');
      canvas.style.display = 'none';
      canvas.width = 256;
      canvas.height = 256;
      groupElement.appendChild(canvas);

      const ctx = root.configureContext({ canvas, alphaMode: 'premultiplied' });

      ops.push(() => {
        renderPipeline.withColorAttachment({ view: ctx }).draw(3);
      });
    }
  }

  let frameId: number;

  function loop() {
    frameId = requestAnimationFrame(loop);
  }
  loop();

  return {
    options,
    groupElement,
    destroy() {
      cancelAnimationFrame(frameId);
    },
  };
}
