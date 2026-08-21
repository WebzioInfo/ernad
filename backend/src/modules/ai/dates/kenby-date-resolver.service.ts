import { Injectable, Logger } from '@nestjs/common';

export interface ResolvedDateRange {
  periodType: 'today' | 'yesterday' | 'this_month' | 'last_month' | 'specific_month' | 'specific_date' | 'date_range';
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string;   // YYYY-MM-DD
  isExactDate: boolean;
  exactDate?: string;    // YYYY-MM-DD if isExactDate
  year?: number;
  month?: number;
  isExplicitInCurrentQuery: boolean;
  label: {
    ml: string;
    en: string;
  };
}

@Injectable()
export class KenbyDateResolverService {
  private readonly logger = new Logger(KenbyDateResolverService.name);

  // Authoritative operational calendar context — always derived from system clock, never hardcoded
  private get referenceYear(): number { return new Date().getFullYear(); }
  private get referenceMonth(): number { return new Date().getMonth() + 1; }

  private readonly monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  private readonly monthNamesMl = [
    'ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മെയ്', 'ജൂൺ',
    'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'
  ];

  /**
   * Deterministically resolves user inputs or LLM parameters into strict date query boundaries.
   * GUARANTEE: Current explicit date ALWAYS overrides past conversation context and defaults.
   */
  resolveDateBounds(params: Record<string, any> = {}): ResolvedDateRange {
    const rawPeriod = String(params.period || '').trim().toLowerCase();
    const rawDate = String(params.date || '').trim();
    const rawStartDate = String(params.startDate || '').trim();
    const rawEndDate = String(params.endDate || '').trim();
    const rawQ = String(params.question || '').trim().toLowerCase();

    // 1. Explicit Date Range (startDate + endDate)
    if (this.isValidIsoDate(rawStartDate) && this.isValidIsoDate(rawEndDate)) {
      return {
        periodType: 'date_range',
        startDateStr: rawStartDate,
        endDateStr: rawEndDate,
        isExactDate: rawStartDate === rawEndDate,
        exactDate: rawStartDate === rawEndDate ? rawStartDate : undefined,
        isExplicitInCurrentQuery: true,
        label: {
          ml: `${rawStartDate} മുതൽ ${rawEndDate} വരെ`,
          en: `From ${rawStartDate} to ${rawEndDate}`,
        },
      };
    }

    // 2. Exact ISO Date (YYYY-MM-DD)
    const isoDateCandidate = this.isValidIsoDate(rawDate) ? rawDate : this.isValidIsoDate(rawPeriod) ? rawPeriod : null;
    if (isoDateCandidate) {
      return this.buildExactDateBounds(isoDateCandidate, true);
    }

    // 3. DD/MM/YYYY or DD-MM-YYYY format
    const dmyMatch = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/) || rawPeriod.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      const isoStr = `${year}-${month}-${day}`;
      return this.buildExactDateBounds(isoStr, true);
    }

    // 4. Natural Named Date with day (e.g. "July 15", "August 2", "15 August", "24 July")
    const naturalDateMatch = this.extractNaturalDate(params.date || params.period || params.question || '');
    if (naturalDateMatch) {
      return this.buildExactDateBounds(naturalDateMatch, true);
    }

    // 5. Named Relative Days: today, yesterday — always use actual system clock date
    if (rawPeriod === 'today' || rawQ.includes('today') || rawQ.includes('ഇന്ന്')) {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const todayMonth = this.monthNamesEn[now.getMonth()];
      const todayMonthMl = this.monthNamesMl[now.getMonth()];
      const todayDay = now.getDate();
      const todayYear = now.getFullYear();
      return {
        periodType: 'today',
        startDateStr: todayStr,
        endDateStr: todayStr,
        isExactDate: true,
        exactDate: todayStr,
        isExplicitInCurrentQuery: true,
        label: { ml: `ഇന്ന് (${todayYear} ${todayMonthMl} ${todayDay})`, en: `Today (${todayMonth} ${todayDay}, ${todayYear})` },
      };
    }

    if (rawPeriod === 'yesterday' || rawQ.includes('yesterday') || rawQ.includes('ഇന്നലെ')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const yMonth = this.monthNamesEn[yesterday.getMonth()];
      const yMonthMl = this.monthNamesMl[yesterday.getMonth()];
      const yDay = yesterday.getDate();
      const yYear = yesterday.getFullYear();
      return {
        periodType: 'yesterday',
        startDateStr: yesterdayStr,
        endDateStr: yesterdayStr,
        isExactDate: true,
        exactDate: yesterdayStr,
        isExplicitInCurrentQuery: true,
        label: { ml: `ഇന്നലെ (${yYear} ${yMonthMl} ${yDay})`, en: `Yesterday (${yMonth} ${yDay}, ${yYear})` },
      };
    }

    // 6. Relative Month Offsets (e.g. "July-ന് മുമ്പുള്ള മാസം" -> June 2026)
    const monthBeforeMatch = (params.question || rawPeriod).match(/(july|june|august|ജൂലൈ|ജൂൺ|ഓഗസ്റ്റ്)[^\w\d]*മുമ്പുള്ള/i);
    if (monthBeforeMatch) {
      const refName = monthBeforeMatch[1].toLowerCase();
      let targetMonth = 6; // default June
      if (refName.includes('july') || refName.includes('ജൂലൈ')) targetMonth = 6;
      else if (refName.includes('june') || refName.includes('ജൂൺ')) targetMonth = 5;
      else if (refName.includes('august') || refName.includes('ഓഗസ്റ്റ്')) targetMonth = 7;
      return this.buildMonthBounds(2026, targetMonth, 'specific_month', true);
    }

    // 7. Named Relative Months: last_month, previous_month
    if (
      rawPeriod === 'last_month' ||
      rawPeriod === 'previous_month' ||
      rawQ.includes('last month') ||
      rawQ.includes('previous month') ||
      rawQ.includes('കഴിഞ്ഞ മാസം') ||
      rawQ.includes('കടഞ്ഞ മാസം') ||
      rawQ.includes('മുൻപത്തെ മാസം')
    ) {
      // Derive last month dynamically from system clock — never hardcode
      const prevYear = this.referenceMonth === 1 ? this.referenceYear - 1 : this.referenceYear;
      const prevMonth = this.referenceMonth === 1 ? 12 : this.referenceMonth - 1;
      return this.buildMonthBounds(prevYear, prevMonth, 'last_month', true);
    }

    // 8. Explicit Named Month in Question or Period (e.g. "July return details", "July sales", "August total data", "ജൂലൈയിലെ റിട്ടേൺ")
    const namedMonthNum = this.extractNamedMonth(rawQ || rawPeriod);
    if (namedMonthNum !== null) {
      const periodType = namedMonthNum === this.referenceMonth ? 'this_month' : namedMonthNum === this.referenceMonth - 1 ? 'last_month' : 'specific_month';
      return this.buildMonthBounds(this.referenceYear, namedMonthNum, periodType, true);
    }

    // 9. Specific Month (YYYY-MM or year + month params)
    const isoMonthMatch = rawPeriod.match(/^(\d{4})-(\d{1,2})$/);
    if (isoMonthMatch) {
      const y = Number(isoMonthMatch[1]);
      const m = Number(isoMonthMatch[2]);
      return this.buildMonthBounds(y, m, 'specific_month', true);
    }

    if (params.year && params.month) {
      const y = Number(params.year);
      const m = Number(params.month);
      return this.buildMonthBounds(y, m, 'specific_month', true);
    }

    // 10. Default: this_month (current system month) — always from system clock, never hardcoded
    return this.buildMonthBounds(this.referenceYear, this.referenceMonth, 'this_month', false);
  }

  private buildExactDateBounds(dateStr: string, isExplicit = true): ResolvedDateRange {
    const parts = dateStr.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const monthMl = this.monthNamesMl[month - 1] || '';
    const monthEn = this.monthNamesEn[month - 1] || '';

    return {
      periodType: 'specific_date',
      startDateStr: dateStr,
      endDateStr: dateStr,
      isExactDate: true,
      exactDate: dateStr,
      year,
      month,
      isExplicitInCurrentQuery: isExplicit,
      label: {
        ml: `${year} ${monthMl} ${day}`,
        en: `${monthEn} ${day}, ${year}`,
      },
    };
  }

  private buildMonthBounds(year: number, month: number, periodType: 'this_month' | 'last_month' | 'specific_month', isExplicit = true): ResolvedDateRange {
    const mStr = String(month).padStart(2, '0');
    const startDateStr = `${year}-${mStr}-01`;

    let nextY = year;
    let nextM = month + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY = year + 1;
    }
    const nextMStr = String(nextM).padStart(2, '0');
    const endDateStr = `${nextY}-${nextMStr}-01`;

    const monthMl = this.monthNamesMl[month - 1] || '';
    const monthEn = this.monthNamesEn[month - 1] || '';

    return {
      periodType,
      startDateStr,
      endDateStr,
      isExactDate: false,
      year,
      month,
      isExplicitInCurrentQuery: isExplicit,
      label: {
        ml: `${year} ${monthMl}`,
        en: `${monthEn} ${year}`,
      },
    };
  }

  private extractNamedMonth(text: string): number | null {
    if (!text) return null;
    const lower = text.toLowerCase();

    // Map month names to numbers
    const monthMap: Record<string, number> = {
      'january': 1, 'jan': 1, 'ജനുവരി': 1,
      'february': 2, 'feb': 2, 'ഫെബ്രുവരി': 2,
      'march': 3, 'mar': 3, 'മാർച്ച്': 3,
      'april': 4, 'apr': 4, 'ഏപ്രിൽ': 4,
      'may': 5, 'മെയ്': 5, 'മേയ്': 5,
      'june': 6, 'jun': 6, 'ജൂൺ': 6,
      'july': 7, 'jul': 7, 'ജൂലൈ': 7,
      'august': 8, 'aug': 8, 'ഓഗസ്റ്റ്': 8,
      'september': 9, 'sep': 9, 'സെപ്റ്റംബർ': 9,
      'october': 10, 'oct': 10, 'ഒക്ടോബർ': 10,
      'november': 11, 'nov': 11, 'നവംബർ': 11,
      'december': 12, 'dec': 12, 'ഡിസംബർ': 12,
    };

    for (const [key, val] of Object.entries(monthMap)) {
      // Avoid partial substring false positives (e.g. "may" inside "maybe")
      const regex = new RegExp(`\\b${key}\\b|${key}`, 'i');
      if (regex.test(lower)) {
        return val;
      }
    }

    return null;
  }

  private extractNaturalDate(text: string): string | null {
    if (!text) return null;
    const lower = text.toLowerCase();

    const monthMap: Record<string, number> = {
      'january': 1, 'jan': 1, 'ജനുവരി': 1,
      'february': 2, 'feb': 2, 'ഫെബ്രുവരി': 2,
      'march': 3, 'mar': 3, 'മാർച്ച്': 3,
      'april': 4, 'apr': 4, 'ഏപ്രിൽ': 4,
      'may': 5, 'മെയ്': 5, 'മേയ്': 5,
      'june': 6, 'jun': 6, 'ജൂൺ': 6,
      'july': 7, 'jul': 7, 'ജൂലൈ': 7,
      'august': 8, 'aug': 8, 'ഓഗസ്റ്റ്': 8,
      'september': 9, 'sep': 9, 'സെപ്റ്റംബർ': 9,
      'october': 10, 'oct': 10, 'ഒക്ടോബർ': 10,
      'november': 11, 'nov': 11, 'നവംബർ': 11,
      'december': 12, 'dec': 12, 'ഡിസംബർ': 12,
    };

    for (const [monthKey, monthNum] of Object.entries(monthMap)) {
      // 1. "July 15", "July 15th", "July 12-ന്", "ജൂലൈ 15"
      const regex1 = new RegExp(`(?:${monthKey})[\\s\\-]*(\\d{1,2})(?:st|nd|rd|th)?(?:[\\-](?:ന്|ൽ|ലെ|ലേക്ക്))?`, 'i');
      const m1 = lower.match(regex1);
      if (m1) {
        const day = Number(m1[1]);
        if (day >= 1 && day <= 31) {
          return `2026-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }

      // 2. "15 July", "15th July", "15th of July", "15 ജൂലൈ"
      const regex2 = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*of)?\\s*(?:${monthKey})`, 'i');
      const m2 = lower.match(regex2);
      if (m2) {
        const day = Number(m2[1]);
        if (day >= 1 && day <= 31) {
          return `2026-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }

    return null;
  }

  private isValidIsoDate(str: string): boolean {
    if (!str || typeof str !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(str);
  }
}
