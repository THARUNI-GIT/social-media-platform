import { Controller, Get, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './notification.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { EventsConsumer } from './events.consumer';
@Controller('health') class Health { @Get() ok() { return { status: 'ok' }; } }
@Module({
  imports: [MongooseModule.forRoot(process.env.MONGO_URI ?? 'mongodb://localhost:27017/notification_db'), MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }])],
  controllers: [NotificationsController, Health], providers: [NotificationsService, NotificationsGateway, EventsConsumer],
})
export class AppModule {}
