function fillTimeSeriesGaps(rawTrend: any[], timeRange: string, start: Date, end: Date) {
  const trendMap = new Map<number, number>();
  rawTrend.forEach(t => {
    trendMap.set(new Date(t.time).getTime(), t.produced);
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

const start = new Date('2026-06-01T00:00:00Z');
const end = new Date('2026-06-05T13:48:00Z');
const raw = [
  { time: '2026-06-02T00:00:00.000Z', produced: 100 },
  { time: '2026-06-04T00:00:00.000Z', produced: 50 },
];
console.log(fillTimeSeriesGaps(raw, 'month', start, end));
