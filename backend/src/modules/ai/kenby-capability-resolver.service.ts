import { Injectable, Logger } from '@nestjs/common';
import {
  ErpCapability,
  ERP_CAPABILITIES,
  ErpDomain,
  ErpAction,
  findCapabilitiesByEntityType,
  findCapabilitiesByDomain,
} from './kenby-capability-registry';
import { ResolvedEntity } from './kenby-entity-resolver.service';
import { SalesSummaryPeriodInput } from './kenby-live-data.service';

export interface CapabilityExecutionPlan {
  capabilityId: string;
  domain: ErpDomain;
  action: ErpAction;
  authoritativeSource: string;
  tablesUsed: string[];
  entity?: {
    type: string;
    id: string;
    name: string;
  };
  period?: SalesSummaryPeriodInput;
  confidence: number;
}

export interface CapabilityResolutionResult {
  status: 'matched' | 'unsupported' | 'fallback';
  capability: ErpCapability | null;
  plan: CapabilityExecutionPlan | null;
  unsupportedMessage?: {
    ml: string;
    en: string;
  };
}

@Injectable()
export class KenbyCapabilityResolverService {
  private readonly logger = new Logger(KenbyCapabilityResolverService.name);

  /**
   * Resolves question and entity into an authoritative ERP capability.
   */
  resolveCapability(
    question: string,
    resolvedEntity?: ResolvedEntity | null,
    periodInput?: SalesSummaryPeriodInput,
    explicitDomainHint?: ErpDomain
  ): CapabilityResolutionResult {
    const qLower = question.toLowerCase();

    // 1. Guardrail against unsupported domains (Accounting, Expenses, Payroll)
    if (
      qLower.includes('payroll') ||
      qLower.includes('salary') ||
      qLower.includes('ശമ്പളം') ||
      qLower.includes('expense') ||
      qLower.includes('ചിലവ്') ||
      qLower.includes('profit and loss') ||
      qLower.includes('ലാഭ നഷ്ടം')
    ) {
      return {
        status: 'unsupported',
        capability: null,
        plan: null,
        unsupportedMessage: {
          en: 'General accounting, payroll, and expense ledgers are not currently configured in the ERP database.',
          ml: 'ജനറൽ അക്കൗണ്ടിംഗ്, ശമ്പളം, ചിലവുകൾ എന്നിവ നിലവിൽ ERP സിസ്റ്റത്തിൽ ലഭ്യമല്ല.',
        },
      };
    }

    // 2. Entity-First Capability Resolution
    if (resolvedEntity) {
      const entityCaps = findCapabilitiesByEntityType(resolvedEntity.type);

      // A. Customer Entity Capabilities
      if (resolvedEntity.type === 'customer') {
        // Payments / Collections
        if (
          qLower.includes('payment') ||
          qLower.includes('paid') ||
          qLower.includes('അടച്ചു') ||
          qLower.includes('പണം') ||
          qLower.includes('രൂപ')
        ) {
          return this.buildMatchResult('customer_payments', resolvedEntity, periodInput);
        }

        // Ledger / Statement / Transaction History
        if (
          qLower.includes('ledger') ||
          qLower.includes('statement') ||
          qLower.includes('transaction') ||
          qLower.includes('history') ||
          qLower.includes('ലെഡ്ജർ') ||
          qLower.includes('ഇടപാട്')
        ) {
          return this.buildMatchResult('customer_ledger', resolvedEntity, periodInput);
        }

        // Balances / Outstanding
        if (
          qLower.includes('owe') ||
          qLower.includes('balance') ||
          qLower.includes('outstanding') ||
          qLower.includes('due') ||
          qLower.includes('കടം') ||
          qLower.includes('ബാക്കി') ||
          qLower.includes('കുടിശ്ശിക')
        ) {
          return this.buildMatchResult('customer_balance', resolvedEntity, periodInput);
        }

        // Purchases / Sales History by period
        if (
          qLower.includes('buy') ||
          qLower.includes('bought') ||
          qLower.includes('purchased') ||
          qLower.includes('വാങ്ങി') ||
          (periodInput && periodInput.period !== 'this_month')
        ) {
          return this.buildMatchResult('customer_sales_history', resolvedEntity, periodInput);
        }

        // Default to Customer Profile
        return this.buildMatchResult('customer_profile', resolvedEntity, periodInput);
      }

      // B. Finished Product Entity Capabilities
      if (resolvedEntity.type === 'product') {
        // BOM
        if (qLower.includes('bom') || qLower.includes('materials required') || qLower.includes('recipe')) {
          return this.buildMatchResult('product_bom', resolvedEntity, periodInput);
        }

        // Sales / Dispatches of this product
        if (
          qLower.includes('sales') ||
          qLower.includes('sold') ||
          qLower.includes('വിൽപ്പന') ||
          qLower.includes('വിറ്റത്') ||
          qLower.includes('dispatch')
        ) {
          return this.buildMatchResult('product_sales', resolvedEntity, periodInput);
        }

        // Full Product Profile
        if (
          qLower.includes('full details') ||
          qLower.includes('details') ||
          qLower.includes('profile') ||
          qLower.includes('വിശദാംശങ്ങൾ')
        ) {
          return this.buildMatchResult('product_profile', resolvedEntity, periodInput);
        }

        // Default to Product Stock
        return this.buildMatchResult('product_stock', resolvedEntity, periodInput);
      }

      // C. Raw Material Entity Capabilities
      if (resolvedEntity.type === 'raw_material') {
        // Movements / Transactions
        if (
          qLower.includes('movement') ||
          qLower.includes('transaction') ||
          qLower.includes('consumed') ||
          qLower.includes('used') ||
          qLower.includes('മൂവ്മെന്റ്')
        ) {
          return this.buildMatchResult('raw_material_movements', resolvedEntity, periodInput);
        }

        // Default to Raw Material Stock
        return this.buildMatchResult('raw_material_stock', resolvedEntity, periodInput);
      }

      // D. Vendor Entity Capabilities
      if (resolvedEntity.type === 'vendor') {
        return this.buildMatchResult('vendor_list', resolvedEntity, periodInput);
      }

      // E. Batch Entity Capabilities
      if (resolvedEntity.type === 'batch') {
        return this.buildMatchResult('production_batches', resolvedEntity, periodInput);
      }

      // F. Incident Entity Capabilities
      if (resolvedEntity.type === 'incident') {
        return this.buildMatchResult('incident_summary', resolvedEntity, periodInput);
      }
    }

    // 3. Domain-Level Keyword Resolution (When no individual entity is specified)
    if (
      qLower.includes('incident') ||
      qLower.includes('ഇൻസിഡന്റ്') ||
      qLower.includes('breakdown ticket') ||
      qLower.includes('safety ticket')
    ) {
      return this.buildMatchResult('incident_summary', null, periodInput);
    }

    if (
      qLower.includes('goods receipt') ||
      qLower.includes('grn') ||
      qLower.includes('material received from supplier') ||
      qLower.includes('supplier delivery') ||
      qLower.includes('ലഭിച്ച സാധനങ്ങൾ')
    ) {
      return this.buildMatchResult('goods_receipts', null, periodInput);
    }

    if (
      qLower.includes('purchase order') ||
      qLower.includes('po status') ||
      qLower.includes('open po') ||
      qLower.includes('പർച്ചേസ് ഓർഡർ')
    ) {
      return this.buildMatchResult('purchase_orders', null, periodInput);
    }

    if (
      qLower.includes('vendor') ||
      qLower.includes('supplier') ||
      qLower.includes('വെണ്ടർ') ||
      qLower.includes('സപ്ലയർ')
    ) {
      return this.buildMatchResult('vendor_list', null, periodInput);
    }

    if (
      qLower.includes('batch') ||
      qLower.includes('ബാച്ച്')
    ) {
      return this.buildMatchResult('production_batches', null, periodInput);
    }

    if (
      qLower.includes('downtime') ||
      qLower.includes('ഡൗൺടൈം') ||
      qLower.includes('തകരാർ')
    ) {
      return this.buildMatchResult('production_downtime', null, periodInput);
    }

    // Explicit domain hint
    if (explicitDomainHint) {
      const domainCaps = findCapabilitiesByDomain(explicitDomainHint);
      if (domainCaps.length > 0) {
        return this.buildMatchResult(domainCaps[0].id, null, periodInput);
      }
    }

    // Default Fallback
    return {
      status: 'fallback',
      capability: null,
      plan: null,
    };
  }

  private buildMatchResult(
    capabilityId: string,
    entity: ResolvedEntity | null,
    period?: SalesSummaryPeriodInput
  ): CapabilityResolutionResult {
    const cap = ERP_CAPABILITIES.find((c) => c.id === capabilityId);
    if (!cap) {
      return { status: 'fallback', capability: null, plan: null };
    }

    const plan: CapabilityExecutionPlan = {
      capabilityId: cap.id,
      domain: cap.domain,
      action: cap.action,
      authoritativeSource: cap.authoritativeSource,
      tablesUsed: cap.sourceTables,
      entity: entity
        ? {
            type: entity.type,
            id: entity.id,
            name: entity.name,
          }
        : undefined,
      period,
      confidence: entity ? entity.confidence : 0.9,
    };

    return {
      status: 'matched',
      capability: cap,
      plan,
    };
  }
}
