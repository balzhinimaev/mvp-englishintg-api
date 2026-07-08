# Продающий лендинг englishintg.ru

Одностраничник на корне домена (nginx `location = /` отдаёт из `/var/www/englishintg-landing/`).

- `index.html` — self-contained (инлайн CSS/JS, системные шрифты), светлая/тёмная тема
- `og.png` — OG-картинка 1200×630 (генерится `gen-og.py`, нужен Pillow + DejaVu-шрифты)
- `robots.txt`, `sitemap.xml`

## Деплой
```
sudo cp index.html og.png robots.txt sitemap.xml /var/www/englishintg-landing/
sudo gzip -9 -kf /var/www/englishintg-landing/index.html
sudo brotli -q11 -fk /var/www/englishintg-landing/index.html
```
