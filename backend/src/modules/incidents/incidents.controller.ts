import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Permissions } from '../auth/permissions.decorator';
import { IncidentsService } from './incidents.service';
import {
  AttachmentDto,
  CommentIncidentDto,
  CreateIncidentDto,
  CreateIncidentTypeDto,
  StatusIncidentDto,
  UpdateIncidentDto,
} from './dto/incident.dto';

@Controller('incidents')
@UseGuards(AuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get('types')
  @Permissions('incidents:view')
  getTypes(@Query() query: any) {
    return this.incidentsService.getTypes(query);
  }

  @Post('types')
  @Permissions('incidents:manage')
  createType(@Request() req: any, @Body() dto: CreateIncidentTypeDto) {
    return this.incidentsService.createType(this.userId(req), dto);
  }

  @Get('analytics')
  @Permissions('incidents:view')
  analytics(@Query() query: any) {
    return this.incidentsService.analytics(query);
  }

  @Get()
  @Permissions('incidents:view')
  findAll(@Request() req: any, @Query() query: any) {
    return this.incidentsService.findAll(this.userId(req), this.roles(req), query);
  }

  @Post()
  @Permissions('incidents:create')
  create(@Request() req: any, @Body() dto: CreateIncidentDto) {
    return this.incidentsService.create(this.userId(req), this.roles(req), dto);
  }

  @Get(':id')
  @Permissions('incidents:view')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.incidentsService.findOne(id, this.userId(req), this.roles(req));
  }

  @Patch(':id')
  @Permissions('incidents:update')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.incidentsService.update(id, this.userId(req), this.roles(req), dto);
  }

  @Patch(':id/status')
  @Permissions('incidents:update')
  updateStatus(@Request() req: any, @Param('id') id: string, @Body() dto: StatusIncidentDto) {
    return this.incidentsService.updateStatus(id, this.userId(req), this.roles(req), dto);
  }

  @Post(':id/comments')
  @Permissions('incidents:create')
  addComment(@Request() req: any, @Param('id') id: string, @Body() dto: CommentIncidentDto) {
    return this.incidentsService.addComment(id, this.userId(req), dto.comment);
  }

  @Post(':id/attachments')
  @Permissions('incidents:create')
  addAttachment(@Request() req: any, @Param('id') id: string, @Body() dto: AttachmentDto) {
    return this.incidentsService.addAttachment(id, this.userId(req), dto);
  }

  @Delete(':id')
  @Permissions('incidents:manage')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.incidentsService.remove(id, this.userId(req), this.roles(req));
  }

  private userId(req: any) {
    return req.user?.sub || req.user?.id;
  }

  private roles(req: any): string[] {
    return (req.user?.roles || (req.user?.role ? [req.user.role] : [])).map((role: string) => String(role).toUpperCase());
  }
}
