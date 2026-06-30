# Multiplikationsspelet

[![Support me on Patreon](https://img.shields.io/badge/Patreon-Support%20my%20work-FF424D?style=flat&logo=patreon&logoColor=white)](https://www.patreon.com/AndersBjarby)

Ett webbläsarspel där barn övar multiplikation och division genom att fånga rätt svar med händerna framför webbkameran. Svaren faller som bubblor och du "fångar" rätt svar genom att föra handen över bubblan – handspårningen sker direkt i webbläsaren med MediaPipe Hands.

## Funktioner

- **Handspårning via webbkamera** – styr spelet med händerna, ingen mus eller touch behövs
- **Multiplikation och division** – växla läge med en knapp
- **Välj tabeller** – plocka vilka tabeller (2–10) du vill träna på
- **Poäng och streaks** – stigande svårighetsgrad ju fler rätt i rad
- **Märken (badges)** – låsbara utmärkelser för streaks, poäng och avklarade tabeller, t.ex. Stjärnskott, Matteprofessorn och Perfektionisten

## Kom igång

Spelet är en statisk sajt (HTML, CSS, JavaScript) utan byggsteg. Webbkamera krävs, så sidan måste serveras över `http://localhost` eller `https`.

```bash
# Starta en lokal server i projektmappen
python3 -m http.server 8000
# Öppna sedan http://localhost:8000 i webbläsaren och tillåt kameran
```

Klicka **Starta**, välj tabeller och börja fånga svar.

## Teknik

Vanilla HTML/CSS/JavaScript, Canvas, MediaPipe Hands och Camera Utils (via CDN). Ingen backend.
