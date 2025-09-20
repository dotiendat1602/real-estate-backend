import { NumberField } from 'libs/utils';

export class SyncLevelDto {
  @NumberField()
  level: number;
}
