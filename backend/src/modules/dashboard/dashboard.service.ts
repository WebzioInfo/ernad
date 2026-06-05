import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { db } from '../../database/db';
import { salesTransactions } from '../../database/schema';

export type DashboardTimeRange = 'live' | 'today' | 'week' | 'month';

type AnyRow = Record<string, any>;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  async getOverview(timeRange: DashboardTimeRange = 'today') {
    const normalizedRange = this.normalizeRange(timeRange);
    const { start, end, live } = this.getRangeWindow(normalizedRange);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const rangeClause = live
      ? sql`pb.status in ('RUNNING', 'CHANGEOVER')`
      : sql`pl.logged_at >= ${startIso} and pl.logged_at <= ${endIso}`;
    const batchRangeClause = live
      ? sql`pb.status in ('RUNNING', 'CHANGEOVER')`
      : sql`pb.start_time <= ${endIso} and coalesce(pb.end_time, pb.closed_at, now()) >= ${startIso}`;
    const incidentRangeClause = live
      ? sql`i.status in ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS')`
      : sql`i.opened_at >= ${startIso} and i.opened_at <= ${endIso}`;
    const downtimeRangeClause = live
      ? sql`dl.end_time is null`
      : sql`dl.start_time >= ${startIso} and dl.start_time <= ${endIso}`;

    const [
      kpiRows,
      activeBatchRows,
      stockRows,
      alertRows,
      activityRows,
    ] = await Promise.all([
      this.getKpis(start, end, live, rangeClause, batchRangeClause, downtimeRangeClause),
      db.execute(sql`
        select
          pb.id,
          pb.batch_code,
          l.name line,
          s.name shift,
          p.name product,
          pb.status,
          pb.start_time,
          coalesce(bt.packing_total, 0)::int current_output,
          coalesce(bt.finished_goods_total, 0)::int finished_goods,
          coalesce(bt.scrap_total, 0)::numeric scrap_total,
          greatest(0, extract(epoch from (now() - pb.start_time)) / 60.0)::int runtime_minutes
        from production_batches pb
        join production_lines l on l.id = pb.line_id
        join shifts s on s.id = pb.shift_id
        join products p on p.id = pb.product_id
        left join batch_totals bt on bt.batch_id = pb.id
        where pb.deleted_at is null and pb.status in ('RUNNING', 'CHANGEOVER')
        order by pb.start_time desc;
      `),
      db.execute(sql`
        with raw_stock as (
          select
            upper(coalesce(material_type, item_name)) type,
            item_name name,
            unit,
            quantity::numeric quantity,
            minimum_stock::numeric minimum_stock
          from inventory_stock
          union all
          select
            upper(material_type) type,
            name,
            unit,
            current_stock::numeric quantity,
            0::numeric minimum_stock
          from raw_materials
        ),
        produced_period as (
          select
            coalesce(sum(case when pl.station = 'PACKING' then coalesce(pl.cases_produced, 0) else 0 end), 0)::int produced,
            coalesce(sum(case when pl.station = 'BLOWING' then coalesce(pl.bags_used, 0)::numeric else 0 end), 0)::numeric preforms_used,
            coalesce(sum(case when pl.station = 'FILLING' then coalesce(pl.cap_box_usage, pl.cap_usage, 0) else 0 end), 0)::numeric caps_used,
            coalesce(sum(coalesce(pl.preform_usage, 0)), 0)::numeric preform_pieces_used,
            coalesce(sum(coalesce(pl.cap_usage, 0)), 0)::numeric cap_pieces_used,
            coalesce(sum(coalesce(pl.shrink_weight_used, 0)), 0)::numeric shrink_used,
            coalesce(sum(coalesce(pl.label_usage, pl.bop_roll_usage, 0)), 0)::numeric labels_used
          from production_logs pl
          join production_batches pb on pb.id = pl.batch_id and pb.deleted_at is null
          where pl.deleted_at is null and ${rangeClause}
        )
        select
          coalesce(sum(quantity) filter (where type like '%PREFORM%' or name ilike '%preform%'), 0)::numeric preforms_available,
          coalesce(sum(quantity) filter (where type like '%CAP%' or name ilike '%cap%'), 0)::numeric caps_available,
          (
            select coalesce(sum(ps.current_stock::numeric), 0)::numeric
            from production_stock ps
            join products p on p.id = ps.product_id
            where p.name ilike '%20l%' or p.sku ilike '%20l%'
          ) jar_20l_stock,
          (select produced from produced_period) produced_period,
          (select preforms_used from produced_period) preforms_used_period,
          (select caps_used from produced_period) caps_used_period,
          (select preform_pieces_used from produced_period) preform_pieces_used_period,
          (select cap_pieces_used from produced_period) cap_pieces_used_period,
          (select shrink_used from produced_period) shrink_used_period,
          (select labels_used from produced_period) labels_used_period
        from raw_stock;
      `),
      this.getCriticalAlerts(incidentRangeClause, downtimeRangeClause, rangeClause),
      this.getSalesActivity(start, end),
    ]);

    const kpis = this.first(kpiRows);
    const stock = this.first(stockRows);
    const activity = this.first(activityRows);
    const activeBatches = this.rows(activeBatchRows).map((row) => ({
      id: row.id,
      batchCode: row.batch_code,
      line: row.line,
      shift: row.shift,
      product: row.product,
      status: row.status,
      currentOutput: Number(row.current_output || row.finished_goods || 0),
      runtimeMinutes: Number(row.runtime_minutes || 0),
      startedAt: row.start_time,
    }));

    const unitsPacked = Number(kpis.units_packed || 0);
    const plannedUnits = Number(kpis.planned_units || 0);
    const downtimeMinutes = Math.round(Number(kpis.downtime_minutes || 0));
    const wastage = Number(kpis.wastage || 0);
    const quality = unitsPacked + wastage > 0 ? unitsPacked / (unitsPacked + wastage) : 1;
    const performance = plannedUnits > 0 ? unitsPacked / plannedUnits : 0;
    const machineOee = Math.max(0, Math.min(100, Math.round(performance * quality * 100)));
    const alerts = this.rows(alertRows);

    return {
      timeRange: normalizedRange,
      window: { start: start.toISOString(), end: end.toISOString(), live },
      kpis: {
        activeLines: Number(kpis.active_lines || 0),
        runningBatches: Number(kpis.running_batches || activeBatches.length || 0),
        machineOee,
        unitsPacked,
        systemAlerts: Number(kpis.open_incidents || 0) + Number(kpis.stock_alerts || 0) + alerts.length,
        staffActive: Number(kpis.staff_active || 0),
        downtimeMinutes,
      },
      materials: {
        preformsAvailable: Number(stock.preforms_available || 0),
        capsAvailable: Number(stock.caps_available || 0),
        jar20LStock: Number(stock.jar_20l_stock || 0),
        producedDuringPeriod: Number(stock.produced_period || 0),
        preformsUsedDuringPeriod: Number(stock.preforms_used_period || 0),
        capsUsedDuringPeriod: Number(stock.caps_used_period || 0),
        preformPiecesUsedDuringPeriod: Number(stock.preform_pieces_used_period || 0),
        capPiecesUsedDuringPeriod: Number(stock.cap_pieces_used_period || 0),
        shrinkUsedDuringPeriod: Number(stock.shrink_used_period || 0),
        labelsUsedDuringPeriod: Number(stock.labels_used_period || 0),
      },
      activeProduction: activeBatches,
      alerts,
      activity: {
        dispatchQuantity: Number(activity.dispatchQuantity || 0),
        damageQuantity: Number(activity.damageQuantity || 0),
        returnQuantity: Number(activity.returnQuantity || 0),
      },
      formulas: {
        machineOee: 'min(100, (packing output / sum(target BPM * batch runtime minutes)) * (packing output / (packing output + wastage)) * 100)',
        unitsPacked: 'sum PACKING logs using finished_goods_produced, cases_produced, then primary_count',
        downtime: 'sum downtime_logs duration_minutes or open elapsed minutes',
        systemAlerts: 'open incidents + stock alerts + generated critical alert rows',
      },
    };
  }

  private normalizeRange(timeRange: string): DashboardTimeRange {
    return ['live', 'today', 'week', 'month'].includes(timeRange) ? (timeRange as DashboardTimeRange) : 'today';
  }

  private getRangeWindow(timeRange: DashboardTimeRange) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (timeRange === 'week') {
      start.setDate(start.getDate() - 6);
    }

    if (timeRange === 'month') {
      start.setDate(1);
    }

    return { start, end: now, live: timeRange === 'live' };
  }

  private rows(result: unknown): AnyRow[] {
    if (Array.isArray(result)) return result as AnyRow[];
    return ((result as any)?.rows || []) as AnyRow[];
  }

  private first(result: unknown): AnyRow {
    return this.rows(result)[0] || {};
  }

  private async getKpis(
    start: Date,
    end: Date,
    live: boolean,
    rangeClause: any,
    batchRangeClause: any,
    downtimeRangeClause: any,
  ) {
    try {
      const [productionRows, batchRows, downtimeRows, staffRows, incidentRows, stockAlertRows, plannedRows] = await Promise.all([
        db.execute(sql`
          select
            coalesce(sum(case when pl.station = 'PACKING' then coalesce(pl.primary_count, 0) else 0 end), 0)::int units_packed,
            coalesce(sum(coalesce(pl.primary_count, 0)), 0)::int total_output,
            coalesce(sum(coalesce(pl.wastage_count, 0)::numeric), 0)::numeric wastage
          from production_logs pl
          join production_batches pb on pb.id = pl.batch_id and pb.deleted_at is null
          where pl.deleted_at is null and ${rangeClause};
        `),
        db.execute(sql`
          select
            count(distinct pb.line_id)::int active_lines,
            count(*) filter (where pb.status in ('RUNNING', 'CHANGEOVER'))::int running_batches
          from production_batches pb
          where pb.deleted_at is null and ${batchRangeClause};
        `),
        db.execute(sql`
          select coalesce(sum(coalesce(dl.duration_minutes, greatest(0, extract(epoch from (coalesce(dl.end_time, now()) - dl.start_time)) / 60.0))), 0)::numeric downtime_minutes
          from downtime_logs dl
          join production_batches pb on pb.id = dl.batch_id and pb.deleted_at is null
          where dl.deleted_at is null and ${downtimeRangeClause};
        `),
        db.execute(sql`
          select count(*)::int staff_active
          from operator_sessions os
          where os.is_active = true and os.end_time is null;
        `),
        db.execute(sql`
          select count(*)::int open_incidents
          from incidents i
          where i.deleted_at is null and i.status in ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS');
        `),
        db.execute(sql`
          select count(*)::int stock_alerts
          from inventory_stock s
          where s.quantity::numeric < 0
            or (s.minimum_stock::numeric > 0 and s.quantity::numeric <= s.minimum_stock::numeric);
        `),
        db.execute(sql`
          select coalesce(sum(greatest(0, extract(epoch from (coalesce(pb.end_time, pb.closed_at, ${end.toISOString()}) - pb.start_time)) / 60.0) * p.target_bpm), 0)::numeric planned_units
          from production_batches pb
          join products p on p.id = pb.product_id
          where pb.deleted_at is null and ${batchRangeClause};
        `),
      ]);

      const production = this.first(productionRows);
      const batches = this.first(batchRows);
      const downtime = this.first(downtimeRows);
      const staff = this.first(staffRows);
      const incidents = this.first(incidentRows);
      const stockAlerts = this.first(stockAlertRows);
      const planned = this.first(plannedRows);

      return [{
        units_packed: production.units_packed || 0,
        total_output: production.total_output || 0,
        wastage: production.wastage || 0,
        active_lines: live ? (batches.active_lines || 0) : 0,
        running_batches: batches.running_batches || 0,
        downtime_minutes: downtime.downtime_minutes || 0,
        staff_active: staff.staff_active || 0,
        open_incidents: incidents.open_incidents || 0,
        stock_alerts: stockAlerts.stock_alerts || 0,
        planned_units: planned.planned_units || 0,
      }];
    } catch (error: any) {
      this.logger.error(`Dashboard KPI aggregate failed: ${error?.message || error}`);
      return [{
        units_packed: 0,
        total_output: 0,
        wastage: 0,
        active_lines: 0,
        running_batches: 0,
        downtime_minutes: 0,
        staff_active: 0,
        open_incidents: 0,
        stock_alerts: 0,
        planned_units: 0,
      }];
    }
  }

  private async getSalesActivity(start: Date, end: Date) {
    try {
      return await db.select({
        dispatchQuantity: sql<number>`coalesce(sum(case when ${salesTransactions.type} = 'SALES_DISPATCH' then ${salesTransactions.quantity} else 0 end), 0)::int`,
        damageQuantity: sql<number>`coalesce(sum(case when ${salesTransactions.type} = 'DAMAGE' then ${salesTransactions.quantity} else 0 end), 0)::int`,
        returnQuantity: sql<number>`coalesce(sum(case when ${salesTransactions.type} = 'RETURN' then ${salesTransactions.quantity} else 0 end), 0)::int`,
      })
      .from(salesTransactions)
      .where(sql`${salesTransactions.createdAt} >= ${start.toISOString()} and ${salesTransactions.createdAt} <= ${end.toISOString()}`);
    } catch (error: any) {
      this.logger.warn(`Sales activity aggregate unavailable for dashboard: ${error?.message || error}`);
      return [{ dispatchQuantity: 0, damageQuantity: 0, returnQuantity: 0 }];
    }
  }

  private async getCriticalAlerts(incidentRangeClause: any, downtimeRangeClause: any, rangeClause: any) {
    try {
      const [negativeStock, lowStock, openIncidents, machineDowntime, failedBatches] = await Promise.all([
        db.execute(sql`
          select
            'NEGATIVE_STOCK'::text type,
            s.id::text id,
            s.item_name::text title,
            concat(s.quantity, ' ', s.unit, ' available')::text detail,
            'critical'::text severity,
            'raw-materials'::text target
          from inventory_stock s
          where s.quantity::numeric < 0
          limit 10;
        `),
        db.execute(sql`
          select
            'LOW_RAW_MATERIAL'::text type,
            s.id::text id,
            s.item_name::text title,
            concat(s.quantity, ' ', s.unit, ' below minimum ', s.minimum_stock)::text detail,
            'warning'::text severity,
            'raw-materials'::text target
          from inventory_stock s
          where s.quantity::numeric >= 0
            and s.minimum_stock::numeric > 0
            and s.quantity::numeric <= s.minimum_stock::numeric
          limit 10;
        `),
        db.execute(sql`
          select
            'OPEN_INCIDENT'::text type,
            i.id::text id,
            i.title::text title,
            concat(i.priority, ' incident ', i.incident_number)::text detail,
            lower(i.priority::text)::text severity,
            'incidents'::text target
          from incidents i
          where i.deleted_at is null
            and i.status in ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS')
            and ${incidentRangeClause}
          order by i.opened_at desc
          limit 10;
        `),
        db.execute(sql`
          select
            'MACHINE_DOWNTIME'::text type,
            dl.id::text id,
            dl.reason::text title,
            concat(l.name, ' / ', dl.station)::text detail,
            'critical'::text severity,
            'production'::text target
          from downtime_logs dl
          join production_lines l on l.id = dl.line_id
          where dl.deleted_at is null and ${downtimeRangeClause}
          order by dl.start_time desc
          limit 10;
        `),
        db.execute(sql`
          select
            'FAILED_BATCH'::text type,
            pl.batch_id::text id,
            pb.batch_code::text title,
            concat(count(*)::int, ' rejected production logs')::text detail,
            'warning'::text severity,
            'reports'::text target
          from production_logs pl
          join production_batches pb on pb.id = pl.batch_id
          where pl.deleted_at is null
            and pl.status = 'REJECTED'
            and ${rangeClause}
          group by pl.batch_id, pb.batch_code
          limit 10;
        `),
      ]);

      const severityRank: Record<string, number> = { critical: 1, high: 2, warning: 3, medium: 4, low: 5 };
      return [
        ...this.rows(negativeStock),
        ...this.rows(lowStock),
        ...this.rows(openIncidents),
        ...this.rows(machineDowntime),
        ...this.rows(failedBatches),
      ]
        .sort((a, b) => (severityRank[a.severity] || 9) - (severityRank[b.severity] || 9))
        .slice(0, 25);
    } catch (error: any) {
      this.logger.warn(`Critical alert aggregate unavailable for dashboard: ${error?.message || error}`);
      return [];
    }
  }
}
