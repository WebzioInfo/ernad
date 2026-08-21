import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiService } from './ai.service';

@ApiTags('AI Owner Assistant')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('owner-assistant')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get monthly human-readable AI business intelligence report for company owner' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'date', required: false, type: String })
  async getOwnerAnalysis(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('date') dateStr?: string,
  ) {
    const parsedYear = year ? parseInt(year, 10) : undefined;
    const parsedMonth = month ? parseInt(month, 10) : undefined;
    return await this.aiService.getMonthlyReport(parsedYear, parsedMonth, dateStr);
  }

  @Post('owner-assistant/ask')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Ask natural language or preset question to Ask Kenby assistant' })
  async askQuestion(
    @Body('question') question: string,
    @Body('context') context?: any,
  ) {
    return await this.aiService.askQuestion(question || 'today_actions', context);
  }
}
