import { StringField } from 'libs/utils';

export class UpdateUserProfileDto {
  @StringField()
  cityId: string;
}
