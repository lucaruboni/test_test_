# Notte Rossa

Sparatutto in prima persona a round contro gli zombie, giocabile dal browser del telefono (iPhone/iPad in orizzontale) e da desktop. Gioco originale: mappa, armi e perk sono inventati.

## Come giocare su iPhone

1. Pubblica la cartella su un qualsiasi hosting statico (es. GitHub Pages: Settings → Pages → branch e cartella `/`).
2. Apri l'indirizzo in Safari, poi Condividi → **Aggiungi alla schermata Home** per averlo a schermo intero.
3. Per il controller: abbina un pad Bluetooth (PlayStation, Xbox, MFi) dalle impostazioni di iOS e premi un tasto.

In locale: `python3 -m http.server` nella cartella e apri `http://localhost:8000`.

## Contenuti

- Mappa "Stazione Nord": 5 stanze, 5 passaggi da aprire con i punti.
- Round con numero, salute e velocità degli zombie crescenti; massimo 24 zombie vivi.
- Punti per colpo e per uccisione (di più per testa e lama).
- 7 armi a muro (con ricarica munizioni a metà prezzo) e cassa misteriosa da 950 punti che si sposta tra 4 posizioni.
- 5 perk: Second Wind (ti rialzi da solo), Iron Hide (250 salute), Quick Hands (ricarica), Twin Tap (cadenza e danno), Pack Rat (terza arma).
- Lobby con arma iniziale, livelli del giocatore e delle armi, 7 accessori (max 3 per arma). Salvataggio in `localStorage`.
- Menu, caricamenti, pausa, impostazioni (sensibilità, FOV, volume, qualità, asse Y, mancini).

## Comandi

| | Touch | Controller | Tastiera |
|---|---|---|---|
| Movimento | joystick a sinistra | levetta sinistra | WASD |
| Visuale | trascina a destra | levetta destra | mouse |
| Fuoco / mira | FUOCO / MIRA | RT / LT | clic sx / dx |
| Corsa | joystick a fondo o CORSA | L3 | Shift |
| Usa / ricarica | USA / RIC. | X (RB ricarica) | F / R |
| Cambio arma / lama / salto | ARMA / LAMA / SALTO | Y / B / A | Q / V / Spazio |
| Pausa | II | Start | Esc |

## Struttura

`index.html`, `style.css`, `src/` (`data.js` dati, `game.js` motore, `input.js`, `audio.js`, `save.js`, `main.js` interfaccia), `lib/three.module.min.js` (three.js r170, MIT).
