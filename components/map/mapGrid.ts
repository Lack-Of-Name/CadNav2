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

/**
 * Given an origin and two corner lat/lon points (map bottom-left and top-right),
 * compute expanded grid-aligned corner coordinates around the origin.
 *
 * Steps:
 * 1. Calculate easting (meters east of origin) and northing (meters north of origin)
 *    for both corners.
 * 2. For bottom-left subtract 1km from both easting and northing and round to nearest 1km.
 *    For top-right add 1km to both and round to nearest 1km.
 * 3. Convert the adjusted easting/northing back to lat/lon to produce grid bounds.
 */
export function computeGridCornersFromMapBounds(
  origin: LatLon,
  bottomLeft: LatLon,
  topRight: LatLon
): {
  bottomLeft: LatLon;
  topRight: LatLon;
  offsets: {
    bottomLeft: { easting: number; northing: number };
    topRight: { easting: number; northing: number };
  };
} {
  const originPoint = turf.point([origin.longitude, origin.latitude]);

  const pointBL = turf.point([bottomLeft.longitude, bottomLeft.latitude]);
  const pointTR = turf.point([topRight.longitude, topRight.latitude]);

  // Compute northing: distance between origin and a point with origin longitude but corner latitude
  const northPointBL = turf.point([origin.longitude, bottomLeft.latitude]);
  const northPointTR = turf.point([origin.longitude, topRight.latitude]);

  const northDistBL = turf.distance(originPoint, northPointBL, { units: 'meters' });
  const northDistTR = turf.distance(originPoint, northPointTR, { units: 'meters' });

  // Compute easting: distance between origin and a point with origin latitude but corner longitude
  const eastPointBL = turf.point([bottomLeft.longitude, origin.latitude]);
  const eastPointTR = turf.point([topRight.longitude, origin.latitude]);

  const eastDistBL = turf.distance(originPoint, eastPointBL, { units: 'meters' });
  const eastDistTR = turf.distance(originPoint, eastPointTR, { units: 'meters' });

  // Determine sign (east positive, north positive)
  const eastingBL = bottomLeft.longitude >= origin.longitude ? eastDistBL : -eastDistBL;
  const northingBL = bottomLeft.latitude >= origin.latitude ? northDistBL : -northDistBL;

  const eastingTR = topRight.longitude >= origin.longitude ? eastDistTR : -eastDistTR;
  const northingTR = topRight.latitude >= origin.latitude ? northDistTR : -northDistTR;

  const roundKm = (v: number) => Math.round(v / 1000) * 1000;

  // Expand by 1km and round to nearest 1km per requirements
  const adjEastingBL = roundKm(eastingBL - 1000);
  const adjNorthingBL = roundKm(northingBL - 1000);

  const adjEastingTR = roundKm(eastingTR + 1000);
  const adjNorthingTR = roundKm(northingTR + 1000);

  const blLatLon = gridOffsetMetersToLatLon(origin, adjEastingBL, adjNorthingBL);
  const trLatLon = gridOffsetMetersToLatLon(origin, adjEastingTR, adjNorthingTR);

  return {
    bottomLeft: blLatLon,
    topRight: trLatLon,
    offsets: {
      bottomLeft: { easting: adjEastingBL, northing: adjNorthingBL },
      topRight: { easting: adjEastingTR, northing: adjNorthingTR },
    },
  };
}
