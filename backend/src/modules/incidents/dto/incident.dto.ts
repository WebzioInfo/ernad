import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export enum IncidentCategoryDto {
  FACTORY = 'FACTORY',
  LINE = 'LINE',
  STATION = 'STATION',
}

export enum IncidentPriorityDto {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum IncidentStatusDto {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export class CreateIncidentTypeDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsEnum(IncidentCategoryDto)
  category: IncidentCategoryDto;

  @IsEnum(IncidentPriorityDto)
  priority: IncidentPriorityDto;

  @IsBoolean()
  selfResolvable: boolean;

  @IsBoolean()
  productionImpact: boolean;

  @IsInt()
  @Min(0)
  defaultSlaMinutes: number;
}

export class CreateIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  incidentTypeId: string;

  @IsEnum(IncidentCategoryDto)
  category: IncidentCategoryDto;

  @IsOptional()
  @IsEnum(IncidentPriorityDto)
  priority?: IncidentPriorityDto;

  @IsOptional()
  @IsUUID()
  lineId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  stationId?: string;

  @IsOptional()
  @IsBoolean()
  productionImpact?: boolean;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  beforeImageUrl?: string;
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @IsOptional()
  @IsString()
  preventiveAction?: string;
}

export class StatusIncidentDto {
  @IsEnum(IncidentStatusDto)
  status: IncidentStatusDto;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  correctiveAction?: string;

  @IsOptional()
  @IsString()
  preventiveAction?: string;
}

export class CommentIncidentDto {
  @IsString()
  comment: string;
}

export class AttachmentDto {
  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  kind?: string;
}
