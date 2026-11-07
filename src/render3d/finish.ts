import * as THREE from 'three';
import LOOK from './look3d.json';

const F = LOOK.finish;

/**
 * The "maquete" finish, one cheap pass over the whole picture: the scene is drawn into a buffer, then
 * a full-screen triangle blurs the top and the bottom of the screen (tilt-shift: the town looks like
 * a model on a table), grades it a little warmer with a touch of contrast, and does the tone mapping
 * the scene would have done on the screen. 9 texture reads a pixel, only where it blurs. Off at the
 * minimum quality: the scene then draws straight to the screen as before.
 */
export class Finish {
  private target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor() {
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: F.samples });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uBlur: { value: F.blur },
        uBand: { value: F.band },
        uFade: { value: F.fade },
        uWarm: { value: F.warm },
        uContrast: { value: F.contrast },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform vec2 uTexel;
        uniform float uBlur, uBand, uFade, uWarm, uContrast;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tScene, vUv);
          // Tilt-shift: sharp in a band across the middle, softer toward the top and the bottom.
          float k = smoothstep(uBand, uBand + uFade, abs(vUv.y - 0.5));
          if (k > 0.01) {
            vec2 r = uTexel * uBlur * k;
            vec4 sum = c * 0.2;
            sum += texture2D(tScene, vUv + vec2(r.x, 0.0)) * 0.1;
            sum += texture2D(tScene, vUv - vec2(r.x, 0.0)) * 0.1;
            sum += texture2D(tScene, vUv + vec2(0.0, r.y)) * 0.1;
            sum += texture2D(tScene, vUv - vec2(0.0, r.y)) * 0.1;
            sum += texture2D(tScene, vUv + r * 1.2) * 0.1;
            sum += texture2D(tScene, vUv - r * 1.2) * 0.1;
            sum += texture2D(tScene, vUv + vec2(r.x, -r.y) * 1.2) * 0.1;
            sum += texture2D(tScene, vUv + vec2(-r.x, r.y) * 1.2) * 0.1;
            c = sum;
          }
          gl_FragColor = c;
          #include <tonemapping_fragment>
          // Grading: a little contrast about the mid grey, and warmer.
          gl_FragColor.rgb = max((gl_FragColor.rgb - 0.18) * uContrast + 0.18, 0.0) * vec3(1.0 + uWarm, 1.0, 1.0 - uWarm);
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  /** Matches the buffer to the canvas's drawing size (call after a resize or a pixel ratio change). */
  setSize(renderer: THREE.WebGLRenderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target.setSize(size.x, size.y);
    this.material.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
    this.material.uniforms.uBlur.value = F.blur * renderer.getPixelRatio();
  }

  /** Draws `scene` through the finish to the screen; returns the scene's own draw calls and triangles (before the finish's). */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): { calls: number; triangles: number } {
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    const { calls, triangles } = renderer.info.render;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
    return { calls, triangles };
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
