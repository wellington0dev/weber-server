import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDirDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  dirPath!: string;
}
