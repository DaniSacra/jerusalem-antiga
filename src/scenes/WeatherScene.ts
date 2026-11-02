import Phaser from 'phaser';
import { Weather } from '../render/Weather';

/** Overlay for the weather, drawn between the map and the UI so camera zoom never touches it. */
export class WeatherScene extends Phaser.Scene {
  constructor() {
    super('weather');
  }

  create(data: { host: { attachWeather(w: Weather): void } }) {
    data.host.attachWeather(new Weather(this));
  }
}
