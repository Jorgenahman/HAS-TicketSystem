# Ärendehantering

Ett internt ärendehanteringssystem med dashboard, ärenden, kundregister, inloggning, mail vid tilldelning och tidsbokning via Microsoft Bookings. Byggt för att köras på en Synology NAS.

- **Server:** Python 3.8+ med endast standardbiblioteket. Inga paket behöver installeras.
- **Databas:** SQLite, i en enda fil (`data/arenden.db`).
- **Gränssnitt:** HTML, CSS och JavaScript utan ramverk (`static/`).

## Innehåll

| Fil / mapp | Vad det är |
|---|---|
| `server.py` | Webbserver, API och databaslogik |
| `static/` | Webbgränssnittet (`index.html`, `app.js`, `app.css`) |
| `Dockerfile`, `docker-compose.yml` | För installation med Synology Container Manager |
| `demo/` | Bygger en klickbar demo utan server (`python demo/build.py`) |
| `data/` | Här ligger databasen. Mappen skapas automatiskt när servern körs direkt med Python. Med Container Manager måste du skapa den själv, se installationen nedan. Mappen finns inte i Git. |

## Köra lokalt (för test och utveckling)

```bash
python server.py          # Windows: py server.py
```

Öppna sedan <http://localhost:8000>. Första gången får du skapa ett administratörskonto. Databasen skapas i `data/`.

Port och databasmapp ändras med miljövariablerna `TS_PORT` och `TS_DATA_DIR`.

## Demo utan server

```bash
python demo/build.py
```

Kommandot skapar `demo/dist/arendehantering-demo.html`. Filen kan öppnas direkt i webbläsaren och innehåller påhittade exempeldata. Logga in med `admin@demo.se` och lösenordet `demo1234`. Det du ändrar i demon sparas bara i den egna webbläsaren.

## Viktigt om GitHub

- Mappen `data/` och alla `.db`-filer är undantagna i `.gitignore`. Databasen innehåller kunduppgifter, inloggningar och lösenordet till mailkontot, så den får aldrig laddas upp.
- Inga lösenord eller nycklar finns i koden. Mailinställningarna sparas i databasen och görs i gränssnittet.
- Gör repot **privat** om det innehåller interna uppgifter.

---

# Installation på Synology NAS
|---|
| `server.py` | Servern och databaslogiken |
| `static/` | Webbgränssnittet |
| `Dockerfile`, `docker-compose.yml` | För installation med Container Manager |
| `data/` | Här ligger databasen `arenden.db`. Med Container Manager måste du skapa mappen själv (steg 2) |

---

## Alternativ A: Container Manager (rekommenderas)

Kräver DSM 7.2 eller senare och att paketet **Container Manager** finns för er NAS-modell.

1. Installera **Container Manager** i Paketcenter om det inte redan finns.
2. Öppna **File Station** och skapa mappen `docker/ticketsystem`. Ladda upp hela innehållet i den här mappen dit (`server.py`, `static`, `Dockerfile`, `docker-compose.yml`).
   **Skapa också en tom mapp som heter `data` inne i `docker/ticketsystem`.** Container Manager skapar inte mappen själv, och projektet startar då inte. Felet som visas är `bind mount failed: '/volume1/docker/ticketsystem/data' does not exist`.
3. Öppna **Container Manager → Projekt → Skapa**.
   - Projektnamn: `arendehantering`
   - Sökväg: `/docker/ticketsystem`
   - Källa: välj att använda den befintliga `docker-compose.yml`.
4. Klicka igenom guiden och starta projektet. Första gången bygger NAS:en programmet, vilket tar någon minut.
5. Öppna `http://<NAS:ens IP-adress>:8000` i webbläsaren och fortsätt under **Första inloggningen** nedan.

Servern startar automatiskt igen när NAS:en startar om.

**Uppdatera till en ny version:** ersätt `server.py` och `static` i mappen. Öppna sedan projektet i Container Manager och välj **Bygg** följt av **Starta**. Databasen i `data` påverkas inte.

## Alternativ B: Python direkt på NAS:en (utan Container Manager)

1. Installera **Python 3** i Paketcenter. Version 3.8 eller senare fungerar.
2. Skapa en delad mapp eller undermapp, till exempel `/volume1/ticketsystem`, och ladda upp `server.py` och `static` dit.
3. Öppna **Kontrollpanelen → Schemaläggaren → Skapa → Utlöst uppgift → Användardefinierat skript**.
   - Användare: `root`
   - Händelse: **Start** (när NAS:en startar)
   - Skript, under fliken Uppgiftsinställningar:
     ```
     cd /volume1/ticketsystem
     TS_PORT=8000 python3 server.py >> /volume1/ticketsystem/server.log 2>&1 &
     ```
     Om kommandot `python3` inte hittas, ersätt det med hela sökvägen. På DSM 7 är den oftast `/usr/local/bin/python3`.
4. Markera uppgiften och klicka **Kör** för att starta den direkt utan att starta om NAS:en.
5. Öppna `http://<NAS:ens IP-adress>:8000`.

---

## Första inloggningen

Den första som öppnar sidan får skapa ett **administratörskonto**. Gör det direkt efter installationen. Därefter lägger administratören till övriga användare under **Inställningar → Användare**.

- **Handläggare** kan skapa och hantera ärenden och kunder.
- **Administratörer** kan dessutom lägga till och stänga av användare samt ändra kategorier.

Kategorierna Leverans, Order, Retur, Reklamation, Övrigt och IT-support boka tid läggs in från början. Ni kan byta namn på dem, ta bort dem eller lägga till nya under Inställningar.

## Mail vid tilldelning

Handläggaren får ett mail varje gång ett ärende tilldelas hen, även när man tilldelar ärendet till sig själv. Mailet innehåller ärendets uppgifter och en länk till ärendet. Gäller ärendet tidsbokning finns även handläggarens bokningssida med.

Mailinställningarna görs under **Inställningar → E-post**. Bara administratörer ser dem. Uppgifterna får ni av IT:

| Fält | Microsoft 365 (exempel) | Intern mailserver (exempel) |
|---|---|---|
| SMTP-server | `smtp.office365.com` | t.ex. `mail.foretag.local` |
| Port | 587 | 25 |
| Kryptering | STARTTLS | Ingen |
| Användarnamn / lösenord | kontot som mailen skickas från | lämnas tomt |
| Avsändaradress | samma konto, t.ex. `it-support@foretag.se` | valfri adress som servern godkänner |
| Systemets adress | `http://nas-namn:8000` (används för länken i mailet) | samma |

Klicka **Skicka testmail till mig** för att kontrollera inställningarna. Om ett mail inte går fram visas felet under formuläret.

**Felet `CERTIFICATE_VERIFY_FAILED … self-signed certificate`** betyder att mailservern använder ett certifikat som den signerat själv. Det är vanligt på interna mailservrar. Så löser du det:

1. Välj **Certifikatkontroll → Lita på serverns certifikat**.
2. Klicka **Hämta certifikat från servern**. Jämför gärna fingeravtrycket (SHA-256) med IT.
3. Klicka **Spara** och sedan **Skicka testmail till mig**.

Efter det godkänns bara exakt det certifikatet. Byter servern certifikat måste du hämta det nya på samma sätt.

Valet **Kontrollera inte** fungerar också, men då går det inte att veta att mailen skickas till rätt server. Använd det bara tillfälligt.

Om SMTP-servern är `smtp.office365.com` ska certifikatet vara giltigt. Får du ändå felet granskar troligen en brandvägg eller ett antivirusprogram i nätverket den krypterade trafiken. Kontakta då IT.

För Microsoft 365 måste kontot ha SMTP-inloggning (SMTP AUTH) påslagen. Microsoft håller på att fasa ut inloggning med lösenord för SMTP. Fråga därför IT vilken lösning som gäller hos er, till exempel ett SMTP-relä.

## Tidsbokning (Microsoft Bookings)

- Varje handläggare lägger in länken till sin egen bokningssida under **Inställningar → Mitt konto → Min bokningssida**. En administratör kan också lägga in den åt andra under Användare.
- När ett ärende har kategorin **IT-support boka tid** visas knappen **Boka tid hos [handläggare]** i ärendet. Knappen öppnar handläggarens bokningssida i en ny flik.
- Under **Inställningar → Kategorier → Kategori för tidsbokning** väljer ni vilken kategori som visar bokningsknappen.

## Status

Ett ärende har någon av statusarna **Ny**, **Pågår**, **Klar** eller **Avslag**. Avslag betyder att ärendet inte godkändes. Både Klar och Avslag räknas som avslutade: ärendet får ett avslutsdatum och kan arkiveras. En databas från en tidigare version uppgraderas automatiskt när servern startar, och ärenden med status "Avslutad" får då status Klar.

## Säkerhetskopiering

- Hela databasen är filen `data/arenden.db`. Ta med mappen `data` i NAS:ens vanliga säkerhetskopiering, till exempel Hyper Backup.
- En administratör kan också ladda ner en färsk kopia under **Inställningar → Säkerhetskopia**.
- **Återställa:** stoppa servern, ersätt `data/arenden.db` med kopian och starta servern igen.

## Säkerhet

- Systemet kör vanlig HTTP. Det är avsett för det interna nätverket. Öppna inte porten mot internet.
- Vill ni ha HTTPS, eller nå systemet utifrån via VPN, kan ni använda NAS:ens omvända proxy: **Kontrollpanelen → Inloggningsportal → Avancerat → Omvänd proxy**. Peka den mot `localhost:8000` och använd NAS:ens certifikat.
- Användarnas lösenord sparas krypterat (PBKDF2). Lösenordet till mailkontot måste sparas i klartext i databasen för att servern ska kunna skicka mail. Skydda därför mappen `data`. Efter tio felaktiga inloggningsförsök från samma dator spärras nya försök i tio minuter.

## Byta port

Ändra `8000` till en annan port i `docker-compose.yml` (den vänstra siffran under `ports`), eller i `TS_PORT=8000` i skriptet i Schemaläggaren.

## Felsökning

| Problem | Åtgärd |
|---|---|
| `bind mount failed … /data does not exist` | Skapa en tom mapp `data` i projektmappen (`docker/ticketsystem`) med File Station och starta projektet igen. |
| Sidan laddas inte | Kontrollera att containern eller uppgiften körs. Kontrollera även att NAS:ens brandvägg släpper igenom port 8000. |
| Någon har glömt sitt lösenord | En administratör sätter ett nytt lösenord under Inställningar → Användare → Ändra. |
| Loggar behövs | Container Manager → Container → arendehantering → Logg. Vid alternativ B finns loggen i `server.log`. |
