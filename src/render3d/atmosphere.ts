import * as THREE from 'three';
import LOOK from './look3d.json';
import type { FrameLight } from './time/light';

const SKY_RADIUS = 300;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

/** Sky: gradient from the horizon to the top, sun glow, stars at night, drifting clouds, heat shimmer over the horizon. */
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uStars; uniform float uClouds; uniform vec3 uCloudColor; uniform float uTime; uniform vec2 uWind; uniform float uHeat;
varying vec3 vDir;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.1) * 0.3 + vnoise(p * 4.3) * 0.15; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  // Heat shimmer: the horizon line wavers in the summer heat.
  y += uHeat * 0.006 * sin(uTime * 9.0 + d.x * 60.0) * (1.0 - smoothstep(0.0, 0.12, abs(y)));
  float k = pow(clamp(y, 0.0, 1.0), 0.55);
  vec3 c = mix(uHorizon, uTop, k);
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  c += uSunColor * (pow(s, 600.0) * 2.5 + pow(s, 12.0) * 0.25) * (1.0 - uClouds * 0.8) * step(0.0, uSunDir.y + 0.05);
  if (uStars > 0.0 && y > 0.0) {
    vec2 g = d.xz / (y + 0.3) * 90.0;
    float st = step(0.996, h21(floor(g))) * (1.0 - smoothstep(0.1, 0.35, length(fract(g) - 0.5)));
    c += vec3(st * uStars * (0.6 + 0.4 * sin(uTime * 3.0 + h21(floor(g) + 3.0) * 40.0)));
  }
  if (y > 0.0) {
    vec2 cp = d.xz / (y + 0.15) * 1.6 + uWind * uTime * 0.02;
    float n = fbm(cp);
    float cover = smoothstep(1.0 - uClouds * 0.75 - 0.15, 1.0 - uClouds * 0.75 + 0.2, n);
    c = mix(c, uCloudColor * (0.85 + 0.25 * n), cover * smoothstep(0.0, 0.08, y) * 0.92);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * Sky, sun and moon, ambient light and fog: everything that follows the hour, the season and the
 * weather. `apply` takes a FrameLight (pure, tested) and sets the scene.
 */
export class Atmosphere {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private fog: THREE.Fog;
  private tmp = new THREE.Color();

  constructor(private scene: THREE.Scene, private centre: THREE.Vector3, shadows: boolean, shadowSize: number) {
    this.fog = new THREE.Fog(0xe9cfa6, LOOK.fog.near, LOOK.fog.far);
    scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight(0xc9dcef, 0x9a7a52, 1.1);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.setScalar(shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -38;
    sc.right = sc.top = 38;
    sc.near = 1;
    sc.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.copy(centre);
    scene.add(this.hemi, this.sun, this.sun.target);

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uStars: { value: 0 },
        uClouds: { value: 0 },
        uCloudColor: { value: new THREE.Color() },
        uTime: { value: 0 },
        uWind: { value: new THREE.Vector2(1, 0.3) },
        uHeat: { value: 0 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    scene.add(this.sky);
  }

  /** `viewDist`: the camera's distance to what it looks at (the haze starts behind it, so a far view still shows the city). */
  apply(L: FrameLight, time: number, wind: number, heat: number, camera: THREE.Camera, viewDist: number) {
    const d = L.sunDir;
    this.sun.position.set(this.centre.x + d.x * 80, d.y * 80, this.centre.z + d.z * 80);
    this.sun.color.setHex(L.sunColor);
    this.sun.intensity = L.sunIntensity;
    // Shadows fade under clouds and by moonlight; the shadow map stops updating when they are faint.
    this.sun.shadow.intensity = L.shadow;
    this.shadowLive = L.shadow > 0.15;
    this.hemi.color.setHex(L.hemiSky);
    this.hemi.groundColor.setHex(L.hemiGround);
    this.hemi.intensity = L.hemiIntensity;
    this.fog.color.setHex(L.fog);
    const back = Math.max(0, viewDist - LOOK.fog.clear);
    this.fog.near = LOOK.fog.near * L.fogScale + back;
    this.fog.far = LOOK.fog.far * L.fogScale + back;
    const u = this.skyMat.uniforms;
    (u.uTop.value as THREE.Color).setHex(L.skyTop);
    (u.uHorizon.value as THREE.Color).setHex(L.skyHorizon);
    (u.uSunDir.value as THREE.Vector3).set(d.x, d.y, d.z);
    (u.uSunColor.value as THREE.Color).setHex(L.sunColor);
    u.uStars.value = L.stars;
    u.uClouds.value = L.clouds;
    (u.uCloudColor.value as THREE.Color).setHex(L.cloudColor);
    u.uTime.value = time;
    (u.uWind.value as THREE.Vector2).set(1 + wind * 4, 0.3);
    u.uHeat.value = heat;
    this.sky.position.copy(camera.position);
    this.scene.background = this.tmp.setHex(L.skyHorizon);
  }

  /** The shadows are strong enough to be worth re-rendering this frame. */
  shadowLive = true;
}
