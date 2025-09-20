export const ValuesImportant = ['password', 'refreshToken', 'oldPassword', 'newPassword'];

export enum RoleType {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum TokenType {
  ACCESS_TOKEN = 'ACCESS_TOKEN',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
}

export enum ErrorCode {
  INVALID_INPUT = 'ERR100',
  UNAUTHORIZED_TELEGRAM = 'ERR101',
}

export enum WeatherCode {
  Thunderstorm = 'Thunderstorm',
  Drizzle = 'Drizzle',
  Rain = 'Rain',
  Snow = 'Snow',
  Clear = 'Clear',
  Clouds = 'Clouds',
  Mist = 'Mist',
  Smoke = 'Smoke',
  Haze = 'Haze',
  Dust = 'Dust',
  Sand = 'Sand',
  Fog = 'Fog',
  Ash = 'Ash',
  Squall = 'Squall',
  Tornado = 'Tornado',
}

export const COEFFICIENT = 1;

export enum ConfigValueType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
}

export enum ConfigKey {
  IS_WITHDRAW = 'IS_WITHDRAW',
  PERCENT_WITHDRAW = 'PERCENT_WITHDRAW',
  WALLET_ADDRESS_ENDPOINT = 'WALLET_ADDRESS_ENDPOINT',
  VALUE_NANOTONS_TRANSACTION = 'VALUE_NANOTONS_TRANSACTION', //Toncoin in nanotons
  VALUE_NANOTONS_WIN = 'VALUE_NANOTONS_WIN',
}

export enum StatusLog {
  INACTIVE = 'INACTIVE',
  ACTIVE = 'ACTIVE',
}

export enum Services {
  API_CORE = 'core',
}
