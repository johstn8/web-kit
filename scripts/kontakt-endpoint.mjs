/**
 * Formular-Endpoint fuer das Kontaktformular des Kits.
 *
 *   PORT=8410 MAIL_TO=... node scripts/kontakt-endpoint.mjs
 *
 * Bewusst ein eigener Endpoint statt eines Drittanbieterformulars: die
 * Nachricht verlaesst den eigenen Server nicht, es entsteht kein
 * Auftragsverarbeitungsverhaeltnis und kein Consent-Fall.
 *
 * Die oeffentliche Website bleibt statisch. nginx reicht nur /api/kontakt
 * an diesen Dienst weiter, alles andere liefert es als Datei aus.
 *
 * Der Client validiert fuer schnelle Rueckmeldung, verbindlich entscheidet
 * ausschliesslich dieser Code. Kanonisch in web-brain
 * 40-backend-security/security-baseline.md.
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT ?? 8410);
const MAIL_TO = process.env.MAIL_TO ?? '';
const MAIL_FROM = process.env.MAIL_FROM ?? MAIL_TO;
const ERFOLG = process.env.REDIRECT_OK ?? '/kontakt?gesendet=ja';
const FEHLER = process.env.REDIRECT_ERR ?? '/kontakt?fehler=ja';
const ERLAUBTE_HOSTS = (process.env.ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);

if (!MAIL_TO) {
  console.error('MAIL_TO fehlt. Ohne Empfaenger wird nichts angenommen.');
  process.exit(2);
}

/** Einfaches Ratelimit je IP. Haelt Formularspam ab, ohne Zustand ausserhalb des Prozesses. */
const FENSTER_MS = 10 * 60 * 1000;
const MAX_PRO_FENSTER = 5;
const versuche = new Map();

function zuHaeufig(ip) {
  const jetzt = Date.now();
  const liste = (versuche.get(ip) ?? []).filter((t) => jetzt - t < FENSTER_MS);
  liste.push(jetzt);
  versuche.set(ip, liste);
  if (versuche.size > 5000) versuche.clear();
  return liste.length > MAX_PRO_FENSTER;
}

/** Serverseitige Allowlist-Validierung: Typ, Laenge, Format, Pflicht. */
function pruefen(felder) {
  const fehler = [];
  const name = (felder.get('name') ?? '').trim();
  const email = (felder.get('email') ?? '').trim();
  const telefon = (felder.get('telefon') ?? '').trim();
  const nachricht = (felder.get('nachricht') ?? '').trim();
  const einwilligung = felder.get('einwilligung');

  if (name.length < 2 || name.length > 80) fehler.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) fehler.push('email');
  if (telefon && (telefon.length > 40 || !/^[\d\s+()/-]+$/.test(telefon))) fehler.push('telefon');
  if (nachricht.length < 10 || nachricht.length > 4000) fehler.push('nachricht');
  if (einwilligung !== 'ja') fehler.push('einwilligung');

  return { fehler, daten: { name, email, telefon, nachricht } };
}

function versenden({ name, email, telefon, nachricht }) {
  return new Promise((auf, ab) => {
    // Header-Injection verhindern: Zeilenumbrueche im Betreff sind der Angriffsweg.
    const betreff = `Anfrage ueber die Website von ${name}`.replace(/[\r\n]+/g, ' ');
    const koerper = [
      `Name: ${name}`,
      `E-Mail: ${email}`,
      telefon ? `Telefon: ${telefon}` : null,
      '',
      nachricht,
    ].filter((z) => z !== null).join('\n');

    const post = spawn('/usr/sbin/sendmail', ['-t', '-i'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    post.stderr.on('data', (d) => { stderr += d; });
    post.on('error', ab);
    post.on('close', (code) => (code === 0 ? auf() : ab(new Error(`sendmail ${code}: ${stderr}`))));
    post.stdin.end(
      `To: ${MAIL_TO}\nFrom: ${MAIL_FROM}\nReply-To: ${email.replace(/[\r\n]+/g, '')}\n` +
      `Subject: ${betreff}\nContent-Type: text/plain; charset=utf-8\n\n${koerper}\n`,
    );
  });
}

createServer(async (anfrage, antwort) => {
  const weiter = (ziel, status = 303) => antwort.writeHead(status, { Location: ziel }).end();

  if (anfrage.method !== 'POST' || !anfrage.url?.startsWith('/api/kontakt')) {
    antwort.writeHead(404).end('Not found');
    return;
  }

  // Origin pruefen: ohne diese Pruefung nimmt der Endpoint fremde Formulare an.
  const origin = anfrage.headers.origin;
  if (ERLAUBTE_HOSTS.length && origin) {
    try {
      if (!ERLAUBTE_HOSTS.includes(new URL(origin).host)) { weiter(FEHLER); return; }
    } catch { weiter(FEHLER); return; }
  }

  const ip = (anfrage.headers['x-forwarded-for']?.toString().split(',')[0] ?? anfrage.socket.remoteAddress ?? '').trim();
  if (zuHaeufig(ip)) { antwort.writeHead(429, { 'Retry-After': '600' }).end('Zu viele Anfragen'); return; }

  const stuecke = [];
  let laenge = 0;
  for await (const stueck of anfrage) {
    laenge += stueck.length;
    if (laenge > 64 * 1024) { antwort.writeHead(413).end('Zu gross'); return; }
    stuecke.push(stueck);
  }

  const felder = new URLSearchParams(Buffer.concat(stuecke).toString('utf8'));

  // Honeypot: ausgefuellt heisst Bot. Still verwerfen, damit er es nicht lernt.
  if ((felder.get('website') ?? '').trim()) { weiter(ERFOLG); return; }

  const { fehler, daten } = pruefen(felder);
  if (fehler.length) {
    console.error(`abgelehnt von ${ip}: ${fehler.join(', ')}`);
    weiter(FEHLER);
    return;
  }

  try {
    await versenden(daten);
    console.log(`gesendet: ${daten.email}`);
    weiter(ERFOLG);
  } catch (ausnahme) {
    console.error('Versand fehlgeschlagen:', ausnahme.message);
    weiter(FEHLER);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Kontakt-Endpoint auf 127.0.0.1:${PORT}, Empfaenger ${MAIL_TO}`);
});
