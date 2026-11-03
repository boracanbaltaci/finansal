# Finansal

Telefonda uygulama gibi çalışan kişisel bütçe takibi (PWA). Sunucu ve hesap gerektirmez; tüm veriler telefonun içinde (localStorage) saklanır.

## Özellikler
- **Günlük limit:** Elindeki para ÷ kalan gün. Limiti aşarsan fazlası kalan günlere eşit bölünür, az harcarsan artan para kalan günlere eşit eklenir.
- **Hızlı harcama girişi:** + → tutar → kategori (ya da elle yaz, yeni kategori olur) → Kaydet.
- **Isı haritası:** Limit içindeki günler yeşil (az harcadıkça koyulaşır), aşılan günler kırmızı (aştıkça koyulaşır).
- **Analiz:** Haftalık / aylık / dönemlik halka grafik, günlük çubuk grafik, kategori dağılımı.
- **Kartlar:** Kredi kartı borçları, limit, son ödeme günü.
- **Hayal:** Araba fotoğrafı, hedef fiyat, yatırımlar ve "… kaldı" sayacı.

## Telefona kurmak
HTTPS üzerinden yayınlanması gerekir (GitHub Pages, Netlify Drop vb.). Sonra:
- **iPhone:** Safari'de aç → Paylaş → *Ana Ekrana Ekle*
- **Android:** Chrome'da aç → ⋮ → *Uygulamayı yükle*

## Bilgisayarda denemek
```
python3 -m http.server 8000
```
→ http://localhost:8000

## Güncelleme
Dosyaları değiştirince `sw.js` içindeki `VERSION` değerini artır (ör. `finansal-v2`), yoksa telefon eski sürümü önbellekten açmaya devam eder.

## Yedek
Ayarlar → *Yedek al* ile tüm veriler (araba fotoğrafı dahil) tek bir JSON dosyasına alınır; *Yedek yükle* ile geri yüklenir.
