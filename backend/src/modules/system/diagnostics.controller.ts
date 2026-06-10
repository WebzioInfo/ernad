import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

// Temporary in-memory store for diagnostics
const reports: any[] = [];

@ApiTags('Diagnostics')
@Controller('diagnostics')
export class DiagnosticsController {
  
  @Public()
  @Post('report')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit device diagnostic telemetry' })
  submitReport(@Body() body: any) {
    reports.push({ ...body, receivedAt: new Date().toISOString() });
    return { success: true };
  }

  // Normally we would protect this with @Roles('ADMIN'), but keeping it simple for the diagnostic widget
  @Get('summary')
  @ApiOperation({ summary: 'Get summary of diagnostic reports' })
  getSummary() {
    const total = reports.length;
    let failed = 0;
    let connected = 0;
    let commonErrors: Record<string, number> = {};

    reports.forEach(r => {
      const vFail = r.connectivity?.vercel?.success === false;
      const rFail = r.connectivity?.railway?.success === false;
      const apiFail = r.apiTest?.health?.success === false;
      
      if (vFail || rFail || apiFail) {
        failed++;
        const err = r.apiTest?.health?.error || r.connectivity?.railway?.error || 'Unknown Network Error';
        commonErrors[err] = (commonErrors[err] || 0) + 1;
      } else {
        connected++;
      }
    });

    const errorList = Object.entries(commonErrors)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get the most recent service worker stats
    const recentSW = reports.filter(r => r.serviceWorker).pop()?.serviceWorker;

    return {
      total,
      connected,
      failed,
      mostCommonErrors: errorList,
      currentServiceWorker: recentSW
    };
  }
}
