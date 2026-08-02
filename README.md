# DMF backend

## Pokretanje

Zahtijeva podržani Node.js LTS i MongoDB **replica set** (ili MongoDB Atlas). Transakcijske rute ne rade na standalone MongoDB instanci. Lokalno pokrenite `mongod --replSet rs0`, izvršite `rs.initiate()` te u `MONGO_URI` dodajte `?replicaSet=rs0`.

Kopirajte `.env.example` u `.env`, postavite dva različita nasumična secreta od najmanje 32 znaka i pokrenite `npm install` pa `npm start`. U produkciji postavite `CORS_ORIGIN`. Uklonite stare/nepoznate varijable iz deploy okruženja; podržane varijable navedene su u `.env.example`.

Server sluša tek nakon Mongo veze. `GET /health` vraća 503 dok baza nije dostupna. Upload prihvaća jedan PDF/DWG do 25 MiB. Cleanup periodički uklanja samo dovoljno stare upload datoteke koje nisu referencirane projektom.

## Inventory v2 migracija

Produkcijski redoslijed:

1. backup baze i upload direktorija;
2. deploy aditivnog backenda/modela;
3. `npm run migrate:inventory-v2` jednom, uz provjeru izvještaja;
4. frontend cutover tek nakon uspješne migracije.

Novi aktivni projekti rezerviraju zalihu i troše je pri startu. Migracija označava stare projekte kao `legacy-consumed`: ranije potrošene količine se pri deleteu ne vraćaju. Neizmijenjeni legacy materijali ne stvaraju stock movement; buduće razrješive promjene evidentiraju samo deltu.

## Provjera

`npm test` pokreće fokusirane testove, `npm run check` provjerava sintaksu, a `npm audit --omit=dev` produkcijske ovisnosti.
