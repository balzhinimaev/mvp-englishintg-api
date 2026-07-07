import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HandbookController } from './handbook.controller';
import { AuthModule } from '../auth/auth.module';
import { HandbookArticle, HandbookArticleSchema } from '../common/schemas/handbook-article.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: HandbookArticle.name, schema: HandbookArticleSchema },
    ]),
  ],
  controllers: [HandbookController],
})
export class HandbookModule {}
