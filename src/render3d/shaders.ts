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
};

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
}

const patched = new WeakSet<THREE.Material>();

/**
 * Patches a standard material in place with the world effects (see U). All patched materials
 * share the uniforms; each option set compiles its own program once.
 */
export function patch(m: THREE.Material, o: PatchOptions = { snow: true }): THREE.Material {
  if (patched.has(m)) return m;
  patched.add(m);
  const key = `w${o.snow ? 's' : ''}${o.grow ? 'g' : ''}${o.windows ? 'n' : ''}${o.terrain ? 't' : ''}`;
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorld; varying float vUp; varying float vInst;
        uniform float uGrow; uniform float uHeat; uniform float uTime;
        ${o.terrain ? 'attribute vec3 aGround; varying vec3 vGround;' : ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${o.grow ? 'transformed.y = 0.05 + (transformed.y - 0.05) * uGrow;' : ''}`,
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
        varying vec3 vWorld; varying float vUp; varying float vInst;
        uniform float uSnow; uniform vec3 uSnowColor; uniform float uWet; uniform float uCloud; uniform vec2 uCloudOffset;
        uniform float uWindows; uniform vec3 uWindowColor;
        ${o.terrain ? 'varying vec3 vGround; uniform vec3 uSand, uSandDark, uGrass, uGrassDark, uMud, uCrack; uniform float uFlowers, uDrought;' : ''}
        ${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${o.terrain ? TERRAIN_COLOR : ''}
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
        totalEmissiveRadiance += uWindowColor * lit;`,
      );
  };
  m.needsUpdate = true;
  return m;
}

/** Terrain colour: sand and grass of the season by the per-vertex share, river mud, drought cracks, spring flowers. */
const TERRAIN_COLOR = /* glsl */ `
  float n = vGround.z;
  vec3 g = mix(mix(uSand, uSandDark, n * 0.6), mix(uGrass, uGrassDark, n), vGround.x);
  g = mix(g, uMud, min(1.0, vGround.y * 1.6));
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
