import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const setupSwagger = (app: INestApplication): void => {
  const documentBuilder = new DocumentBuilder()
    .setTitle('API Weather')
    .setVersion('1.0')
    .addBearerAuth();

  const document = SwaggerModule.createDocument(app, documentBuilder.build());
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: -1,
    },
  });
};
