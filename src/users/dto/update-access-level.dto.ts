import { IsIn, IsInt } from 'class-validator';

export class UpdateAccessLevelDto {
  @IsInt()
  @IsIn([1, 2])
  accessLevel!: number;
}
