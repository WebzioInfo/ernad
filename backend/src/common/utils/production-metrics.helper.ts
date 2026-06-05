import { sql } from 'drizzle-orm';
import { productionLogs } from '../../database/schema';

/**
 * Single Source of Truth for calculating total produced output.
 * Ensures we only count final output from the PACKING station to avoid duplicate counting
 * across preceding stations (Blowing, Filling, Labeling).
 */
export const getProducedQuantitySql = () => {
  return sql<string>`COALESCE(SUM(CASE WHEN ${productionLogs.station} = 'PACKING' THEN COALESCE(${productionLogs.primaryCount}, 0) ELSE 0 END), '0')`;
};

/**
 * Single Source of Truth for calculating total wastage across all stations.
 */
export const getWastageQuantitySql = () => {
  return sql<string>`COALESCE(SUM(COALESCE(${productionLogs.wastageCount}, 0)), '0')`;
};
