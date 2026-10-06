import { IsOptional, IsString } from 'class-validator';

export class MarcarLiderancaDto {
  @IsOptional()
  @IsString()
  grupo?: string;
}
