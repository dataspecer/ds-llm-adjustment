import { IsString, IsObject } from 'class-validator';

export class CreateDialogDto {
    @IsString()
    public psmId: string;
  
    @IsString()
    public specId: string;
  
    @IsObject()
    public schema: Record<string, any>;
  }