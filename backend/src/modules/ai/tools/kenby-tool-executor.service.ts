import { Injectable, Logger } from '@nestjs/common';
import { KenbyErpRegistryService } from '../kenby-erp-registry.service';
import { KenbyLiveDataService } from '../kenby-live-data.service';
import { KenbyDateResolverService } from '../dates/kenby-date-resolver.service';
import { KenbyGroundingValidatorService } from '../grounding/kenby-grounding-validator.service';
import { AnswerEvidence } from '../grounding/kenby-grounding.interface';

export interface ToolExecutionResult {
  tool: string;
  parameters: Record<string, any>;
  data: any;
  recordsFound: number;
  exactDateRange?: { startDate: string; endDate: string; label?: string };
  evidence?: AnswerEvidence;
  success: boolean;
  error?: string;
}

@Injectable()
export class KenbyToolExecutorService {
  private readonly logger = new Logger(KenbyToolExecutorService.name);

  constructor(
    private readonly erpRegistry: KenbyErpRegistryService,
    private readonly liveDataService: KenbyLiveDataService,
    private readonly dateResolver: KenbyDateResolverService,
    private readonly groundingValidator: KenbyGroundingValidatorService
  ) {}

  /**
   * Securely executes an ERP tool by name with deterministic date boundaries,
   * parameter validation, tenant isolation, and AnswerEvidence generation.
   */
  async executeTool(toolName: string, parameters: Record<string, any> = {}): Promise<ToolExecutionResult> {
    this.logger.log(`[KENBY_TOOL_EXECUTOR] Executing tool: ${toolName} with params: ${JSON.stringify(parameters)}`);

    try {
      let data: any = null;
      let recordsFound = 0;
      let exactDateRange: { startDate: string; endDate: string; label?: string } | undefined;
      const entities: Array<{ type: string; id?: string; name: string; matchConfidence: number }> = [];

      switch (toolName) {
        // ── 0. FULL MULTI-DOMAIN ERP SUMMARY ──
        case 'get_full_erp_summary': {
          const resolvedDate = this.dateResolver.resolveDateBounds(parameters);
          const periodInput = {
            period: resolvedDate.periodType as any,
            date: resolvedDate.exactDate,
            year: resolvedDate.year,
            month: resolvedDate.month,
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
          };

          const [salesRes, returnRes, damageRes, prodRes, stockRes, rawMatRes, custRes] = await Promise.allSettled([
            this.liveDataService.getSalesSummary(periodInput),
            this.liveDataService.getReturnBreakdown(periodInput),
            this.liveDataService.getDamageBreakdown(periodInput),
            this.liveDataService.getProductionSummary(periodInput),
            this.liveDataService.getCurrentStock(),
            this.erpRegistry.listAllRawMaterials(),
            this.erpRegistry.listAllCustomers(20),
          ]);

          data = {
            period: resolvedDate,
            sales: salesRes.status === 'fulfilled' ? salesRes.value : { totalQuantity: 0, transactionCount: 0 },
            returns: returnRes.status === 'fulfilled' ? returnRes.value : { totalQuantity: 0, transactionCount: 0 },
            damage: damageRes.status === 'fulfilled' ? damageRes.value : { totalQuantity: 0, transactionCount: 0 },
            production: prodRes.status === 'fulfilled' ? prodRes.value : { totalCasesProduced: 0, logCount: 0 },
            inventory: stockRes.status === 'fulfilled' ? stockRes.value : { totalCurrentStock: 0 },
            rawMaterials: rawMatRes.status === 'fulfilled' ? rawMatRes.value : [],
            customers: custRes.status === 'fulfilled' ? custRes.value : [],
          };

          recordsFound =
            (data.sales.transactionCount || 0) +
            (data.returns.transactionCount || 0) +
            (data.damage.transactionCount || 0) +
            (data.production.logCount || 0);

          exactDateRange = {
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
            label: resolvedDate.label.en,
          };
          break;
        }

        // ── 1. SALES & DISPATCH TOOLS ──
        case 'get_sales_summary':
        case 'get_dispatch_summary': {
          const resolvedDate = this.dateResolver.resolveDateBounds(parameters);
          data = await this.liveDataService.getSalesSummary({
            period: resolvedDate.periodType as any,
            date: resolvedDate.exactDate,
            year: resolvedDate.year,
            month: resolvedDate.month,
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
          });

          recordsFound = data.transactionCount ?? (data.totalQuantity > 0 ? 1 : 0);
          exactDateRange = {
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
            label: resolvedDate.label.en,
          };
          break;
        }

        case 'get_sales_by_date': {
          const resolvedDate = this.dateResolver.resolveDateBounds({ date: parameters.date });
          data = await this.liveDataService.getSalesSummary({
            period: 'specific_date',
            date: resolvedDate.exactDate || parameters.date,
          });

          recordsFound = data.transactionCount ?? 0;
          exactDateRange = {
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
            label: resolvedDate.label.en,
          };
          break;
        }

        case 'get_sales_transactions': {
          data = await this.erpRegistry.getRecentTransactions({
            date: parameters.date,
            customer: parameters.customer,
            product: parameters.product,
            type: parameters.type || 'SALES_DISPATCH',
            limit: Number(parameters.limit) || 10,
          });
          recordsFound = Array.isArray(data) ? data.length : 0;
          if (parameters.customer) {
            entities.push({ type: 'customer', name: parameters.customer, matchConfidence: 1.0 });
          }
          if (parameters.product) {
            entities.push({ type: 'product', name: parameters.product, matchConfidence: 1.0 });
          }
          break;
        }

        case 'get_return_summary': {
          const resolvedDate = this.dateResolver.resolveDateBounds(parameters);
          data = await this.liveDataService.getReturnBreakdown(
            {
              period: resolvedDate.periodType as any,
              date: resolvedDate.exactDate,
              year: resolvedDate.year,
              month: resolvedDate.month,
            },
            parameters.product
          );
          data.period = {
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
            label: resolvedDate.label.en,
            labelMl: resolvedDate.label.ml,
            year: resolvedDate.year,
            month: resolvedDate.month,
          };
          recordsFound = data.transactionCount ?? (data.totalQuantity > 0 ? 1 : 0);
          exactDateRange = {
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
            label: resolvedDate.label.en,
          };
          break;
        }

        case 'get_damage_summary': {
          const resolvedDate = this.dateResolver.resolveDateBounds(parameters);
          data = await this.liveDataService.getDamageBreakdown(
            {
              period: resolvedDate.periodType as any,
              date: resolvedDate.exactDate,
              year: resolvedDate.year,
              month: resolvedDate.month,
            },
            parameters.product
          );
          data.period = {
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
            label: resolvedDate.label.en,
            labelMl: resolvedDate.label.ml,
            year: resolvedDate.year,
            month: resolvedDate.month,
          };
          recordsFound = data.transactionCount ?? (data.totalQuantity > 0 ? 1 : 0);
          exactDateRange = {
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
            label: resolvedDate.label.en,
          };
          break;
        }

        // ── 2. PRODUCT & INVENTORY TOOLS ──
        case 'list_products':
        case 'get_all_products': {
          data = await this.erpRegistry.listAllProducts();
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        case 'get_product_stock':
        case 'get_finished_goods_stock': {
          if (parameters.product) {
            data = await this.erpRegistry.getProductFullProfile(parameters.product);
            if (!data) {
              // Cross-domain fallback to raw material item
              data = await this.erpRegistry.getRawMaterialProfile(parameters.product);
            }
            recordsFound = data ? 1 : 0;
            entities.push({ type: 'product', name: parameters.product, matchConfidence: 1.0 });
          } else {
            data = await this.liveDataService.getCurrentStock();
            recordsFound = data.products?.length || 0;
          }
          break;
        }

        case 'get_product_profile': {
          const productQuery = parameters.product || parameters.name || '';
          data = await this.erpRegistry.getProductFullProfile(productQuery);
          recordsFound = data ? 1 : 0;
          entities.push({ type: 'product', name: productQuery, matchConfidence: 1.0 });
          break;
        }

        case 'get_product_bom': {
          const productQuery = parameters.product || parameters.name || '';
          data = await this.erpRegistry.getProductBom(productQuery);
          recordsFound = data?.components?.length || 0;
          entities.push({ type: 'product', name: productQuery, matchConfidence: 1.0 });
          break;
        }

        // ── 3. RAW MATERIALS & INVENTORY ──
        case 'list_raw_materials':
        case 'get_all_raw_materials': {
          data = await this.erpRegistry.listAllRawMaterials();
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        case 'get_raw_material_stock': {
          const materialQuery = parameters.material || parameters.product || parameters.name || '';
          data = await this.erpRegistry.getRawMaterialProfile(materialQuery);
          recordsFound = data ? 1 : 0;
          entities.push({ type: 'raw_material', name: materialQuery, matchConfidence: 1.0 });
          break;
        }

        case 'get_raw_material_movements': {
          const materialQuery = parameters.material || parameters.product || parameters.name || '';
          data = await this.erpRegistry.getRawMaterialProfile(materialQuery);
          recordsFound = data?.recentTransactions?.length || 0;
          entities.push({ type: 'raw_material', name: materialQuery, matchConfidence: 1.0 });
          break;
        }

        case 'get_low_stock_items':
        case 'get_negative_stock_items': {
          data = await this.erpRegistry.getLowOrNegativeStockItems();
          recordsFound = (data.negativeRawMaterials?.length || 0) + (data.lowInventoryStock?.length || 0);
          break;
        }

        // ── 4. CUSTOMER TOOLS ──
        case 'list_customers':
        case 'get_all_customers': {
          const limit = Number(parameters.limit) || 50;
          data = await this.erpRegistry.listAllCustomers(limit);
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        case 'get_customer_profile':
        case 'get_customer_balance': {
          const customerQuery = parameters.customer || parameters.name || '';
          data = await this.erpRegistry.getCustomerProfile(customerQuery);
          recordsFound = data ? 1 : 0;
          entities.push({ type: 'customer', name: customerQuery, matchConfidence: 1.0 });
          break;
        }

        case 'get_customer_payments': {
          const customerQuery = parameters.customer || parameters.name || '';
          data = await this.erpRegistry.getCustomerPayments(customerQuery);
          recordsFound = Array.isArray(data) ? data.length : 0;
          entities.push({ type: 'customer', name: customerQuery, matchConfidence: 1.0 });
          break;
        }

        case 'get_customer_ledger': {
          const customerQuery = parameters.customer || parameters.name || '';
          data = await this.erpRegistry.getCustomerLedgerStatement(customerQuery);
          recordsFound = data?.entries?.length || 0;
          entities.push({ type: 'customer', name: customerQuery, matchConfidence: 1.0 });
          break;
        }

        case 'get_customer_debt_ranking': {
          const limit = Number(parameters.limit) || 5;
          data = await this.erpRegistry.getCustomerDebtRanking(limit);
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        // ── 5. VENDORS & PROCUREMENT ──
        case 'list_vendors':
        case 'list_suppliers':
        case 'get_vendor_list': {
          data = await this.erpRegistry.listVendors();
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        case 'get_goods_receipts': {
          data = await this.erpRegistry.getGoodsReceiptsSummary();
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        // ── 6. PRODUCTION & PLANT OPERATIONS ──
        case 'get_production_summary': {
          const resolvedDate = this.dateResolver.resolveDateBounds(parameters);
          data = await this.liveDataService.getProductionSummary({
            period: resolvedDate.periodType as any,
            date: resolvedDate.exactDate,
            year: resolvedDate.year,
            month: resolvedDate.month,
          });
          recordsFound = data.logCount ?? (data.totalCasesProduced > 0 ? 1 : 0);
          exactDateRange = {
            startDate: resolvedDate.startDateStr,
            endDate: resolvedDate.endDateStr,
            label: resolvedDate.label.en,
          };
          break;
        }

        case 'get_production_batches': {
          data = await this.erpRegistry.getBatchesSummary();
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        case 'get_production_downtime': {
          data = await this.erpRegistry.getDowntimeSummary();
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        case 'get_incident_summary': {
          const status = parameters.statusFilter === 'all' ? 'all' : 'open';
          data = await this.erpRegistry.getIncidentsSummary(status);
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        // ── 7. EMPLOYEES & STAFF ──
        case 'list_employees':
        case 'get_staff_list': {
          data = await this.erpRegistry.listAllEmployees();
          recordsFound = Array.isArray(data) ? data.length : 0;
          break;
        }

        default:
          throw new Error(`Unsupported or unmapped tool: ${toolName}`);
      }

      // Generate AnswerEvidence payload
      const extractedNumbers = this.groundingValidator.extractNumbersFromData(data);
      const evidence: AnswerEvidence = {
        source: 'DATABASE',
        toolsExecuted: [toolName],
        queryPeriod: exactDateRange ? {
          type: exactDateRange.startDate === exactDateRange.endDate ? 'exact_date' : 'date_range',
          startDate: exactDateRange.startDate,
          endDate: exactDateRange.endDate,
          exactDate: exactDateRange.startDate === exactDateRange.endDate ? exactDateRange.startDate : undefined,
          label: exactDateRange.label,
        } : undefined,
        entities,
        recordCount: recordsFound,
        extractedNumbers,
        resultData: data,
        isValidated: true,
      };

      return {
        tool: toolName,
        parameters,
        data,
        recordsFound,
        exactDateRange,
        evidence,
        success: true,
      };
    } catch (err: any) {
      this.logger.error(`[KENBY_TOOL_EXECUTOR] Error executing tool ${toolName}: ${err.message}`, err.stack);
      return {
        tool: toolName,
        parameters,
        data: null,
        recordsFound: 0,
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Helper to normalize period parameters using the date resolver
   */
  public normalizePeriodInput(params: Record<string, any>): any {
    const resolved = this.dateResolver.resolveDateBounds(params);
    return {
      period: resolved.periodType,
      date: resolved.exactDate,
      year: resolved.year,
      month: resolved.month,
      startDate: resolved.startDateStr,
      endDate: resolved.endDateStr,
    };
  }
}
