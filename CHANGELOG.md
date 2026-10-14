# Ändringslogg

## 1.5
- Nytt utseende: kompaktare sidomeny, knappen "Nytt ärende", nya KPI-kort, sökfält, filterchips och kontextuell markeringsrad i ärendelistan, ärendesida i två kolumner med kommentarer som tidslinje, tomma lägen och flikar under Inställningar.
- Beställare ligger nu som flik under Inställningar istället för i sidomenyn.
- Färgteman: Nordisk blågrå (standard), Lila, Carpe Diem · Matrix och Visual Guidelines 2025.
- Beställare kan få ett eget tema som används när beställarens kort eller ärenden öppnas. Databasen får kolumnen `customers.theme` automatiskt vid start.

## 1.4
- Gränssnittet finns på svenska och engelska. Språket väljs på inloggningssidan, i sidomenyn eller under Mitt konto.
- Mail skickas på mottagarens språk, och Excel-exporten följer det valda språket.

## 1.3
- "Kund" heter nu "Beställare" i hela systemet och i Excel-exporten.
- Bara administratörer och handläggare kan lägga till, ändra och ta bort beställare.
- Befintliga ärenden kan få kommentarer, och kommentarerna exporteras till Excel.
- Statusarna redigeras under Inställningar: namn, färg, ordning, om de är avslutade och om de är låsta.
- Avslag är låst från början. Ärendet kan inte öppnas igen, utom av en administratör.
- I ärendelistan kan flera markerade ärenden få ny status samtidigt.

## 1.2
- Mailservrar med eget eller självsignerat certifikat kan godkännas under Inställningar → E-post.

## 1.1
- Status är nu Ny, Pågår, Klar och Avslag. Gamla ärenden med status "Avslutad" byts automatiskt till Klar.
- Handläggaren får mail när ett ärende tilldelas hen. Mailservern ställs in under Inställningar → E-post.
- Varje handläggare kan ha en länk till sin Microsoft Bookings-sida. I ärenden med kategorin "IT-support boka tid" visas knappen "Boka tid".

## 1.0
- Första versionen: dashboard, ärenden, kundregister, inloggning med roller, Excel-export och säkerhetskopia.
