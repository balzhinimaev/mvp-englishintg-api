import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HandbookArticle, HandbookArticleDocument } from '../common/schemas/handbook-article.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const CATEGORY_TITLES: Record<string, { ru: string; en: string }> = {
  grammar: { ru: 'Грамматика', en: 'Grammar' },
  cheatsheet: { ru: 'Шпаргалки', en: 'Cheat Sheets' },
  phrases: { ru: 'Фразы', en: 'Phrases' },
  pronunciation: { ru: 'Произношение', en: 'Pronunciation' },
};
const CATEGORY_ORDER = ['grammar', 'cheatsheet', 'phrases', 'pronunciation'];

@Controller('handbook')
@UseGuards(JwtAuthGuard)
export class HandbookController {
  constructor(
    @InjectModel(HandbookArticle.name)
    private readonly articleModel: Model<HandbookArticleDocument>,
  ) {}

  /** Список статей, сгруппированных по категориям (без тел — только карточки). */
  @Get()
  async list() {
    const articles = await this.articleModel
      .find({ published: true })
      .select('ref category title summary level icon order')
      .sort({ category: 1, order: 1 })
      .lean();

    const byCategory = new Map<string, any[]>();
    for (const a of articles) {
      const list = byCategory.get(a.category) || [];
      list.push({
        ref: a.ref,
        title: a.title,
        summary: a.summary,
        level: a.level,
        icon: a.icon,
        order: a.order,
      });
      byCategory.set(a.category, list);
    }

    const categories = CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => ({
      category: c,
      title: CATEGORY_TITLES[c],
      articles: byCategory.get(c),
    }));

    return { categories };
  }

  /** Полная статья с блоками. */
  @Get(':ref')
  async getOne(@Param('ref') ref: string) {
    const article = await this.articleModel.findOne({ ref, published: true }).lean();
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return {
      article: {
        ref: article.ref,
        category: article.category,
        title: article.title,
        summary: article.summary,
        level: article.level,
        icon: article.icon,
        blocks: article.blocks,
      },
    };
  }
}
