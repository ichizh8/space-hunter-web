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

import tidalOpening01    from './hunt/tidal/tidal_opening_01.json';
import tidalStandard01   from './hunt/tidal/tidal_standard_01.json';
import tidalStandard02   from './hunt/tidal/tidal_standard_02.json';
import tidalStandard03   from './hunt/tidal/tidal_standard_03.json';
import tidalStandard04   from './hunt/tidal/tidal_standard_04.json';
import tidalElite01      from './hunt/tidal/tidal_elite_01.json';
import tidalElite02      from './hunt/tidal/tidal_elite_02.json';
import tidalBoss01       from './hunt/tidal/tidal_boss_01.json';
import tidalExtraction01 from './hunt/tidal/tidal_extraction_01.json';

import voidOpening01     from './hunt/void/void_opening_01.json';
import voidStandard01    from './hunt/void/void_standard_01.json';
import voidStandard02    from './hunt/void/void_standard_02.json';
import voidStandard03    from './hunt/void/void_standard_03.json';
import voidStandard04    from './hunt/void/void_standard_04.json';
import voidElite01       from './hunt/void/void_elite_01.json';
import voidElite02       from './hunt/void/void_elite_02.json';
import voidBoss01        from './hunt/void/void_boss_01.json';
import voidExtraction01  from './hunt/void/void_extraction_01.json';

import furnaceOpening01    from './hunt/furnace/furnace_opening_01.json';
import furnaceStandard01   from './hunt/furnace/furnace_standard_01.json';
import furnaceStandard02   from './hunt/furnace/furnace_standard_02.json';
import furnaceStandard03   from './hunt/furnace/furnace_standard_03.json';
import furnaceStandard04   from './hunt/furnace/furnace_standard_04.json';
import furnaceElite01      from './hunt/furnace/furnace_elite_01.json';
import furnaceElite02      from './hunt/furnace/furnace_elite_02.json';
import furnaceBoss01       from './hunt/furnace/furnace_boss_01.json';
import furnaceExtraction01 from './hunt/furnace/furnace_extraction_01.json';

// planet → roomType → available templates
const POOL: Record<string, Record<string, readonly unknown[]>> = {
  kepler: {
    opening:    [opening01],
    standard:   [standard01, standard02, standard03, standard04],
    elite:      [elite01, elite02],
    boss:       [boss01],
    extraction: [extraction01],
  },
  tidal: {
    opening:    [tidalOpening01],
    standard:   [tidalStandard01, tidalStandard02, tidalStandard03, tidalStandard04],
    elite:      [tidalElite01, tidalElite02],
    boss:       [tidalBoss01],
    extraction: [tidalExtraction01],
  },
  void_reach: {
    opening:    [voidOpening01],
    standard:   [voidStandard01, voidStandard02, voidStandard03, voidStandard04],
    elite:      [voidElite01, voidElite02],
    boss:       [voidBoss01],
    extraction: [voidExtraction01],
  },
  furnace: {
    opening:    [furnaceOpening01],
    standard:   [furnaceStandard01, furnaceStandard02, furnaceStandard03, furnaceStandard04],
    elite:      [furnaceElite01, furnaceElite02],
    boss:       [furnaceBoss01],
    extraction: [furnaceExtraction01],
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
