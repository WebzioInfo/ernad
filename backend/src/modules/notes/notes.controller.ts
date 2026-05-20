import { 
  Controller, Get, Post, Body, Patch, Param, Delete, 
  Query, UseGuards, Request 
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('notes')
@UseGuards(AuthGuard, RolesGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateNoteDto) {
    const userRole = req.user.role; // Assuming primary role is first
    return this.notesService.create(req.user.id, userRole, dto);
  }

  @Get()
  findAll(@Request() req, @Query() filters: any) {
    const userRole = req.user.role;
    return this.notesService.findAll(req.user.id, userRole, filters);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    const userRole = req.user.role;
    return this.notesService.findOne(id, req.user.id, userRole);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    const userRole = req.user.role;
    return this.notesService.update(id, req.user.id, userRole, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    const userRole = req.user.role;
    return this.notesService.remove(id, req.user.id, userRole);
  }
}
