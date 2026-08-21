import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/db';
import {
  customers,
  products,
  rawMaterials,
  vendors,
  productionBatches,
  warehouseLocations,
  incidents,
} from '../../database/schema';
import { ilike, isNull, and, desc, or } from 'drizzle-orm';
import { ErpEntityType } from './kenby-capability-registry';

export interface ResolvedEntity {
  type: ErpEntityType;
  id: string;
  name: string;
  code?: string | null;
  secondaryInfo?: string | null;
  confidence: number;
}

export interface EntityResolutionResult {
  matchStatus: 'exact' | 'partial' | 'ambiguous' | 'none';
  entity: ResolvedEntity | null;
  ambiguousCandidates?: ResolvedEntity[];
  clarificationPrompt?: {
    ml: string;
    en: string;
  };
}

@Injectable()
export class KenbyEntityResolverService {
  private readonly logger = new Logger(KenbyEntityResolverService.name);

  /**
   * Resolves a candidate entity name against all authorized ERP entity tables.
   */
  async resolveEntity(candidateName: string, contextualDomain?: ErpEntityType): Promise<EntityResolutionResult> {
    const trimmed = candidateName ? candidateName.trim() : '';
    if (!trimmed || trimmed.length < 2) {
      return { matchStatus: 'none', entity: null };
    }

    const normCandidate = trimmed.toLowerCase();

    // 1. Parallel search across all ERP entities
    const [custMatches, prodMatches, rawMatMatches, vendorMatches, batchMatches, whMatches, incMatches] = await Promise.all([
      this.searchCustomers(normCandidate),
      this.searchProducts(normCandidate),
      this.searchRawMaterials(normCandidate),
      this.searchVendors(normCandidate),
      this.searchBatches(normCandidate),
      this.searchWarehouseLocations(normCandidate),
      this.searchIncidents(normCandidate),
    ]);

    const allCandidates: ResolvedEntity[] = [
      ...custMatches,
      ...prodMatches,
      ...rawMatMatches,
      ...vendorMatches,
      ...batchMatches,
      ...whMatches,
      ...incMatches,
    ];

    if (allCandidates.length === 0) {
      return { matchStatus: 'none', entity: null };
    }

    // 2. Check for Exact Match (Normalized exact name or code)
    const exactMatches = allCandidates.filter(
      (c) =>
        c.name.toLowerCase() === normCandidate ||
        (c.code && c.code.toLowerCase() === normCandidate)
    );

    if (exactMatches.length === 1) {
      return {
        matchStatus: 'exact',
        entity: { ...exactMatches[0], confidence: 1.0 },
      };
    }

    // If contextual domain is provided, filter exact matches by that domain
    if (contextualDomain && exactMatches.length > 1) {
      const domainExact = exactMatches.filter((c) => c.type === contextualDomain);
      if (domainExact.length === 1) {
        return {
          matchStatus: 'exact',
          entity: { ...domainExact[0], confidence: 1.0 },
        };
      }
    }

    // 3. Check for Single Strong Partial Match
    let candidatesToEvaluate = allCandidates;
    if (contextualDomain) {
      const domainFiltered = allCandidates.filter((c) => c.type === contextualDomain);
      if (domainFiltered.length > 0) {
        candidatesToEvaluate = domainFiltered;
      }
    }

    if (candidatesToEvaluate.length === 1) {
      return {
        matchStatus: 'partial',
        entity: { ...candidatesToEvaluate[0], confidence: 0.85 },
      };
    }

    // If multiple candidates exist, check if one starts with candidateName (prefix match)
    const prefixMatches = candidatesToEvaluate.filter((c) =>
      c.name.toLowerCase().startsWith(normCandidate)
    );
    if (prefixMatches.length === 1) {
      return {
        matchStatus: 'partial',
        entity: { ...prefixMatches[0], confidence: 0.9 },
      };
    }

    // 4. Ambiguity handling (Multiple candidates found)
    const topCandidates = candidatesToEvaluate.slice(0, 4);
    const candidateListEn = topCandidates.map((c) => `${c.name} (${c.type})`).join(', ');
    const candidateListMl = topCandidates.map((c) => `${c.name} (${this.getEntityTypeLabelMl(c.type)})`).join(', ');

    return {
      matchStatus: 'ambiguous',
      entity: null,
      ambiguousCandidates: topCandidates,
      clarificationPrompt: {
        en: `I found multiple matching entities: ${candidateListEn}. Which one do you mean?`,
        ml: `ഒന്നിൽക്കൂടുതൽ എൻറ്റിറ്റികൾ കണ്ടെത്തി: ${candidateListMl}. ഇതിൽ ഏതാണ് ഉദ്ദേശിച്ചത്?`,
      },
    };
  }

  // ── ENTITY QUERIES ──

  private async searchCustomers(query: string): Promise<ResolvedEntity[]> {
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        code: customers.code,
        phone: customers.phone,
      })
      .from(customers)
      .where(
        and(
          isNull(customers.deletedAt),
          ilike(customers.name, `%${query}%`)
        )
      )
      .limit(5);

    return rows.map((r) => ({
      type: 'customer',
      id: r.id,
      name: r.name,
      code: r.code,
      secondaryInfo: r.phone ? `Phone: ${r.phone}` : null,
      confidence: r.name.toLowerCase() === query ? 1.0 : 0.8,
    }));
  }

  private async searchProducts(query: string): Promise<ResolvedEntity[]> {
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        category: products.category,
      })
      .from(products)
      .where(ilike(products.name, `%${query}%`))
      .limit(5);

    return rows.map((r) => ({
      type: 'product',
      id: r.id,
      name: r.name,
      code: r.sku,
      secondaryInfo: r.category ? `Category: ${r.category}` : null,
      confidence: r.name.toLowerCase() === query ? 1.0 : 0.8,
    }));
  }

  private async searchRawMaterials(query: string): Promise<ResolvedEntity[]> {
    const rows = await db
      .select({
        id: rawMaterials.id,
        name: rawMaterials.name,
        materialType: rawMaterials.materialType,
        unit: rawMaterials.unit,
      })
      .from(rawMaterials)
      .where(ilike(rawMaterials.name, `%${query}%`))
      .limit(5);

    return rows.map((r) => ({
      type: 'raw_material',
      id: r.id,
      name: r.name,
      code: r.materialType,
      secondaryInfo: `Type: ${r.materialType}, Unit: ${r.unit}`,
      confidence: r.name.toLowerCase() === query ? 1.0 : 0.8,
    }));
  }

  private async searchVendors(query: string): Promise<ResolvedEntity[]> {
    const rows = await db
      .select({
        id: vendors.id,
        name: vendors.name,
        code: vendors.code,
        phone: vendors.phone,
      })
      .from(vendors)
      .where(ilike(vendors.name, `%${query}%`))
      .limit(5);

    return rows.map((r) => ({
      type: 'vendor',
      id: r.id,
      name: r.name,
      code: r.code,
      secondaryInfo: r.phone ? `Phone: ${r.phone}` : null,
      confidence: r.name.toLowerCase() === query ? 1.0 : 0.8,
    }));
  }

  private async searchBatches(query: string): Promise<ResolvedEntity[]> {
    const rows = await db
      .select({
        id: productionBatches.id,
        batchCode: productionBatches.batchCode,
        status: productionBatches.status,
      })
      .from(productionBatches)
      .where(
        and(
          isNull(productionBatches.deletedAt),
          ilike(productionBatches.batchCode, `%${query}%`)
        )
      )
      .orderBy(desc(productionBatches.createdAt))
      .limit(5);

    return rows.map((r) => ({
      type: 'batch',
      id: r.id,
      name: r.batchCode,
      code: r.batchCode,
      secondaryInfo: `Status: ${r.status}`,
      confidence: r.batchCode.toLowerCase() === query ? 1.0 : 0.8,
    }));
  }

  private async searchWarehouseLocations(query: string): Promise<ResolvedEntity[]> {
    const rows = await db
      .select({
        id: warehouseLocations.id,
        name: warehouseLocations.name,
        type: warehouseLocations.type,
      })
      .from(warehouseLocations)
      .where(ilike(warehouseLocations.name, `%${query}%`))
      .limit(5);

    return rows.map((r) => ({
      type: 'warehouse_location',
      id: r.id,
      name: r.name,
      code: r.type,
      secondaryInfo: `Type: ${r.type}`,
      confidence: r.name.toLowerCase() === query ? 1.0 : 0.8,
    }));
  }

  private async searchIncidents(query: string): Promise<ResolvedEntity[]> {
    const rows = await db
      .select({
        id: incidents.id,
        incidentNumber: incidents.incidentNumber,
        title: incidents.title,
        status: incidents.status,
      })
      .from(incidents)
      .where(
        and(
          isNull(incidents.deletedAt),
          or(
            ilike(incidents.incidentNumber, `%${query}%`),
            ilike(incidents.title, `%${query}%`)
          )
        )
      )
      .limit(5);

    return rows.map((r) => ({
      type: 'incident',
      id: r.id,
      name: r.incidentNumber,
      code: r.incidentNumber,
      secondaryInfo: `Title: ${r.title}, Status: ${r.status}`,
      confidence: r.incidentNumber.toLowerCase() === query ? 1.0 : 0.8,
    }));
  }

  private getEntityTypeLabelMl(type: ErpEntityType): string {
    switch (type) {
      case 'customer':
        return 'കസ്റ്റമർ';
      case 'product':
        return 'പ്രോഡക്റ്റ്';
      case 'raw_material':
        return 'റോ മെറ്റീരിയൽ';
      case 'vendor':
        return 'വെണ്ടർ';
      case 'batch':
        return 'പ്രൊഡക്ഷൻ ബാച്ച്';
      case 'warehouse_location':
        return 'വെയർഹൗസ്';
      case 'incident':
        return 'ഇൻസിഡന്റ്';
      default:
        return 'എൻറ്റിറ്റി';
    }
  }
}
