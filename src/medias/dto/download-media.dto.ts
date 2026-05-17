import { IsIn, IsUrl } from 'class-validator';

export class DownloadMediaDto {
  @IsUrl()
  url!: string;

  @IsIn(['video', 'audio'])
  format!: 'video' | 'audio';
}
