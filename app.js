import { downloadAlbum } from './album-pdf.js';

const children = [
  { id: 'mia', name: 'Mia', color: 'peach' },
  { id: 'theo', name: 'Theo', color: 'mint' },
  { id: 'nora', name: 'Nora', color: 'lilac' },
  { id: 'leo', name: 'Leo', color: 'yellow' },
  { id: 'amira', name: 'Amira', color: 'blue' },
  { id: 'finn', name: 'Finn', color: 'rose' },
];
const familyChildren = children.filter(({ id }) => id === 'mia' || id === 'theo');
const demoPhotos = ['garden', 'clay', 'forest', 'sunshine', 'butterfly'];
const sampleArtwork = [
  {
    id: 'forest', sessionId: 'demo-waldwerkstatt', title: 'Waldwerkstatt', date: '2026-10-29',
    note: 'Nach dem Waldspaziergang hat Mia die Bäume gemalt. „Der kleine Baum wächst noch!“',
    image: './art/forest.svg', alt: 'Gemalte Bäume auf blauem Papier',
  },
  {
    id: 'clay', sessionId: 'demo-waldwerkstatt', title: 'Waldwerkstatt', date: '2026-10-29',
    note: 'Mia hat ein Blatt vom Spaziergang in weichen Ton gedrückt.',
    image: './art/clay.svg', alt: 'Blattabdruck in terrakottafarbenem Ton',
  },
  {
    id: 'butterfly', title: 'Der Papierschmetterling', date: '2026-10-28',
    note: 'Mia hat die Farben ausgesucht und die Teile für die Flügel ausgeschnitten.',
    image: './art/butterfly.svg', alt: 'Schmetterling mit rosa, gelben und lilafarbenen Papierflügeln',
  },
  {
    id: 'sunshine', title: 'Eine Handvoll Sonnenschein', date: '2026-10-13',
    note: 'Mit unseren Händen haben wir die Strahlen einer kleinen gelben Sonne gestempelt.',
    image: './art/sunshine.svg', alt: 'Sonne mit gelben und orangefarbenen Handabdrücken',
  },
];

const art = [
  ...sampleArtwork.map((piece) => ({ ...piece, childId: 'mia' })),
  {
    id: 'garden', childId: 'theo', title: 'Ein Garten aus Papier', date: '2026-10-26',
    note: 'Theo hat Blumen aus buntem Papier gebastelt.',
    image: './art/garden.svg', alt: 'Drei bunte Blumen aus Papier',
  },
];
let nextPhotoId = 0;
let activeSession = null;
let familyChild = familyChildren[0];
const byId = (id) => document.getElementById(id);
const parentTab = byId('parent-tab');
const staffTab = byId('staff-tab');
const albumDialog = byId('album-dialog');
const detailDialog = byId('detail-dialog');
const staffGalleryDialog = byId('staff-gallery-dialog');
const familySwitch = byId('family-children');
const themeInput = byId('group-theme');
const captureInput = byId('capture-input');
const captureDialog = byId('capture-dialog');
const albumForm = byId('album-form');
const albumList = byId('album-list');
const downloadButton = byId('download');
const status = byId('status');
const dateFormatter = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'UTC' });

let captureRequest = null;
let reviewedPhoto = null;
let staffGalleryChild = null;
let removablePiece = null;
let preparingAlbum = false;
let statusTimer;

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  return svg;
}

function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content) element.textContent = content;
  return element;
}

function image(piece, alt = piece.alt) {
  const img = node('img');
  img.src = piece.image;
  img.alt = alt;
  return img;
}

function showView(isStaff) {
  parentTab.setAttribute('aria-pressed', String(!isStaff));
  staffTab.setAttribute('aria-pressed', String(isStaff));
  byId('parent-view').hidden = isStaff;
  byId('staff-view').hidden = !isStaff;
  if (isStaff) {
    updateRoster();
  } else {
    captureRequest = null;
  }
  window.scrollTo(0, 0);
}

function formatDate(date) {
  return dateFormatter.format(new Date(date + 'T12:00:00Z'));
}

function localDate() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function setError(id, message = '') {
  const element = byId(id);
  element.textContent = message;
  element.hidden = !message;
}

function notify(message) {
  clearTimeout(statusTimer);
  status.hidden = false;
  status.textContent = message;
  statusTimer = setTimeout(() => {
    status.hidden = true;
    status.textContent = '';
  }, 5500);
}

function showDetails(piece, staff) {
  removablePiece = staff ? piece : null;
  byId('detail-actions').hidden = !removablePiece;
  byId('remove-review').hidden = true;
  byId('detail-title').textContent = piece.title;
  byId('detail-date').textContent = formatDate(piece.date);
  byId('detail-image').src = piece.image;
  byId('detail-image').alt = piece.alt;
  byId('detail-note').textContent = piece.note;
  byId('detail-note').hidden = !piece.note;
  detailDialog.showModal();
}

function makeCard(piece, staff, photoNumber) {
  const card = node('article', 'art-card');
  const open = node('button', 'art-open');
  const artImage = node('span', 'art-image');
  const copy = node('span', 'art-copy');
  const arrow = node('span', 'art-arrow');

  const label = photoNumber ? 'Foto ' + photoNumber : piece.title;
  open.type = 'button';
  open.setAttribute('aria-label', label + ' ansehen');
  open.addEventListener('click', () => showDetails(piece, staff));
  artImage.append(image(piece));
  arrow.append(icon('arrow'));
  if (!photoNumber) copy.append(node('span', 'art-meta', formatDate(piece.date)));
  copy.append(arrow, node('span', 'art-title', label));
  if (piece.note) copy.append(node('span', 'art-note', piece.note));
  open.append(artImage, copy);
  card.append(open);
  return card;
}

function childArtwork(child) {
  return art.filter((piece) => piece.childId === child.id);
}

function familyArtwork() {
  return childArtwork(familyChild);
}

function renderArtwork(gallery, pieces, emptyMessage, staff = false) {
  if (!pieces.length) {
    gallery.replaceChildren(node('p', 'empty-gallery', emptyMessage));
    return;
  }

  const sessions = new Map();
  for (const piece of pieces) {
    const key = piece.sessionId ?? piece.id;
    if (!sessions.has(key)) sessions.set(key, []);
    sessions.get(key).push(piece);
  }

  const entries = Array.from(sessions.values(), (photos) => {
    const first = photos[0];
    if (photos.length === 1) return makeCard(first, staff);

    const session = node('section', 'art-session');
    const heading = node('header', 'art-session-head');
    heading.append(
      node('h3', '', first.title),
      node('p', '', formatDate(first.date) + ' · ' + photos.length + ' Fotos'),
    );
    const grid = node('div', 'art-grid');
    grid.append(...photos.map((piece, index) => makeCard(piece, staff, index + 1)));
    session.append(heading, grid);
    return session;
  });
  gallery.replaceChildren(...entries);
}

function renderStaffGallery() {
  const name = staffGalleryChild.name;
  byId('staff-gallery-title').textContent = 'Galerie von ' + name;
  renderArtwork(
    byId('staff-gallery'),
    childArtwork(staffGalleryChild),
    'Für ' + name + ' sind noch keine Fotos gespeichert.',
    true,
  );
}

function openStaffGallery(child) {
  captureRequest = null;
  staffGalleryChild = child;
  renderStaffGallery();
  staffGalleryDialog.showModal();
  staffGalleryDialog.scrollTop = 0;
}

function confirmPhotoRemoval() {
  if (!removablePiece || byId('remove-review').hidden || !staffGalleryDialog.open) return;
  const index = art.indexOf(removablePiece);
  if (index === -1 || removablePiece.childId !== staffGalleryChild.id) return;
  const [removed] = art.splice(index, 1);
  removablePiece = null;
  detailDialog.close();
  updateRoster();
  renderStaffGallery();
  if (removed.childId === familyChild.id) renderGallery();
  byId('staff-gallery-title').focus();
  byId('staff-gallery-status').textContent = 'Foto entfernt.';
}

function renderGallery() {
  const pieces = familyArtwork();
  const name = familyChild.name;
  for (const button of familySwitch.children) {
    button.setAttribute('aria-pressed', String(button.dataset.childId === familyChild.id));
  }
  byId('hero-child').textContent = name;
  byId('collection-title').textContent = name + 's kleine Galerie';
  byId('collection-count').textContent = pieces.length === 1
    ? '1 Kunstwerk · Große Strolche'
    : pieces.length + ' Kunstwerke · Große Strolche';
  renderArtwork(byId('gallery'), pieces, 'Hier erscheinen die Kunstwerke von ' + name + '.');
  byId('make-album').disabled = !pieces.length;
}

function selectFamilyChild(child) {
  if (familyChild !== child) byId('album-name').value = child.name + 's kleine Kunstwerke';
  familyChild = child;
  renderGallery();
}

function makePlaque(child) {
  const plaque = node('button', 'child-plaque');
  const avatar = node('span', 'child-avatar child-avatar--' + child.color, child.name[0]);
  const details = node('span', 'child-details');
  const count = node('small');
  count.id = 'photo-count-' + child.id;
  plaque.type = 'button';
  plaque.dataset.childId = child.id;
  plaque.setAttribute('aria-label', 'Galerie von ' + child.name + ' öffnen');
  plaque.setAttribute('aria-describedby', count.id);
  avatar.setAttribute('aria-hidden', 'true');
  details.append(node('strong', '', child.name), count);
  plaque.append(avatar, details);
  plaque.addEventListener('click', () => openStaffGallery(child));

  const camera = node('button', 'button child-camera');
  camera.type = 'button';
  camera.setAttribute('aria-label', 'Foto für ' + child.name + ' aufnehmen');
  camera.append(icon('camera'), document.createTextNode('Foto'));
  camera.addEventListener('click', () => beginCapture(child));

  const row = node('div', 'child-row');
  row.append(plaque, camera);
  return row;
}

function updateRoster() {
  const today = localDate();
  byId('activity-date').dateTime = today;
  byId('activity-date').textContent = formatDate(today);
  for (const plaque of byId('child-list').querySelectorAll('.child-plaque')) {
    const count = art.filter((piece) => piece.childId === plaque.dataset.childId && piece.date === today).length;
    plaque.querySelector('small').textContent = count === 1 ? 'Heute 1 Foto' : 'Heute ' + count + ' Fotos';
  }
}

function beginCapture(child, note = '') {
  const theme = themeInput.value.trim();
  setError('capture-error');
  if (!theme) {
    setError('capture-error', 'Gib zuerst das Gruppenthema ein.');
    themeInput.focus();
    return;
  }

  const date = localDate();
  const session = activeSession?.theme === theme && activeSession.date === date
    ? activeSession
    : { id: 'session-' + nextPhotoId, theme, date };
  captureRequest = { child, session, note };
  reviewedPhoto = null;
  if (byId('sample-mode').checked) {
    const sample = demoPhotos[nextPhotoId % demoPhotos.length];
    showPhotoPreview(captureRequest, './art/' + sample + '.svg');
    return;
  }

  // Opening the native picker in the tap handler keeps the browser's user activation.
  captureInput.value = '';
  captureInput.click();
}

async function preparePhoto(file) {
  if (file.type && !file.type.startsWith('image/')) throw new Error('Wähle eine Bilddatei aus, zum Beispiel JPG oder PNG.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Wähle ein Foto unter 20 MB aus.');

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('Das Foto konnte nicht geöffnet werden. Versuche es mit JPG oder PNG.');
    }
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function selectPhoto(file) {
  const request = captureRequest;
  if (!file || !request) return;
  try {
    const source = await preparePhoto(file);
    if (request === captureRequest) showPhotoPreview(request, source);
  } catch (error) {
    if (request === captureRequest) {
      captureRequest = null;
      setError('capture-error', error.message || 'Versuche, ein neues Foto aufzunehmen.');
    }
  }
}

function showPhotoPreview(request, source) {
  captureRequest = null;
  reviewedPhoto = { ...request, source };
  byId('capture-kicker').textContent = 'Fotovorschau';
  byId('capture-title').textContent = 'Foto für ' + request.child.name;
  byId('capture-theme').textContent = request.session.theme;
  byId('capture-date').dateTime = request.session.date;
  byId('capture-date').textContent = formatDate(request.session.date);
  byId('capture-image').src = source;
  byId('capture-comment').value = request.note;
  byId('capture-review').hidden = false;
  byId('capture-saved').hidden = true;
  captureDialog.showModal();
  byId('save-photo').focus();
}

function savePhoto() {
  if (!reviewedPhoto || byId('capture-review').hidden) return;
  const { child, session, source } = reviewedPhoto;
  const { theme, date } = session;
  activeSession = session;
  byId('new-session').disabled = false;
  art.unshift({
    id: 'demo-' + nextPhotoId++,
    sessionId: session.id,
    childId: child.id,
    title: theme,
    date,
    note: byId('capture-comment').value.trim(),
    image: source,
    alt: 'Foto zum Thema ' + theme,
  });
  updateRoster();
  if (child.id === familyChild.id) renderGallery();

  byId('capture-kicker').textContent = 'Foto gespeichert';
  byId('capture-title').textContent = 'Für ' + child.name + ' gespeichert';
  byId('capture-confirmation').textContent = 'Das Foto wurde für ' + child.name + ' gespeichert.';
  byId('capture-review').hidden = true;
  byId('capture-saved').hidden = false;
  byId('take-another').focus();
}

function repeatCapture(keepComment) {
  const child = reviewedPhoto?.child;
  if (!child) return;
  const note = keepComment ? byId('capture-comment').value : '';
  captureDialog.close();
  beginCapture(child, note);
}

function makeAlbumChoice(piece) {
  const label = node('label', 'album-choice');
  const check = node('input');
  check.type = 'checkbox';
  check.value = piece.id;
  check.checked = true;
  const copy = node('span');
  copy.append(node('strong', '', piece.title), node('small', '', formatDate(piece.date)));
  label.append(check, image(piece, ''), copy);
  return label;
}

function selectedPieces() {
  const ids = new Set(Array.from(albumList.querySelectorAll('input:checked'), (input) => input.value));
  return familyArtwork().filter((piece) => ids.has(piece.id));
}

function updateAlbumSummary() {
  const count = selectedPieces().length;
  const label = count === 1 ? 'Kunstwerk' : 'Kunstwerke';
  byId('album-summary').textContent = count ? count + ' ' + label + ' + Titelseite' : 'Wähle mindestens ein Kunstwerk aus.';
  downloadButton.disabled = !count || preparingAlbum;
}

function openAlbum() {
  albumList.replaceChildren(...familyArtwork().map(makeAlbumChoice));
  setError('album-error');
  updateAlbumSummary();
  albumDialog.showModal();
}

async function submitAlbum(event) {
  event.preventDefault();
  if (preparingAlbum) return;
  setError('album-error');
  const title = byId('album-name').value.trim();
  if (!title) {
    setError('album-error', 'Gib deinem Album einen Titel.');
    byId('album-name').focus();
    return;
  }
  const artwork = selectedPieces();
  if (!artwork.length) return;
  preparingAlbum = true;
  updateAlbumSummary();
  byId('download-label').textContent = 'PDF wird erstellt …';
  try {
    await downloadAlbum({ title, childName: familyChild.name, artwork });
    albumDialog.close();
    notify('Dein Album ist als PDF fertig.');
  } catch {
    setError('album-error', 'Das Album konnte nicht erstellt werden. Versuche es noch einmal.');
  } finally {
    preparingAlbum = false;
    byId('download-label').textContent = 'PDF herunterladen';
    updateAlbumSummary();
  }
}

parentTab.addEventListener('click', () => showView(false));
staffTab.addEventListener('click', () => showView(true));
byId('make-album').addEventListener('click', openAlbum);
byId('new-session').addEventListener('click', () => {
  activeSession = null;
  captureRequest = null;
  byId('new-session').disabled = true;
  themeInput.value = '';
  themeInput.focus();
  setError('capture-error');
});
byId('detail-remove').addEventListener('click', () => {
  byId('detail-actions').hidden = true;
  byId('remove-review').hidden = false;
  byId('remove-cancel').focus();
});
byId('remove-cancel').addEventListener('click', () => {
  byId('remove-review').hidden = true;
  byId('detail-actions').hidden = false;
  byId('detail-remove').focus();
});
byId('remove-confirm').addEventListener('click', confirmPhotoRemoval);
staffGalleryDialog.addEventListener('close', () => {
  byId('staff-gallery-status').textContent = '';
});
themeInput.addEventListener('input', () => setError('capture-error'));
themeInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing) themeInput.blur();
});
captureInput.addEventListener('change', () => selectPhoto(captureInput.files[0]));
byId('retake').addEventListener('click', () => repeatCapture(true));
byId('save-photo').addEventListener('click', savePhoto);
byId('take-another').addEventListener('click', () => repeatCapture(false));
byId('next-child').addEventListener('click', () => captureDialog.close());
captureDialog.addEventListener('close', () => {
  if (!captureDialog.open) {
    reviewedPhoto = null;
    byId('capture-image').removeAttribute('src');
  }
});
albumForm.addEventListener('submit', submitAlbum);
albumList.addEventListener('change', updateAlbumSummary);

for (const dialog of [albumDialog, detailDialog, captureDialog, staffGalleryDialog]) {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
}

for (const child of familyChildren) {
  const button = node('button', 'family-child-button', child.name);
  button.type = 'button';
  button.dataset.childId = child.id;
  button.setAttribute('aria-controls', 'gallery');
  button.addEventListener('click', () => selectFamilyChild(child));
  familySwitch.append(button);
}
byId('child-list').replaceChildren(...children.map(makePlaque));
updateRoster();
renderGallery();
