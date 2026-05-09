import { IsString, IsEnum, IsOptional, IsUUID, IsBoolean, IsArray } from 'class-validator';

export enum NoteType {
  GENERAL = 'GENERAL',
  PRODUCTION = 'PRODUCTION',
  MAINTENANCE = 'MAINTENANCE',
  QUALITY = 'QUALITY',
  SHIFT_HANDOVER = 'SHIFT_HANDOVER',
  INCIDENT = 'INCIDENT',
  BREAKDOWN = 'BREAKDOWN',
  ALERT = 'ALERT',
  STOCK = 'STOCK'
}

export enum NotePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export class CreateNoteDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(NoteType)
  @IsOptional()
  type?: NoteType;

  @IsEnum(NotePriority)
  @IsOptional()
  priority?: NotePriority;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  lineId?: string;

  @IsUUID()
  @IsOptional()
  shiftId?: string;

  @IsString()
  @IsOptional()
  machineId?: string;

  @IsUUID()
  @IsOptional()
  productionBatchId?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsArray()
  @IsOptional()
  attachments?: any[];

  @IsArray()
  @IsOptional()
  tags?: string[];
}

export class UpdateNoteDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(NoteType)
  @IsOptional()
  type?: NoteType;

  @IsEnum(NotePriority)
  @IsOptional()
  priority?: NotePriority;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsArray()
  @IsOptional()
  attachments?: any[];

  @IsArray()
  @IsOptional()
  tags?: string[];
}
