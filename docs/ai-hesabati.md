# Süni intellektdən istifadə hesabatı

Bu prototip Cursor mühitində süni intellekt kod köməkçisi ilə hazırlanıb. Model: Grok 4.7. Tapşırığın mətni, modul sərhədləri və qəbul şərtləri istifadəçi tərəfindən verilib. Arxitektura, kod, test, veb səhifə və bu sənədlər həmin şərtlərə uyğun olaraq model tərəfindən yazılıb.

## Harada istifadə olundu

- Modul sərhədinin seçimi: vətəndaş API-si, dispetçer API-si, təxliyə planı, böhran qaydaları və yol provayderi ayrı fayllardadır.
- Bakı nümunəsinin qurulması: rayon mərkəzləri, məntəqə növləri, yol seqmentləri və ilkin briqadalar.
- Qayda məntiqi: 90% alternativ marşrut, 95%-i keçən doluluq həyəcanı, 5 dəqiqədə 4 SOS, 500 metr radiusu.
- Vətəndaş səhifəsi və dispetçer panelinin interfeysi.
- Avtomat testlər və işəsalma təlimatı.

Model şəhərin rəsmi sığınacaq siyahısına və ya canlı nəqliyyat axınına çıxışla qərar verməyib. Koordinatlar təxmini xəritə nöqtələridir.

## Modelin verdiyi qərarlar

Tapşırıq bəzi hədləri dəqiq yazır, bəzilərini isə sərbəst buraxır. Kodda sabitlənən oxunuşlar bunlardır:

- “90% dolduqda” alternativ marşrut üçün `>= 90` götürülüb.
- “95%-i keçərsə” operator həyəcanı üçün göstərilən faiz `> 95` götürülüb. 95.0 həyəcan açmır.
- “4 fərqli SOS” dörd ayrı siqnal yazısıdır. Eyni cihaz fərqli növlər göndərə bilər. “Təhlükəsizdəyəm” və check-in sayılmır.
- 500 metr şərti rayon şərtini təkrarlamır: siqnallar artıq bir rayon həyəcanına düşübsə, eyni dəstə üçün ikinci həyəcan açılmır. Radius həyəcanı rayon sərhədini keçən topa üçündür.
- Həyəcan operator təsdiqləyənə qədər açıq qalır. Eyni sübutlarla təkrar həyəcan yaradılmır.
- “Qərarı icra et” həm briqada göndərir, həm də yeni məntəqə açır. Əvvəl hazır briqada seçilir; heç biri hazır deyilsə, ehtiyat briqada yaradılır.
- Xarici marşrut API-si 503 qaytaranda və ya 5 saniyədən çox susanda sorğu kəsilir. Circuit breaker açılır, məsafə son keşdən və ya statik koordinat matrisindən hesablanır və vətəndaşa «Oflayn/Ehtiyat marşrut rejimində işləyir» bildirişi göstərilir.

Bu oxunuşlar `test/engine.test.js` içində yoxlanılır. Test keçməyibsə, qayda qəbul edilmiş sayılmır.

## Yoxlama

`npm test` böhran hədlərini, bağlı yolun marşrutu dəyişməsini, briqada və müvəqqəti məntəqənin yaradılmasını və HTTP sərhədini yoxlayır. Veb səhifələr ayrıca brauzerdə açılıb: vətəndaşın alternativ marşrutu, SOS və “Təhlükəsizdəyəm”, dispetçerdə dörd SOS-dan sonra qırmızı həyəcan, qərarın icrası və 96% doluluq həyəcanı.

Süni intellekt bu yoxlamaları özü yazıb və işlədib. Bu, müstəqil ekspert rəyi deyil.

## Məhdudiyyət və məsuliyyət

Model yanlış koordinat, natamam yol qrafı və ya Azərbaycan dilində yöndəmsiz ifadə yaza bilər. Testlər rəqəm qaydalarını saxlayır, amma nümunə məlumatını rəsmi mənbəyə çevirə bilməz.

Sistem fövqəladə hal əməliyyatı üçün hazır məhsul deyil. Real dispetçer istifadəsindən əvvəl insan rəyi, rəsmi coğrafi məlumat, autentifikasiya, davamlı yaddaş və məsul qurumun qəbulu lazımdır. Süni intellektin çıxışı bu qəbulu əvəz etmir.
