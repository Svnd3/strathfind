import { describe, expect, it } from 'vitest';

import {
  STRATHMORE_CAMPUS_LOCATIONS,
  searchCampusLocations,
} from './campus-locations';

describe('campus location suggestions', () => {
  it('offers real campus places when the field is empty', () => {
    expect(searchCampusLocations('', 3)).toEqual(STRATHMORE_CAMPUS_LOCATIONS.slice(0, 3));
  });

  it('matches normalized words across a location label', () => {
    expect(searchCampusLocations('sir thomas')).toEqual([
      expect.objectContaining({ label: 'Sir Thomas More Building', source: 'campus' }),
    ]);
  });

  it('returns no invented suggestion for an unknown place', () => {
    expect(searchCampusLocations('not a real campus place')).toEqual([]);
  });
});
