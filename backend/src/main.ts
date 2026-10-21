import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { ApiEnv } from './config/env';
import { ENV } from './tokens';

const app = await NestFactory.create(AppModule);
const env = app.get<ApiEnv>(ENV);

configureApp(app, { appOrigin: env.APP_ORIGIN });
// On SIGTERM/SIGINT: stop taking requests, let running jobs finish, close connections.
app.enableShutdownHooks();

await app.listen(env.PORT, '0.0.0.0');
