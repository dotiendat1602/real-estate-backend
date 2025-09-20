import { WebAppUser } from 'apps/core/src/modules/users/user.type';
import { WeatherCode } from './enum';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Constructor<T = any, Arguments extends unknown[] = any[]> = new (
  ...arguments_: Arguments
) => T;

export type KeyOfType<Entity, U> = {
  [P in keyof Required<Entity>]: Required<Entity>[P] extends U
    ? P
    : Required<Entity>[P] extends U[]
      ? P
      : never;
}[keyof Entity];

export type WebAppInitData = {
  user: WebAppUser;
  chat_instance: string;
  start_param?: string;
  auth_date: string;
  hash: string;
};

export type WeatherData = {
  id: number;
  main: WeatherCode;
  description: string;
  icon: string;
};
