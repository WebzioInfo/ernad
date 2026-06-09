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
      dashboardRows,
      activeBatchRows,
      stockRows,
      alertRows,
      trendRows,
    ] = await Promise.all([
      db.execute(sql`
        SELECT
          -- Production KPIs
          (
            select coalesce(sum(case when pl.station = 'PACKING' then coalesce(pl.primary_count, 0) else 0 end), 0)::int
            from production_logs pl
            join production_batches pb on pb.id = pl.batch_id and pb.deleted_at is null
            where pl.deleted_at is null and ${rangeClause}
          ) as units_packed,
          (
            select coalesce(sum(coalesce(pl.primary_count, 0)), 0)::int
            from production_logs pl
            join production_batches pb on pb.id = pl.batch_id and pb.deleted_at is null
            where pl.deleted_at is null and ${rangeClause}
          ) as total_output,
          (
            select coalesce(sum(coalesce(pl.wastage_count, 0)::numeric), 0)::numeric
            from production_logs pl
            join production_batches pb on pb.id = pl.batch_id and pb.deleted_at is null
            where pl.deleted_at is null and ${rangeClause}
          ) as wastage,
          (
            select count(distinct pb.line_id)::int
            from production_batches pb
            where pb.deleted_at is null and ${batchRangeClause}
          ) as active_lines,
          (
            select count(*) filter (where pb.status in ('RUNNING', 'CHANGEOVER'))::int
            from production_batches pb
            where pb.deleted_at is null and ${batchRangeClause}
          ) as running_batches,
          (
            select coalesce(sum(coalesce(dl.duration_minutes, greatest(0, extract(epoch from (coalesce(dl.end_time, now()) - dl.start_time)) / 60.0))), 0)::numeric
            from downtime_logs dl
            join production_batches pb on pb.id = dl.batch_id and pb.deleted_at is null
            where dl.deleted_at is null and ${downtimeRangeClause}
          ) as downtime_minutes,
          (
            select count(*)::int
            from operator_sessions os
            where os.is_active = true and os.end_time is null
          ) as staff_active,
          (
            select count(*)::int
            from incidents i
            where i.deleted_at is null and i.status in ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS')
          ) as open_incidents,
          (
            select count(*)::int
            from inventory_stock s
            where s.quantity::numeric < 0
              or (s.minimum_stock::numeric > 0 and s.quantity::numeric <= s.minimum_stock::numeric)
          ) as stock_alerts,
          (
            select coalesce(sum(greatest(0, extract(epoch from (coalesce(pb.end_time, pb.closed_at, ${sql.raw(`'${endIso}'`)}) - pb.start_time)) / 60.0) * p.target_bpm), 0)::numeric
            from production_batches pb
            join products p on p.id = pb.product_id
            where pb.deleted_at is null and ${batchRangeClause}
          ) as planned_units,
          -- Sales Activity
          (
            select coalesce(sum(case when type = 'SALES_DISPATCH' then quantity else 0 end), 0)::int
            from sales_transactions
            where created_at >= ${sql.raw(`'${startIso}'`)} and created_at <= ${sql.raw(`'${endIso}'`)}
          ) as dispatch_quantity,
          (
            select coalesce(sum(case when type = 'DAMAGE' then quantity else 0 end), 0)::int
            from sales_transactions
            where created_at >= ${sql.raw(`'${startIso}'`)} and created_at <= ${sql.raw(`'${endIso}'`)}
          ) as damage_quantity,
          (
            select coalesce(sum(case when type = 'RETURN' then quantity else 0 end), 0)::int
            from sales_transactions
            where created_at >= ${sql.raw(`'${startIso}'`)} and created_at <= ${sql.raw(`'${endIso}'`)}
          ) as return_quantity
      `),
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
      db.execute(sql`
        with alerts as (
          select
            'NEGATIVE_STOCK'::text type,
            s.id::text id,
            s.item_name::text title,
            concat(s.quantity, ' ', s.unit, ' available')::text detail,
            'critical'::text severity,
            'raw-materials'::text target
          from inventory_stock s
          where s.quantity::numeric < 0
          
          union all
          
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
            
          union all
          
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
            
          union all
          
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
          
          union all
          
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
        )
        select type, id, title, detail, severity, target
        from alerts
        order by case 
          when severity = 'critical' then 1 
          when severity = 'high' then 2 
          when severity = 'warning' then 3 
          when severity = 'medium' then 4 
          when severity = 'low' then 5 
          else 9 
        end
        limit 25;
      `),
      db.execute(sql`
        select
          ${live 
            ? sql`to_timestamp(floor(extract(epoch from pl.logged_at) / 900) * 900)` 
            : timeRange === 'week' 
              ? sql`date_trunc('day', pl.logged_at)` 
              : timeRange === 'month' 
                ? sql`date_trunc('day', pl.logged_at)` 
                : sql`date_trunc('hour', pl.logged_at)`} as time,
          coalesce(sum(pl.cases_produced), 0)::int as produced
        from production_logs pl
        where pl.deleted_at is null and pl.logged_at >= ${startIso}
        group by 1
        order by 1;
      `)
    ]);

    const kpis = this.first(dashboardRows);
    const stock = this.first(stockRows);
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
        dispatchQuantity: Number(kpis.dispatch_quantity || 0),
        damageQuantity: Number(kpis.damage_quantity || 0),
        returnQuantity: Number(kpis.return_quantity || 0),
      },
      trend: this.fillTimeSeriesGaps(trendRows, normalizedRange, start, end),
      formulas: {
        machineOee: 'min(100, (packing output / sum(target BPM * batch runtime minutes)) * (packing output / (packing output + wastage)) * 100)',
        unitsPacked: 'sum PACKING logs using finished_goods_produced, cases_produced, then primary_count',
        downtime: 'sum downtime_logs duration_minutes or open elapsed minutes',
        systemAlerts: 'open incidents + stock alerts + generated critical alert rows',
      },
    };
  }

  private fillTimeSeriesGaps(rawTrend: unknown, timeRange: DashboardTimeRange, start: Date, end: Date) {
    const rows = this.rows(rawTrend);
    const trendMap = new Map<number, number>();
    rows.forEach(t => {
      let timeStr = t.time;
      if (typeof timeStr === 'string' && !timeStr.includes('T') && !timeStr.endsWith('Z')) {
        timeStr = timeStr.replace(' ', 'T') + 'Z';
      } else if (typeof timeStr === 'string' && !timeStr.endsWith('Z')) {
        timeStr += 'Z';
      }
      trendMap.set(new Date(timeStr).getTime(), Number(t.produced || 0));
    });

    const trend = [];
    const current = new Date(start);

    if (timeRange === 'live' || timeRange === 'today') {
      current.setUTCMinutes(0, 0, 0);
      while (current <= end) {
        trend.push({
          time: current.toISOString(),
          produced: trendMap.get(current.getTime()) || 0
        });
        current.setUTCHours(current.getUTCHours() + 1);
      }
    } else {
      current.setUTCHours(0, 0, 0, 0);
      const endTrunc = new Date(end);
      endTrunc.setUTCHours(0, 0, 0, 0);
      while (current <= endTrunc) {
        trend.push({
          time: current.toISOString(),
          produced: trendMap.get(current.getTime()) || 0
        });
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }
    return trend;
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
}
