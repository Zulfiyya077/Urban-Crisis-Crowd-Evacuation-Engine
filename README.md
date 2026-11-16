# Urban Crisis & Crowd Evacuation Engine

Bakı üçün fövqəladə təxliyə prototipi. A prototype for emergency evacuation in Baku.

Məlumat nümunəvidir: rəsmi sığınacaq reyestrini və ya canlı yol vəziyyətini əvəz etmir. The data is illustrative. It does not replace an official shelter register or live road conditions.

## Azərbaycan dili

Vətəndaş ən yaxın açıq toplanış məntəqəsini və küçə marşrutunu görür, bir düymə ilə SOS göndərir. Dispetçer paneli eyni məlumatı canlı izləyir. Eyni rayonda 5 dəqiqə içində 4 fərqli SOS, 500 metr içində 4 SOS, və ya məntəqə 95%-i keçəndə qırmızı həyəcan yaranır. Təsdiq bir əlavə briqada göndərir və yeni toplanış nöqtəsi açır.

Sistem iki moduldan ibarətdir:

- **Vətəndaş modulu**
- **Dispetçer paneli**

Hər iki səhifənin başlığında AZ / EN dil seçimi var. Seçim brauzerdə saxlanır. API eyni nisbi `/api` ünvanlarını həm lokal Express, həm də Docker-dəki nginx üzərindən verir.

### İşə salmaq

Node.js 18 və ya daha yeni versiya lazımdır.

```bash
npm install
npm start
```

Sonra brauzerdə bu ünvanları açın:

- Vətəndaş: http://localhost:3000
- Dispetçer: http://localhost:3000/operator

Dispetçer panelində briqada göndərmək və yolu dəyişmək üçün giriş lazımdır: `dispatcher` / `baki-dispetcer`. Bu, yalnız lokal nümunə üçündür. Açıq serverdən əvvəl `JWT_SECRET`, `DISPATCHER_USER` və `DISPATCHER_PASSWORD` dəyişdirilməlidir.

SOS seli bir ünvandan dəqiqədə 8, bir sessiyadan dəqiqədə 4, 10 saniyədə bütün sistemə 30 müraciətlə məhdudlaşır. Eyni sessiya eyni təhlükəni 30 saniyə içində təkrarladıqda ikinci sətir yaranmır. «Təhlükədəyəm» bu limitə düşmür: aktiv SOS-u bağlayır, düymə «Təhlükəsizəm» olur və təkrar basış yeni sətir açmır.

Dayandırmaq üçün terminalda `Ctrl+C` kifayətdir. Portu dəyişmək üçün:

```bash
PORT=4000 npm start
```

### Docker

Frontend və API ayrı konteynerdir. Brauzer yalnız veb konteynerə girir. `/api` sorğuları, o cümlədən canlı yenilənmə, API konteynerinə ötürülür.

```bash
docker compose up --build
```

- Vətəndaş: http://localhost:8080
- Dispetçer: http://localhost:8080/operator

Dayandırmaq üçün `docker compose down`.

Testlər:

```bash
npm test
```

### Qısa ssenari

1. Vətəndaş səhifəsi Nəsimi rayonu ilə açılır. 28 May metro sığınacağı 91% dolu olduğu üçün sistem alternativ marşrut təklif edir.
2. Yanğın, zəlzələ, daşqın və ya tibbi yardım düyməsi bir kliklə SOS göndərir. «Hərəkət məhdudiyyəti» seçiləndə SOS avtomatik `KLİNİK PRİORİTET · №1` olur və marşrut yalnız panduslu və ya maneəsiz, əlil arabası ilə tibbi nəqliyyatın keçdiyi yola dəyişir. Rayonda belə giriş yoxdursa, rayon mərkəzində müvəqqəti sığınacaq açılır.
3. «Təhlükədəyəm» aktiv SOS-u bağlayır və düymə «Təhlükəsizəm» olur. Yeni SOS göndərəndə düymə yenidən «Təhlükədəyəm» olur.
4. Xəritəyə klikləmək və ya «Yerimi tap» koordinatla axtarış edir. Seçilmiş rayon xəritədə dairə ilə göstərilir. Yazı yalnız rayon adıdır.
5. Dispetçer panelində eyni rayona dörd fərqli SOS düşün. Dördüncüdə qırmızı həyəcan yaranır. Mətn: «Əlavə xilasetmə briqadası göndər və yeni toplanış nöqtəsi aç».
6. «Qərarı icra et» ən yaxın hazır briqadanı göndərir və müvəqqəti toplanış məntəqəsi açır. Hazır briqada qalmayıbsa, ehtiyat briqada yaradılır. Göndərilən briqada həmin həyəcanın qeydində və Resurslar siyahısında görünür.
7. Doluluq 95%-dən yuxarı olanda ikinci həyəcan növü açılır. 95% həyəcan açmır. Vətəndaş üçün alternativ marşrut 90%-dən başlayır.
8. Bağlı yolu açın və ya başqa seqmenti bağlayın. Vətəndaş səhifəsindəki marşrut özü yenilənir.

### Marşrut mənbəyi

Hansı məntəqənin seçildiyi və bağlı yolun kənarda qalması simulyasiya olunmuş şəbəkədə həll olunur. Xəritədəki xətt həmin nöqtələrdən keçən küçə trayektoriyasıdır. Küçə xidməti 503 qaytaranda və ya 5 saniyədən çox susanda sorğu kəsilir, circuit breaker açılır və məsafə son keşdən və ya statik koordinat matrisindən davam edir. Vətəndaş «Oflayn/Ehtiyat marşrut rejimində işləyir» bildirişini görür.

```bash
curl http://localhost:3000/api/traffic
```

Düz xəttə qayıtmaq üçün:

```bash
ROUTING_PROVIDER=simulated npm start
```

## English

A citizen sees the nearest open gathering point and a street route, and sends an SOS in one tap. The dispatcher desk watches the same data live. A red alarm opens on the 4th distinct SOS in one district within 5 minutes, on 4 SOS within 500 metres, or when a shelter goes strictly above 95%. Confirming the alarm sends one extra brigade and opens a new gathering point.

The system has two modules:

- **Citizen module**
- **Dispatcher desk**

Both pages have an AZ / EN language switch in the header. The choice is stored in the browser. The same relative `/api` paths work behind local Express and behind nginx in Docker.

### Run

Node.js 18 or newer is required.

```bash
npm install
npm start
```

Then open:

- Citizen: http://localhost:3000
- Dispatcher: http://localhost:3000/operator

Dispatching a brigade or changing a road requires a sign-in: `dispatcher` / `baki-dispetcer`. This is a local demo only. Change `JWT_SECRET`, `DISPATCHER_USER`, and `DISPATCHER_PASSWORD` before any public server.

The SOS flood limit is 8 requests per minute per address, 4 per minute per session, and 30 across the system every 10 seconds. The same session repeating the same hazard within 30 seconds does not create a second row. “I am in danger” is not part of that limit: it closes the active SOS, the button becomes “I am safe”, and another press does not add a row.

Stop the process with `Ctrl+C`. To change the port:

```bash
PORT=4000 npm start
```

### Docker

The frontend and the API are separate containers. The browser talks only to the web container. `/api` requests, including live updates, are proxied to the API container.

```bash
docker compose up --build
```

- Citizen: http://localhost:8080
- Dispatcher: http://localhost:8080/operator

Stop with `docker compose down`.

Tests:

```bash
npm test
```

### Short scenario

1. The citizen page opens on Nasimi. The 28 May metro shelter is 91% full, so the system offers an alternative route.
2. Fire, earthquake, flood, or medical aid sends an SOS in one tap. With “Limited mobility” the SOS becomes `CLINICAL PRIORITY · #1` and the route uses only a ramp or barrier-free path that a wheelchair or medical vehicle can take. A district with no such entrance gets a temporary shelter at its center.
3. “I am in danger” closes the active SOS and the button becomes “I am safe”. A new SOS changes the button back to “I am in danger”.
4. Clicking the map or “Find me” searches by coordinate. The selected district is drawn as a circle. The label is only the district name.
5. Add four distinct SOS signals in the same district on the dispatcher desk. The fourth opens a red alarm. The stored sentence is: “Əlavə xilasetmə briqadası göndər və yeni toplanış nöqtəsi aç”.
6. “Carry out the decision” sends the nearest ready brigade and opens a temporary gathering point. If none is ready, a reserve brigade is created. The sent brigade is recorded on that alarm and listed under Resources.
7. Occupancy strictly above 95% opens the second alarm. 95% does not. The citizen alternative route starts at 90%.
8. Open a closed road or close another segment. The citizen route updates on its own.

### Route source

Which point is chosen, and which closed road is avoided, is decided on the simulated network. The line on the map is the street trajectory through those points. If the street service returns 503 or stays silent for more than 5 seconds, the request stops, the circuit breaker opens, and the distance continues from the last cache or the static coordinate matrix. The citizen sees “Offline/Backup route mode is on”.

```bash
curl http://localhost:3000/api/traffic
```

To stay on the simulated straight segments:

```bash
ROUTING_PROVIDER=simulated npm start
```

## Sənədlər / Docs

- [Texniki izah / Technical note](docs/texniki-izah.md)
- [Süni intellekt hesabatı / AI report](docs/ai-hesabati.md)
