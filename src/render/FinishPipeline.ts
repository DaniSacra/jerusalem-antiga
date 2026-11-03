import Phaser from 'phaser';

/**
 * Image finish of the map camera in one cheap pass: a soft vignette and an optional miniature blur
 * that grows toward the top and bottom edges (the middle band stays sharp). 9 texture reads per
 * pixel at most, and none extra when the blur is off. In summer the air shimmers with the heat
 * (the picture wobbles a pixel or two sideways in thin bands).
 */
const FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uBlur;
uniform float uBand;
uniform float uVignette;
uniform float uVignetteRadius;
uniform float uShimmer;
uniform float uTime;
varying vec2 outTexCoord;

void main() {
  vec2 uv = outTexCoord;
  if (uShimmer > 0.0) {
    // Heat shimmer: thin horizontal bands of air wobbling sideways, stronger low on the screen.
    float w = sin(uv.y * 220.0 + uTime * 5.0) * sin(uv.y * 37.0 - uTime * 1.3);
    uv.x += w * uShimmer * (1.4 - uv.y) / uResolution.x;
  }
  vec4 col = texture2D(uMainSampler, uv);
  if (uBlur > 0.0) {
    float edge = smoothstep(uBand, 1.0, abs(uv.y - 0.5) * 2.0);
    vec2 px = edge * uBlur / uResolution;
    if (edge > 0.01) {
      vec4 acc = col * 0.2;
      acc += texture2D(uMainSampler, uv + vec2(px.x, 0.0)) * 0.1;
      acc += texture2D(uMainSampler, uv - vec2(px.x, 0.0)) * 0.1;
      acc += texture2D(uMainSampler, uv + vec2(0.0, px.y)) * 0.1;
      acc += texture2D(uMainSampler, uv - vec2(0.0, px.y)) * 0.1;
      acc += texture2D(uMainSampler, uv + px * 0.7) * 0.1;
      acc += texture2D(uMainSampler, uv - px * 0.7) * 0.1;
      acc += texture2D(uMainSampler, uv + vec2(px.x, -px.y) * 0.7) * 0.1;
      acc += texture2D(uMainSampler, uv + vec2(-px.x, px.y) * 0.7) * 0.1;
      col = acc;
    }
  }
  vec2 d = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  col.rgb *= 1.0 - uVignette * smoothstep(uVignetteRadius, uVignetteRadius + 0.55, length(d));
  gl_FragColor = col;
}
`;

export class FinishPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  static readonly KEY = 'Finish';
  /** Blur radius in pixels at the very edge (0 = off). */
  blur = 0;
  band = 0.45;
  vignette = 0.3;
  vignetteRadius = 0.55;
  /** Heat shimmer amplitude in pixels (0 = off). */
  shimmer = 0;

  constructor(game: Phaser.Game) {
    super({ game, name: FinishPipeline.KEY, fragShader: FRAG });
  }

  onPreRender() {
    this.set1f('uBlur', this.blur);
    this.set1f('uBand', this.band);
    this.set1f('uVignette', this.vignette);
    this.set1f('uVignetteRadius', this.vignetteRadius);
    this.set1f('uShimmer', this.shimmer);
    this.set1f('uTime', this.game.loop.time / 1000);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
  }
}
