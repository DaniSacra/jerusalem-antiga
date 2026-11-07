import * as THREE from 'three';

/**
 * Uniforms shared by every patched material: one update per frame changes the whole world
 * (snow on the roofs, wet ground, cloud shadows, lit windows, crop height) with no per-object work.
 */
export const U = {
  uTime: { value: 0 },
  uSnow: { value: 0 },
  uSnowColor: { value: new THREE.Color(0xf2f5fa) },
  uWet: { value: 0 },
  /** Cloud shadows drifting over the land: cover 0..1 and their offset (wind). */
  uCloud: { value: 0 },
  uCloudOffset: { value: new THREE.Vector2() },
  /** Lit windows: share of houses, and the glow colour (times the night). */
  uWindows: { value: 0 },
  uWindowColor: { value: new THREE.Color(0xffb35a) },
  uGrow: { value: 1 },
  uHeat: { value: 0 },
  // Ground colours of the season (terrain).
  uSand: { value: new THREE.Color() },
  uSandDark: { value: new THREE.Color() },
  uGrass: { value: new THREE.Color() },
  uGrassDark: { value: new THREE.Color() },
  uMud: { value: new THREE.Color(0x7d6a4c) },
  uCrack: { value: new THREE.Color(0x6a4e32) },
  uFlowers: { value: 0 },
  uDrought: { value: 0 },
  /** Wind on the plants and cloth: strength 0..1 (0 in the calm: all still) and the way it blows (x, z). */
  uWind: { value: 0 },
  uWindDir: { value: new THREE.Vector2(1, 0.3).normalize() },
  /** Fine grain and patches on the ground (0 at the minimum quality: skipped). */
  uGrain: { value: 1 },
  /** River banks: the water line height now (lower in a drought) and the wet and pale sand colours. */
  uWaterY: { value: -0.16 },
  uBank: { value: new THREE.Color(0xe8dab6) },
  uBankWet: { value: new THREE.Color(0xa89878) },
  /** Trodden ground (wear.ts): the map's wear, its size in cells and the colour of bare earth. */
  uWear: { value: blankWear() as THREE.Texture },
  uMapSize: { value: new THREE.Vector2(1, 1) },
  uTrodden: { value: new THREE.Color(0xb08f68) },
  /** Moist land by the river (fields.ts moistMap, cell per texel): crops away from it dry out in a drought. */
  uMoist: { value: blankWear(255) as THREE.Texture },
  uDryCrop: { value: new THREE.Color(0xb08a52) },
  /** Where buildings stand (wear.ts standMap, cell per texel) and how dark the ground gets at their foot. */
  uStand: { value: blankWear() as THREE.Texture },
  uContact: { value: 0 },
};

/** One texel of `v` (no wear yet: 0; moist everywhere: 255), until the terrain sets the city's. */
function blankWear(v = 0): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([v]), 1, 1, THREE.RedFormat);
  t.needsUpdate = true;
  return t;
}

/**
 * The crops grow with the season (`uGrow`), each field a little taller or shorter than the next (by
 * where it stands), and in a drought the fields away from the river (`uMoist`) grow thin and dry.
 */
const GROW_CHUNK = /* glsl */ `{
  vec2 fp = vec2(-100.0);
  #ifdef USE_INSTANCING
    fp = instanceMatrix[3].xz;
  #endif
  float fh = fract(sin(dot(floor(fp), vec2(12.9898, 78.233))) * 43758.5453);
  vec2 muv = fp / uMapSize;
  float moist = texture2D(uMoist, muv).r;
  vDry = uDrought * (1.0 - moist);
  transformed.y = 0.05 + (transformed.y - 0.05) * uGrow * (0.86 + 0.28 * fh) * (1.0 - 0.5 * vDry);
}`;

/** GLSL noise helpers shared by the patches. */
const NOISE = /* glsl */ `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
`;

export interface PatchOptions {
  /** Snow settles on the upward faces (roofs, ground, crowns). */
  snow?: boolean;
  /** Crop rows: height scaled by uGrow above the soil (model y 0.05). */
  grow?: boolean;
  /** Windows and doors: glow warm at night in a share of the houses (by instance). */
  windows?: boolean;
  /** The terrain: colours from the season uniforms and per-vertex grass/river/noise; cracks and flowers. */
  terrain?: boolean;
  /**
   * Plants sway in the wind (vertex shader, by the height above the ground: tall palms more than
   * olives, crops in waves running across the field): the bend at 1 unit up at full wind.
   */
  wind?: number;
  /** The crop waves of the fields (with `wind`): the rows bend in travelling waves. */
  waves?: boolean;
  /** Cloth in the wind by its `aFlap` weights (models.ts): washing swings, awnings billow. */
  cloth?: boolean;
}

const patched = new WeakSet<THREE.Material>();

/**
 * Patches a standard material in place with the world effects (see U). All patched materials
 * share the uniforms; each option set compiles its own program once.
 */
export function patch(m: THREE.Material, o: PatchOptions = { snow: true }): THREE.Material {
  if (patched.has(m)) return m;
  patched.add(m);
  const key = `w${o.snow ? 's' : ''}${o.grow ? 'g' : ''}${o.windows ? 'n' : ''}${o.terrain ? 't' : ''}${o.wind ? `i${o.wind}${o.waves ? 'v' : ''}` : ''}${o.cloth ? 'c' : ''}`;
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorld; varying float vUp; varying float vInst; varying vec3 vTint;
        uniform float uGrow; uniform float uHeat; uniform float uTime;
        ${o.wind || o.cloth ? 'uniform float uWind; uniform vec2 uWindDir;' : ''}
        ${o.cloth ? 'attribute vec2 aFlap;' : ''}
        ${o.grow ? 'uniform sampler2D uMoist; uniform vec2 uMapSize; uniform float uDrought; varying float vDry;' : ''}
        ${o.terrain ? 'attribute vec3 aGround; varying vec3 vGround;' : ''}`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        // The instance tint alone (vColor also carries the vertex colours of the house kits).
        vTint = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor.rgb;
        #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${o.grow ? GROW_CHUNK : ''}
        ${o.wind ? windChunk(o.wind, !!o.waves) : ''}
        ${o.cloth ? CLOTH_CHUNK : ''}`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 wp = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        vInst = 0.0;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp; wn = mat3(instanceMatrix) * wn;
          vInst = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #endif
        wp = modelMatrix * wp;
        vWorld = wp.xyz;
        vUp = normalize(mat3(modelMatrix) * wn).y;
        ${o.terrain ? `vGround = aGround;
        // Heat shimmer: the far land trembles over the horizon in summer.
        float far = smoothstep(45.0, 95.0, distance(wp.xz, cameraPosition.xz));
        transformed.y += uHeat * far * 0.35 * sin(uTime * 7.0 + wp.x * 0.9 + wp.z * 0.4);` : ''}
        #include <project_vertex>`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorld; varying float vUp; varying float vInst; varying vec3 vTint;
        uniform float uSnow; uniform vec3 uSnowColor; uniform float uWet; uniform float uCloud; uniform vec2 uCloudOffset;
        uniform float uWindows; uniform vec3 uWindowColor;
        ${o.grow ? 'varying float vDry; uniform vec3 uDryCrop;' : ''}
        ${o.terrain ? 'varying vec3 vGround; uniform vec3 uSand, uSandDark, uGrass, uGrassDark, uMud, uCrack, uBank, uBankWet; uniform float uFlowers, uDrought, uGrain, uWaterY; uniform sampler2D uWear; uniform vec2 uMapSize; uniform vec3 uTrodden; uniform sampler2D uStand; uniform float uContact;' : ''}
        ${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${o.terrain ? TERRAIN_COLOR : ''}
        #ifdef USE_COLOR
          // (USE_COLOR: the fragment side of the instance colours.) An empty house (tint VACANT_TINT, under 0.8): faded and dusty, not just darker.
          if (vTint.r < 0.8) {
            vec3 base = diffuseColor.rgb / max(vTint, vec3(0.05));
            float lum = dot(base, vec3(0.299, 0.587, 0.114));
            diffuseColor.rgb = mix(base, vec3(lum) * vec3(1.02, 0.97, 0.88), 0.7) * 0.92 + vec3(0.04, 0.035, 0.025);
          }
        #endif
        float up = smoothstep(0.55, 0.9, vUp);
        ${o.snow ? `float snowK = uSnow * up * smoothstep(0.25, 0.55, vnoise(vWorld.xz * 0.7) * 0.6 + uSnow * 0.7 - 0.15);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, snowK);` : 'float snowK = 0.0;'}
        float wetK = uWet * (1.0 - snowK) * (0.4 + 0.6 * up);
        diffuseColor.rgb *= 1.0 - 0.32 * wetK;
        float cs = uCloud * smoothstep(0.45, 0.75, vnoise(vWorld.xz * 0.045 + uCloudOffset));
        diffuseColor.rgb *= 1.0 - 0.35 * cs;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.28, wetK);`,
      );
    if (o.windows)
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float lit = step(vInst, uWindows) * (0.85 + 0.15 * sin(vInst * 50.0 + vWorld.x));
        #ifdef USE_COLOR
          // Empty houses are drawn dimmer (see VACANT_TINT): nobody lights their windows.
          lit *= step(0.8, vTint.r);
        #endif
        totalEmissiveRadiance += uWindowColor * lit;`,
      );
  };
  m.needsUpdate = true;
  return m;
}

/**
 * The wind bend, in the vertex shader (no CPU): the model's vertices lean the way the wind blows by
 * the square of their height (the trunk foot stays put), in slow gusts that run across the land by
 * the copy's place, with a quick flutter on top. Fields bend in waves along the rows. The world
 * direction is brought into the copy's own space (rotation and uniform scale) so every tree leans
 * the same way. The shadows keep the still shape (cheap, and nobody notices).
 */
function windChunk(k: number, waves: boolean): string {
  return /* glsl */ `{
    vec3 ip = vec3(0.0); mat3 im = mat3(1.0);
    #ifdef USE_INSTANCING
      ip = instanceMatrix[3].xyz; im = mat3(instanceMatrix);
    #endif
    float hy = max(transformed.y, 0.0);
    vec2 wd = uWindDir;
    float gust = 0.6 + 0.4 * sin(uTime * 0.9 + dot(ip.xz, vec2(0.21, 0.13)));
    ${waves
      ? `vec2 vp = (im * transformed).xz + ip.xz;
    float sway = uWind * (0.55 + 0.45 * sin(uTime * 2.4 - dot(vp, wd) * 2.2)) * gust;`
      : `float sway = uWind * gust * (0.75 + 0.25 * sin(uTime * 1.7 + ip.x * 1.3 + ip.z * 0.7)) + uWind * 0.12 * sin(uTime * 6.0 + transformed.x * 9.0 + ip.z);`}
    vec3 bend = vec3(wd.x, 0.0, wd.y) * (${k.toFixed(4)} * hy * hy * sway);
    // World offset -> the copy's space: transpose of the rotation, over the scale.
    float sc2 = max(dot(im[0], im[0]), 1e-4);
    transformed += (transpose(im) * bend) / sc2;
    transformed.y -= ${(k * 0.25).toFixed(4)} * hy * hy * sway * sway * hy;
  }`;
}

/**
 * Cloth in the wind, in the vertex shader (no CPU): a hanging cloth swings the way the wind blows,
 * more at its hem (aFlap.x), with a ripple running along it; an awning billows up and down in its
 * middle (aFlap.y). Still in the calm (as the plants); the gusts run across the town by the copy's
 * place, as the plants'. The world direction is brought into the copy's space as in `windChunk`.
 */
const CLOTH_CHUNK = /* glsl */ `{
  vec3 ip = vec3(0.0); mat3 im = mat3(1.0);
  #ifdef USE_INSTANCING
    ip = instanceMatrix[3].xyz; im = mat3(instanceMatrix);
  #endif
  float breath = uWind;
  float gust = 0.6 + 0.4 * sin(uTime * 0.9 + dot(ip.xz, vec2(0.21, 0.13)));
  float ripple = sin(uTime * 3.4 + dot(ip.xz, vec2(1.7, 1.3)) + (transformed.x + transformed.z) * 9.0);
  vec3 push = vec3(uWindDir.x, 0.0, uWindDir.y) * aFlap.x * (0.1 * uWind * gust + 0.025 * breath * ripple);
  float sc2 = max(dot(im[0], im[0]), 1e-4);
  transformed += (transpose(im) * push) / sc2;
  transformed.y += aFlap.x * 0.03 * uWind * gust * gust - aFlap.y * 0.035 * breath * (0.5 + 0.5 * gust) * sin(uTime * 2.6 + ip.x * 1.3 + ip.z * 0.9);
}`;

/**
 * The lit window pane of a .glb house (instanced, see WINDOWS_AT): black by day and in the houses
 * that keep their windows dark, a warm square with a soft halo at night. Added on top (additive),
 * so it never shows by day and needs no texture.
 */
export function paneMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uWindows: U.uWindows, uWindowColor: U.uWindowColor },
    vertexShader: /* glsl */ `
      uniform float uWindows;
      varying vec2 vUv; varying float vLit;
      void main() {
        vUv = uv;
        vec4 p = vec4(position, 1.0);
        float inst = 0.0;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          inst = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #endif
        vLit = step(inst, uWindows) * (0.85 + 0.15 * fract(inst * 37.0));
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uWindowColor;
      varying vec2 vUv; varying float vLit;
      void main() {
        if (vLit <= 0.0) discard;
        vec2 d = abs(vUv - 0.5) * 2.0;
        float core = (1.0 - smoothstep(0.2, 0.34, max(d.x, d.y * 0.8))) * 0.85;
        float halo = pow(max(0.0, 1.0 - length(d)), 2.0) * 0.4;
        gl_FragColor = vec4(uWindowColor * (core + halo) * vLit, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** Terrain colour: sand and grass of the season by the per-vertex share, river mud, drought cracks, spring flowers. */
const TERRAIN_COLOR = /* glsl */ `
  float n = vGround.z;
  vec3 g = mix(mix(uSand, uSandDark, n * 0.6), mix(uGrass, uGrassDark, n), vGround.x);
  // Grain and patches (off at the minimum quality): broad patches two or three cells wide and a fine
  // grain that fades with the distance (no shimmer far away).
  if (uGrain > 0.0) {
    float patchK = vnoise(vWorld.xz * 0.38 + 7.0) * 0.65 + vnoise(vWorld.xz * 1.1 - 3.0) * 0.35;
    float near = 1.0 - smoothstep(18.0, 55.0, distance(vWorld, cameraPosition));
    float grain = vnoise(vWorld.xz * 11.0) - 0.5;
    g *= 1.0 + uGrain * ((patchK - 0.5) * 0.2 + grain * 0.14 * near);
  }
  // Trodden earth (wear.ts): before the doors, along the roads, the paths between houses; its edge
  // broken by noise so the patches read as worn ground, not as painted shapes.
  vec2 wuv = vWorld.xz / uMapSize;
  float wear = texture2D(uWear, wuv).r * step(0.0, wuv.x) * step(wuv.x, 1.0) * step(0.0, wuv.y) * step(wuv.y, 1.0);
  if (wear > 0.002) {
    float wb = smoothstep(0.08, 0.7, wear + (vnoise(vWorld.xz * 2.7) - 0.5) * 0.32);
    g = mix(g, uTrodden * (0.9 + 0.2 * vnoise(vWorld.xz * 7.0)), wb * 0.88);
  }
  // Contact shadow: the ground darkens softly at the foot of the buildings (stronger without sun).
  float stand = texture2D(uStand, wuv).r;
  g *= 1.0 - uContact * smoothstep(0.0, 0.5, stand);
  // River banks: a pale band of sand above the water line, wet and dark at the water's edge; in a
  // drought the uncovered bed and the bank are mud, as before.
  float riverK = smoothstep(0.0, 0.06, vGround.y);
  float above = vWorld.y - uWaterY;
  float bank = riverK * smoothstep(-0.05, -0.01, above) * (1.0 - smoothstep(0.1, 0.17, above)) * (1.0 - uDrought);
  float wetLine = bank * (1.0 - smoothstep(0.0, 0.05, above));
  g = mix(g, uMud, min(1.0, vGround.y * 1.6) * (1.0 - bank));
  g = mix(g, mix(uBank, uBankWet, wetLine), bank * 0.85);
  // Cracked earth in a drought: dark lines along the borders of small cells (Voronoi-like edges).
  if (uDrought > 0.01) {
    vec2 cp = vWorld.xz * 0.95;
    vec2 ci = floor(cp); vec2 cf = fract(cp);
    float d1 = 9.0, d2 = 9.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 r = o + vec2(h21(ci + o), h21(ci + o + 17.0)) - cf;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    float edge = 1.0 - smoothstep(0.03, 0.2, sqrt(d2) - sqrt(d1));
    g = mix(g, uCrack, uDrought * edge * 0.9 * (1.0 - vGround.x * 0.3));
  }
  // Small flowers on the grass in spring: a few bright dots per cell.
  vec2 fp = vWorld.xz * 7.0;
  float fh = h21(floor(fp));
  float dotK = uFlowers <= 0.0 ? 0.0 : step(1.0 - 0.07 * uFlowers * vGround.x, fh) * (1.0 - smoothstep(0.18, 0.32, length(fract(fp) - 0.5)));
  vec3 fc = fh > 0.985 ? vec3(0.95, 0.85, 0.2) : fh > 0.975 ? vec3(0.95, 0.95, 0.95) : vec3(0.85, 0.15, 0.12);
  g = mix(g, fc, dotK);
  diffuseColor.rgb = g;
`;

/** Sets a uniform colour from a 0xrrggbb number. */
export const setColor = (u: { value: THREE.Color }, hex: number) => u.value.setHex(hex);
