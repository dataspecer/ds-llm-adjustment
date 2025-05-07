import { IsString, IsUrl, IsOptional } from 'class-validator';

export class DialogResponseDto {
  @IsString()
  public dialogId: string;

  @IsString()
  public status: 'pending' | 'processing' | 'ready';

  @IsOptional()
  @IsUrl()
  public viewUrl?: string;

  @IsOptional()
  @IsString()
  public message?: string;
}
