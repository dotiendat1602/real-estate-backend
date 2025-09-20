import { SetMetadata } from '@nestjs/common';
import { EventPattern, MessagePattern, Transport } from '@nestjs/microservices';

export const NatsMessagePatternWithPrefix = (pattern: string) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const prefix = `${nodeEnv.toUpperCase()}_TAP`;
    const fullPattern = `$${prefix}.${pattern}`;
    SetMetadata('pattern', fullPattern);
    MessagePattern(fullPattern, Transport.NATS)(target, key, descriptor);
  };
};

export const NatsEventPatternWithPrefix = (pattern: string) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const prefix = `${nodeEnv.toUpperCase()}_TAP`;
    const fullPattern = `$${prefix}.${pattern}`;
    SetMetadata('pattern', fullPattern);
    EventPattern(fullPattern, Transport.NATS)(target, key, descriptor);
  };
};
