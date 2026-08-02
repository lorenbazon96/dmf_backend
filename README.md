# DMF backend

## Pokretanje

Zahtijeva podržani Node.js LTS i MongoDB. Kopirajte `.env.example` u `.env`, postavite dva različita nasumična secreta od najmanje 32 znaka te pokrenite `npm install` i `npm start`. U produkciji je obavezan eksplicitan `CORS_ORIGIN` (lista odvojena zarezima); localhost fallback postoji samo izvan produkcije. Bearer autentikacija ostaje podržana.

Server počinje slušati tek nakon Mongo veze. `GET /health` vraća 503 dok baza nije dostupna. SIGINT/SIGTERM zatvaraju HTTP server i Mongo vezu. Upload prihvaća jedan PDF/DWG do 25 MiB; upload ostaje odvojen od spremanja projekta radi kompatibilnosti s frontendom.

## Provjera

`npm test` pokreće fokusirane testove, a `npm run check` provjerava JavaScript sintaksu.
