// Einmaliger Umzug: liest alle Daten und Fotos aus dem alten Batzis-Supabase-Projekt
// (mit dem alten Login, direkt im Browser) und legt sie im neuen gemeinsamen Projekt an.
import { CONFIG } from './config.js';
import { esc } from './util.js';

// Das alte Projekt (öffentlicher anon-Key, geschützt über Login + Row Level Security).
const OLD = {
  url: 'https://jxgrbcrixvmlpielokry.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4Z3JiY3JpeHZtbHBpZWxva3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3Nzc3NTEsImV4cCI6MjEwODM1Mzc1MX0.hk1H3hewNp8iyg9y9cMSJS21P6oQv2w1QSAcCxnnH8k',
};
const TABLES = ['profiles', 'todos', 'shopping_items', 'events', 'trackers', 'trips', 'diary_entries', 'diary_feelings', 'app_settings', 'recipes', 'orga_items', 'photos'];
const LABELS = {
  profiles: 'Profile', todos: 'ToDos', shopping_items: 'Einkauf', events: 'Termine', trackers: 'Tracker', trips: 'Reisen',
  diary_entries: 'Tagebuch', diary_feelings: 'Gefühle', app_settings: 'Einstellungen', recipes: 'Rezepte', orga_items: 'Orga', photos: 'Fotos',
};

const box = document.getElementById('box');
const head = box.innerHTML.replace('<p>Lädt …</p>', '');
const show = (html) => (box.innerHTML = head + html);

if (!CONFIG.SUPABASE_URL) {
  show('<p>Die neue Seite ist nicht mit Supabase verbunden (Demo-Modus), ein Umzug ist hier nicht möglich.</p>');
  throw new Error('demo');
}
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
const neu = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const alt = createClient(OLD.url, OLD.key, { auth: { storageKey: 'batzi-umzug-alt', persistSession: false, autoRefreshToken: false } });
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

const { data: { session } } = await neu.auth.getSession();
if (!session) {
  show('<p>Bitte melde dich zuerst auf der neuen Seite an, dann komm hierher zurück.</p><a class="btn primary" href="index.html">Zur Anmeldung</a>');
} else if (!ok(await neu.rpc('batzi_is_member'))) {
  show(`<p>Du bist als <b>${esc(session.user.email)}</b> angemeldet, aber noch nicht für die Batzi's freigeschaltet.</p>`);
} else {
  loginForm();
}

function loginForm(msg = '') {
  show(`
    <p>Melde dich mit deinem <b>alten</b> Batzis-Login an. Die Seite kopiert dann alle Daten und Fotos hierher. Im alten Projekt wird nichts gelöscht.</p>
    ${msg ? `<p class="notice">${esc(msg)}</p>` : ''}
    <form id="f" class="grid" style="display:grid;gap:12px">
      <label class="field"><span>Alte E-Mail</span><input name="email" type="email" required value="${esc(session.user.email)}"></label>
      <label class="field"><span>Altes Passwort</span><input name="password" type="password" required></label>
      <button class="btn primary">Alte Daten laden</button>
    </form>`);
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    e.target.querySelector('button').disabled = true;
    try {
      const { user } = ok(await alt.auth.signInWithPassword({ email: d.get('email'), password: d.get('password') }));
      await loadOld(user);
    } catch (err) {
      loginForm(/Invalid login/i.test(err.message) ? 'E-Mail oder Passwort stimmt nicht.' : err.message);
    }
  };
}

async function loadOld(oldUser) {
  show('<p>Lese die alten Daten …</p>');
  const data = { members: ok(await alt.from('members').select('*')) };
  for (const t of TABLES) data[t] = ok(await alt.from(t).select('*'));
  // Wer ist wer? Das eigene Profil kennen wir, bei zwei Leuten ergibt sich das andere von selbst.
  const emails = data.members.map((m) => m.email);
  const guess = (p) => {
    if (p.id === oldUser.id) return oldUser.email;
    const rest = emails.filter((e) => e.toLowerCase() !== oldUser.email.toLowerCase());
    return data.profiles.length === 2 && rest.length === 1 ? rest[0] : '';
  };
  const counts = TABLES.filter((t) => t !== 'profiles').map((t) => `${LABELS[t]}: ${data[t].length}`).join(' · ');
  show(`
    <p>Gefunden: ${esc(counts)}</p>
    <p>Wer ist wer? Jede Person braucht schon ein Konto auf der neuen Seite (dieselbe E-Mail ist am einfachsten).</p>
    <form id="m" style="display:grid;gap:10px">
      ${data.profiles.map((p) => `<label class="map-row"><span>${esc(p.emoji)} ${esc(p.display_name)}</span>
        <input name="${esc(p.id)}" type="email" required value="${esc(guess(p))}" placeholder="E-Mail auf der neuen Seite"></label>`).join('')}
      <button class="btn primary">Jetzt umziehen</button>
    </form>`);
  document.getElementById('m').onsubmit = async (e) => {
    e.preventDefault();
    const map = Object.fromEntries(new FormData(e.target));
    e.target.querySelector('button').disabled = true;
    try { await move(data, map); } catch (err) { show(`<p class="notice">Das hat nicht geklappt: ${esc(err.message)}</p><button class="btn" onclick="location.reload()">Nochmal</button>`); }
  };
}

async function move(data, emailByOldId) {
  const log = [];
  const step = (s) => { log.push(s); show(`<ol class="log">${log.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>`); };

  // Schalte zuerst alle alten Mitglieder frei, sonst findet batzi_user_ids ihre Konten nicht.
  const wanted = [...new Set(Object.values(emailByOldId).map((e) => e.toLowerCase()))];
  const members = [...new Set([...data.members.map((m) => m.email.toLowerCase()), ...wanted])];
  ok(await neu.rpc('batzi_import', { payload: { members: members.map((email) => ({ email })) } }));
  const found = ok(await neu.rpc('batzi_user_ids', { emails: wanted }));
  const idByEmail = Object.fromEntries(found.map((r) => [r.email.toLowerCase(), r.id]));
  // Wer noch kein Konto hat, bekommt seine Sachen beim ersten Öffnen der Batzi's (batzi_claim).
  const newId = {}, waiting = {};
  for (const [old, email] of Object.entries(emailByOldId)) {
    const id = idByEmail[email.toLowerCase()];
    if (id) newId[old] = id; else waiting[old] = email.toLowerCase();
  }
  step('Konten zugeordnet ✓');

  // Alte Konto-IDs stecken auch in Feldern wie "Wer?", Packlisten und Foto-Pfaden: einmal überall ersetzen.
  let json = JSON.stringify(data);
  for (const [o, n] of Object.entries(newId)) json = json.split(o).join(n);
  const payload = JSON.parse(json);
  const known = new Set(Object.values(newId));
  const owner = (t, r) => (t === 'profiles' ? r.id : r.author_id);
  const owned = ['profiles', 'diary_entries', 'diary_feelings'];
  payload.pending = Object.entries(waiting).map(([old, email]) => ({
    old_id: old,
    email,
    payload: Object.fromEntries(owned.map((t) => [t, payload[t].filter((r) => owner(t, r) === old)])),
  }));
  for (const t of TABLES) {
    if (owned.includes(t)) payload[t] = payload[t].filter((r) => known.has(owner(t, r)));
    payload[t].forEach((r) => { if (r.created_by && !known.has(r.created_by)) r.created_by = null; });
  }
  Object.values(waiting).forEach((e) => step(`${e} hat noch kein Konto: ihre Sachen warten und kommen beim ersten Anmelden automatisch dazu.`));

  // Fotos: herunterladen und unter demselben (umgeschriebenen) Pfad wieder hochladen.
  const photos = data.photos.filter((p) => !p.path.startsWith('http'));
  for (const [i, p] of photos.entries()) {
    const target = payload.photos.find((x) => x.id === p.id).path;
    const blob = ok(await alt.storage.from('photos').download(p.path));
    const { error } = await neu.storage.from('batzi-photos').upload(target, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
    if (error && !/exists|Duplicate/i.test(error.message)) throw new Error(error.message);
    if ((i + 1) % 5 === 0 || i === photos.length - 1) step(`Fotos: ${i + 1} von ${photos.length}`);
  }

  delete payload.members;
  const result = ok(await neu.rpc('batzi_import', { payload }));
  const summary = Object.entries(result).filter(([, n]) => n).map(([t, n]) => `${LABELS[t]}: ${n}`).join(' · ');
  step(`Fertig! Neu angelegt: ${summary || 'nichts (war schon alles da)'}`);
  await alt.auth.signOut();
  box.insertAdjacentHTML('beforeend', '<a class="btn primary" href="index.html">Zu den Batzi\'s</a>');
}
