import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DashboardService } from './src/modules/dashboard/dashboard.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dashboardService = app.get(DashboardService);
  const data = await dashboardService.getOverview('live');
  console.log(data.trend);
  await app.close();
}
bootstrap().catch(console.error);
