export type CampusLocationSource = 'campus' | 'google';

export interface CampusLocationSuggestion {
  id: string;
  label: string;
  detail?: string;
  placeId?: string;
  source: CampusLocationSource;
}

export interface GoogleCampusLocationOptions {
  signal?: AbortSignal;
  sessionToken?: string;
  limit?: number;
}

/**
 * The centre and radius are only used to restrict Google suggestions to the
 * immediate Strathmore University area. They are not a campus-boundary claim.
 */
export const STRATHMORE_CAMPUS = {
  latitude: -1.3097,
  longitude: 36.8121,
  radiusMeters: 1_200,
} as const;

/**
 * A small, non-exhaustive offline fallback built from locations named on
 * Strathmore University's public website. Room-level entries are deliberately
 * avoided because they change more often. People can still enter another
 * location manually.
 *
 * Public references reviewed 2026-08-26:
 * - https://strathmore.edu/contact-us/
 * - https://strathmore.edu/cafeteria/
 * - https://www.library.strathmore.edu/
 * - https://strathmore.edu/news-articles/university-life-clubs-sports-and-academic-gala-2/
 * - https://strathmore.edu/news-articles/from-the-gazebos-to-the-graduation-square/
 * - https://strathmore.edu/news-articles/mountains-are-completely-unimpressed-by-your-cv/
 */
export const STRATHMORE_CAMPUS_LOCATIONS: readonly CampusLocationSuggestion[] = [
  {
    id: 'campus-main',
    label: 'Strathmore University Main Campus',
    detail: 'Ole Sangale Road, Madaraka Estate',
    source: 'campus',
  },
  {
    id: 'campus-library',
    label: 'Strathmore University Library',
    detail: 'Main campus',
    source: 'campus',
  },
  {
    id: 'campus-student-centre',
    label: 'Student Centre',
    detail: 'Strathmore University',
    source: 'campus',
  },
  {
    id: 'campus-cafeteria',
    label: 'Strathmore University Cafeteria',
    detail: 'Main campus',
    source: 'campus',
  },
  {
    id: 'campus-main-auditorium',
    label: 'Main Auditorium',
    detail: 'Strathmore University',
    source: 'campus',
  },
  {
    id: 'campus-sports-complex',
    label: 'Sports Complex',
    detail: 'Strathmore University',
    source: 'campus',
  },
  {
    id: 'campus-graduation-square',
    label: 'Graduation Square',
    detail: 'Strathmore University',
    source: 'campus',
  },
  {
    id: 'campus-gazebos',
    label: 'Campus Gazebos',
    detail: 'Strathmore University',
    source: 'campus',
  },
  {
    id: 'campus-stmb',
    label: 'Sir Thomas More Building',
    detail: 'Strathmore University',
    source: 'campus',
  },
] as const;

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-KE')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function locationScore(location: CampusLocationSuggestion, query: string) {
  const label = normalize(location.label);
  const detail = normalize(location.detail ?? '');
  const searchable = `${label} ${detail}`.trim();
  const queryWords = query.split(' ').filter(Boolean);

  if (!queryWords.every((word) => searchable.includes(word))) return Number.POSITIVE_INFINITY;
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.split(' ').some((word) => word.startsWith(query))) return 2;
  if (label.includes(query)) return 3;
  return 4;
}

export function searchCampusLocations(input: string, limit = 6): CampusLocationSuggestion[] {
  const query = normalize(input);
  const safeLimit = Math.max(1, Math.min(limit, 10));

  if (!query) return STRATHMORE_CAMPUS_LOCATIONS.slice(0, safeLimit);

  return STRATHMORE_CAMPUS_LOCATIONS.map((location, index) => ({
    index,
    location,
    score: locationScore(location, query),
  }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, safeLimit)
    .map(({ location }) => location);
}

export function hasGoogleCampusLocations() {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
}

export function createGooglePlacesSessionToken() {
  // This is a billing-session identifier, not an authentication secret.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

interface GoogleAutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }[];
}

/**
 * Fetch Google Places suggestions near Strathmore University. Failures are
 * allowed to bubble so the UI can quietly keep its offline fallback.
 *
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is a client-visible key by definition. In
 * Google Cloud, restrict it to this app's bundle IDs / web origins and enable
 * only the Places API (New).
 */
export async function fetchGoogleCampusLocations(
  input: string,
  options: GoogleCampusLocationOptions = {},
): Promise<CampusLocationSuggestion[]> {
  const query = input.trim();
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey || query.length < 2) return [];

  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({
      input: query,
      includeQueryPredictions: false,
      languageCode: 'en',
      regionCode: 'KE',
      sessionToken: options.sessionToken,
      locationRestriction: {
        circle: {
          center: {
            latitude: STRATHMORE_CAMPUS.latitude,
            longitude: STRATHMORE_CAMPUS.longitude,
          },
          radius: STRATHMORE_CAMPUS.radiusMeters,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Campus location provider returned ${response.status}`);
  }

  const data = (await response.json()) as GoogleAutocompleteResponse;
  const limit = Math.max(1, Math.min(options.limit ?? 6, 10));

  return (data.suggestions ?? [])
    .flatMap((suggestion): CampusLocationSuggestion[] => {
      const prediction = suggestion.placePrediction;
      const label = prediction?.structuredFormat?.mainText?.text?.trim() ?? prediction?.text?.text?.trim();

      if (!prediction?.placeId || !label) return [];

      const detail = prediction.structuredFormat?.secondaryText?.text?.trim();
      return [
        {
          id: `google-${prediction.placeId}`,
          label,
          detail: detail && normalize(detail) !== normalize(label) ? detail : undefined,
          placeId: prediction.placeId,
          source: 'google',
        },
      ];
    })
    .slice(0, limit);
}
