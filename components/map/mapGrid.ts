import * as turf from '@turf/turf';

type LatLon = { latitude: number; longitude: number };

/**
 * Convert grid offsets in meters to latitude/longitude.
 * @param origin The origin point { latitude, longitude }
 * @param easting Offset in meters east from origin
 * @param northing Offset in meters north from origin
 * @returns New point { latitude, longitude }
 */
export function gridOffsetMetersToLatLon(origin: LatLon, easting: number, northing: number): LatLon {
  // Start at origin [lon, lat]
  const originPoint = turf.point([origin.longitude, origin.latitude]);

  // Move east by easting meters
  const eastPoint = turf.destination(originPoint, easting, 90, { units: 'meters' });

  // Move north by northing meters
  const finalPoint = turf.destination(eastPoint, northing, 0, { units: 'meters' });

  const [lon, lat] = finalPoint.geometry.coordinates;
  return { latitude: lat, longitude: lon };
}
