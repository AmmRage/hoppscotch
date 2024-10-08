import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import * as session from 'express-session';
import { emitGQLSchemaFile } from './gql-schema';
import { checkEnvironmentAuthProvider } from './utils';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { InfraTokensController } from './infra-token/infra-token.controller';
import { InfraTokenModule } from './infra-token/infra-token.module';
import { MyLogger } from './infra-logging/logger';

function setupSwagger(app) {
  const swaggerDocPath = '/api-docs';

  const config = new DocumentBuilder()
    .setTitle('Hoppscotch API Documentation')
    .setDescription('APIs for external integration')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        scheme: 'bearer',
        bearerFormat: 'Bearer',
      },
      'infra-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [InfraTokenModule],
  });
  SwaggerModule.setup(swaggerDocPath, app, document, {
    swaggerOptions: { persistAuthorization: true, ignoreGlobalPrefix: true },
  });
}

async function bootstrap() {
  console.log('create app');
  const app = await NestFactory.create(AppModule, {
    logger: new MyLogger(),
  });
  // const app = await NestFactory.create(AppModule);

  console.log('Getting config service');
  const configService = app.get(ConfigService);

  console.log(`Running in production:  ${configService.get('PRODUCTION')}`);
  console.log(`Port: ${configService.get('PORT')}`);

  checkEnvironmentAuthProvider(
    configService.get('INFRA.VITE_ALLOWED_AUTH_PROVIDERS') ??
      configService.get('VITE_ALLOWED_AUTH_PROVIDERS'),
  );

  app.use(
    session({
      secret: configService.get('SESSION_SECRET'),
    }),
  );

  // Increase fil upload limit to 50MB
  app.use(
    json({
      limit: '100mb',
    }),
  );

  if (configService.get('PRODUCTION') === 'false') {
    console.log('Enabling CORS with development settings');

    app.enableCors({
      origin: configService.get('WHITELISTED_ORIGINS').split(','),
      methods: [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'OPTIONS',
        'HEAD',
        'TRACE',
        'CONNECT',
        'PROPFIND',
        'PROPPATCH',
        'MKCOL',
        'COPY',
        'MOVE',
        'LOCK',
        'UNLOCK',
      ],
      credentials: true,
    });
  } else {
    console.log('Enabling CORS with production settings');

    app.enableCors({
      origin: configService.get('WHITELISTED_ORIGINS').split(','),
      methods: [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'OPTIONS',
        'HEAD',
        'TRACE',
        'CONNECT',
        'PROPFIND',
        'PROPPATCH',
        'MKCOL',
        'COPY',
        'MOVE',
        'LOCK',
        'UNLOCK',
      ],
      credentials: true,
    });
  }
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  await setupSwagger(app);

  await app.listen(configService.get('PORT') || 3170);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.info('SIGTERM signal received');
    await app.close();
  });
}

if (!process.env.GENERATE_GQL_SCHEMA) {
  console.log('Starting server');
  try {
    bootstrap().then((r) => {
      console.log('Server started');
      console.log(`Running on port ${process.env.PORT || 3170}`);
    });
  } catch (e) {
    console.error(' Error starting server', e);
  }
} else {
  console.log('Generating GQL schema');
  emitGQLSchemaFile();
}
