import type { DayPhase } from './time/day';

/** On-screen texts of the 3D proof (the calendar and season names come from the game's strings). */
export const T3 = {
  phase: { dawn: 'Amanhecer', day: 'Dia', dusk: 'Entardecer', night: 'Noite' } satisfies Record<DayPhase, string>,
  weather: { rain: 'Chuva', snow: 'Neve', drought: 'Seca', wind: 'Vento', snowCover: 'Neve no chão' },
  speed: { 0: 'Pausa', 1: '1x', 2: '2x', 4: '4x' } as Record<number, string>,
  demo: 'Demonstração: 1 ano em 1 minuto',
  demoStop: 'Parar demonstração',
  to2d: 'Ver em 2D',
  to3d: 'Ver em 3D',
  loading2d: 'Abrindo o 2D…',
  quality: { auto: 'Qualidade: automática', high: 'Qualidade: alta', low: 'Qualidade: baixa' },
  lowered: 'Qualidade reduzida para manter a fluidez',
  stats: (fps: number, buildings: number, calls: number, tris: number) => `${fps.toFixed(0)} qps · ${buildings} construções · ${calls} chamadas · ${tris} mil triângulos`,
  error: (e: unknown) => `Erro: ${e}`,
};
