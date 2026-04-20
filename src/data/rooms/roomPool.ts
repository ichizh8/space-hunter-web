import type { RoomJSON } from '../../editor/editorStore';

import opening01   from './hunt/kepler/kepler_opening_01.json';
import standard01  from './hunt/kepler/kepler_standard_01.json';
import standard02  from './hunt/kepler/kepler_standard_02.json';
import standard03  from './hunt/kepler/kepler_standard_03.json';
import standard04  from './hunt/kepler/kepler_standard_04.json';
import elite01     from './hunt/kepler/kepler_elite_01.json';
import elite02     from './hunt/kepler/kepler_elite_02.json';
import boss01      from './hunt/kepler/kepler_boss_01.json';
import extraction01 from './hunt/kepler/kepler_extraction_01.json';

// planet → roomType → available templates
const POOL: Record<string, Record<string, readonly unknown[]>> = {
  kepler: {
    opening:    [opening01],
    standard:   [standard01, standard02, standard03, standard04],
    elite:      [elite01, elite02],
    boss:       [boss01],
    extraction: [extraction01],
  },
};

export function pickNextRoom(planet: string, roomType: string): RoomJSON {
  const bucket = POOL[planet]?.[roomType];
  if (!bucket || bucket.length === 0) {
    throw new Error(`No room pool for ${planet}/${roomType}`);
  }
  return bucket[Math.floor(Math.random() * bucket.length)] as unknown as RoomJSON;
}

export function getRoomPool(planet: string, roomType: string): RoomJSON[] {
  const bucket = POOL[planet]?.[roomType];
  if (!bucket) return [];
  return bucket as unknown as RoomJSON[];
}
