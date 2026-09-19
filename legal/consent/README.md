# consent/

Einbettungen, die erst nach Zustimmung laden.

## Einbinden

```astro
---
import { consentStarten } from '../../legal/consent/consent.ts';
---
<script>
  import { consentStarten } from '../../legal/consent/consent.ts';
  consentStarten();
</script>
```

## Markup je Einbettung

```html
<div data-consent="karte">
  <p>Die Karte laedt Daten von einem Drittanbieter.</p>
  <button type="button" data-consent-accept="karte">Karte laden</button>

  <template data-consent-embed="karte">
    <iframe src="https://..." title="Karte" loading="lazy"></iframe>
  </template>
</div>
```

Das `<template>` wird vom Browser nicht ausgefuehrt und laedt nichts nach,
solange es nicht in das Dokument gehoben wird. Damit ist der Platzhalter
nicht nur sichtbar, sondern auch technisch wirksam: ohne Zustimmung geht
keine Anfrage an den Drittanbieter.

## Was nicht hierher gehoert

Technisch notwendige Dinge - eigene Schriften, eigenes CSS, das
Kontaktformular auf dem eigenen Endpoint. Sie brauchen keine Zustimmung
und duerfen den Mechanismus nicht verwaessern.
