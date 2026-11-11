# Notte Rossa

A first-person, round-based zombie survival shooter that runs in the browser on a phone (iPhone/iPad in landscape) and on desktop. The map and perks are original; the weapons are real-world firearms.

## Playing on iPhone

1. Publish the folder on any static host (e.g. GitHub Pages: Settings → Pages → branch and `/` folder).
2. Open the address in Safari, then Share → **Add to Home Screen** to run it full screen.
3. For a controller, pair a Bluetooth pad (PlayStation, Xbox, MFi) in iOS settings and press a button.

Locally: run `python3 -m http.server` in the folder and open `http://localhost:8000`.

## What's in it

- Map "North Station": 5 rooms, 5 passages to clear with points.
- Rounds with rising zombie count, health and speed; at most 24 alive at once.
- Points per hit and per kill (more for headshots and knife kills).
- 7 wall weapons (ammo refills at half price) and a 950-point Mystery Crate that moves between 4 spots.
- 5 perks: Second Wind (self-revive), Iron Hide (250 health), Quick Hands (reload), Twin Tap (fire rate and damage), Pack Rat (third weapon).
- Lobby with starting weapon, player and weapon levels, 7 attachments (max 3 per weapon). Progress is saved in `localStorage`.
- Main menu, loading screens, pause, settings (sensitivity, FOV, volume, quality, Y axis, left-handed layout).

## Controls

| | Touch | Controller | Keyboard |
|---|---|---|---|
| Move | left stick area | left stick | WASD |
| Look | drag on the right | right stick | mouse |
| Fire / aim | FIRE / AIM | RT / LT | left / right click |
| Sprint | push stick fully or RUN | L3 | Shift |
| Use / reload | USE / RLD | X (RB reload) | F / R |
| Swap / knife / jump | SWAP / KNIFE / JUMP | Y / B / A | Q / V / Space |
| Pause | pause button | Start | Esc |

## Layout

`index.html`, `style.css`, `src/` (`data.js` data, `game.js` engine, `input.js`, `audio.js`, `save.js`, `main.js` UI), `lib/three.module.min.js` (three.js r170, MIT). Fonts (Teko, Barlow Condensed) load from Google Fonts.
