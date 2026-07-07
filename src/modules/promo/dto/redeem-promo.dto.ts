import { IsString, Matches, MaxLength } from 'class-validator';

/**
 * POST /promo/redeem — тело { promoId: "BURI79" }.
 * Имя поля promoId сохранено (текущий контракт API/клиентов).
 */
export class RedeemPromoDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]+$/i, { message: 'promoId может содержать только буквы, цифры, "_" и "-"' })
  @MaxLength(32)
  promoId!: string;
}
