// app.js — logika frontendu: Firebase + Cloudinary + UI
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

/*
  ==== Twoja konfiguracja Firebase ====
  (wklejona z Twojego wcześniejszego fragmentu)
*/
const firebaseConfig = {
  apiKey: "AIzaSyAWjSDTFk12rW1vOGXLM5HmL9mgyYjl64w",
  authDomain: "spheretube-af096.firebaseapp.com",
  projectId: "spheretube-af096",
  storageBucket: "spheretube-af096.firebasestorage.app",
  messagingSenderId: "98863701340",
  appId: "1:98863701340:web:da41ce09ad389080f83599",
  measurementId: "G-MQNLS7QYBM"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (e){ /* analytics może nie być w środowisku */ }

const db = getFirestore(app);
const auth = getAuth(app);

// Cloudinary ustawienia (tylko publiczne info)
const CLOUD_NAME = 'dmogrkbja'; // z Twojego przykładu

// UI elementy
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const userBtn = document.getElementById('userBtn');
const authLabel = document.getElementById('authLabel');
const videosGrid = document.getElementById('videosGrid');
const emptyState = document.getElementById('emptyState');

let currentUser = null;

// --- MENU HANDLERS ---
function openMenu(){
  sideMenu.classList.add('open');
  sideMenu.classList.remove('closed');
  sideMenu.setAttribute('aria-hidden','false');
  overlay.classList.remove('hidden');
}
function closeMenu(){
  sideMenu.classList.remove('open');
  sideMenu.classList.add('closed');
  sideMenu.setAttribute('aria-hidden','true');
  overlay.classList.add('hidden');
}
hamburgerBtn.addEventListener('click', () => {
  if (sideMenu.classList.contains('open')) closeMenu(); else openMenu();
});
overlay.addEventListener('click', closeMenu);

// --- AUTH UI ---
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    const name = user.displayName || user.email || (user.email ? user.email.split('@')[0] : 'User');
    authLabel.textContent = name;
    userBtn.onclick = () => { location.href = `/spheretube/account/?id=${user.uid}`; };
  } else {
    authLabel.textContent = 'SignUp / SignIn';
    userBtn.onclick = () => { location.href = '/spheretube/login/'; };
  }
});

// --- HELPERS ---

function cloudinaryImageUrl(publicId, opts = {}) {
  // Default transformations: auto format & quality, fit crop for thumbnail
  const transformations = [];
  if (opts.width) transformations.push(`w_${opts.width}`);
  if (opts.height) transformations.push(`h_${opts.height}`);
  // crop options
  if (opts.crop) transformations.push(`c_${opts.crop}`);
  if (opts.gravity) transformations.push(`g_${opts.gravity}`);
  // auto format and quality
  transformations.push('f_auto');
  transformations.push('q_auto');
  const trans = transformations.join(',');
  // Note: publicId may already include folder/extension, avoid double extension
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${trans}/${encodeURIComponent(publicId)}`;
}

function cloudinaryVideoUrl(publicId){
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${encodeURIComponent(publicId)}`;
}

function pad(n){ return n.toString().padStart(2,'0'); }

function formatDuration(seconds){
  if (seconds == null || isNaN(seconds)) return '';
  seconds = Math.floor(seconds);
  if (seconds < 60) return `${seconds}s`; // 1-59s
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${pad(secs)}`; // 1:00 - 59:59 (includes 1..9:59)
  }
  // >= 1 hour
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}:${pad(mins)}:${pad(secs)}+`; // e.g. 1:00:00+
}

// Polish plural helper for rough grammar (1, 2-4, 5+)
function plForm(n, forms){
  // forms = [one, few, many]
  n = Math.abs(n);
  if (n === 1) return forms[0];
  if (n % 10 >=2 && n % 10 <=4 && (n % 100 < 10 || n % 100 >= 20)) return forms[1];
  return forms[2];
}

function timeSince(dateLike){
  if (!dateLike) return '';
  let t;
  // Firestore Timestamp has toMillis or seconds
  if (dateLike.toMillis) {
    t = dateLike.toMillis();
  } else if (dateLike.seconds) {
    t = dateLike.seconds * 1000;
  } else {
    t = (new Date(dateLike)).getTime();
  }
  const now = Date.now();
  const diff = Math.floor((now - t) / 1000); // in seconds
  if (diff < 60) {
    const s = diff || 1;
    return `${s} ${plForm(s, ['sekundę','sekundy','sekund'])} temu`;
  }
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} ${plForm(m, ['minutę','minuty','minut'])} temu`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} ${plForm(h, ['godzinę','godziny','godzin'])} temu`;
  }
  if (diff < 2592000) {
    const d = Math.floor(diff / 86400);
    return `${d} ${plForm(d, ['dzień','dni','dni'])} temu`;
  }
  if (diff < 31536000) {
    const mo = Math.floor(diff / 2592000);
    return `${mo} ${plForm(mo, ['miesiąc','miesiące','miesięcy'])} temu`;
  }
  const y = Math.floor(diff / 31536000);
  return `${y} ${plForm(y, ['rok','lata','lat'])} temu`;
}

// --- RENDER VIDEO CARD ---
function makeVideoCard(id, data){
  const title = data.title || 'Brak tytułu';
  const description = data.description || '';
  const views = (typeof data.views === 'number') ? data.views : 0;
  const uploadedAt = data.uploadedAt || data.uploadTimestamp || data.createdAt || null;
  const duration = data.duration || data.durationSeconds || null;
  const publicId = data.cloudinary_public_id || data.publicId || data.public_id || id; // fallback to id

  const isOwner = currentUser && data.ownerUid && (currentUser.uid === data.ownerUid);

  const card = document.createElement('article');
  card.className = 'video-card';
  card.innerHTML = `
    <div class="thumb-wrap">
      <img loading="lazy" class="thumbnail" src="${cloudinaryImageUrl(publicId, {width:720, height:405, crop:'fill', gravity:'auto'})}" alt="${escapeHtml(title)}" />
      <div class="duration-badge">${formatDuration(duration)}</div>
      <button class="more-btn" title="Menu">⋯</button>
      <div class="menu-popup" aria-hidden="true">
        <!-- buttons injected below -->
      </div>
    </div>
    <div class="card-body">
      <h3 class="title" data-id="${id}">${escapeHtml(title)}</h3>
      <div class="meta">${views.toLocaleString('pl-PL')} wyświetleń • ${timeSince(uploadedAt)}</div>
      <div class="description">${escapeHtml(description)}</div>
    </div>
  `;

  // three dots menu handling
  const moreBtn = card.querySelector('.more-btn');
  const popup = card.querySelector('.menu-popup');
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = popup.classList.toggle('open');
    popup.setAttribute('aria-hidden', open ? 'false' : 'true');
  });

  // Close popup on outside click
  document.addEventListener('click', () => {
    popup.classList.remove('open');
    popup.setAttribute('aria-hidden','true');
  });

  // Build menu options
  popup.innerHTML = '';
  if (isOwner) {
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      location.href = `/spheretube/edit_video/?id=${encodeURIComponent(id)}`;
    });
    popup.appendChild(editBtn);
  } else {
    const reportBtn = document.createElement('button');
    reportBtn.textContent = 'Report';
    reportBtn.addEventListener('click', () => {
      location.href = `/spheretube/report_video/?id=${encodeURIComponent(id)}`;
    });
    popup.appendChild(reportBtn);
  }

  // Click on thumbnail or title -> watch
  card.querySelector('.thumbnail').addEventListener('click', () => {
    location.href = `/spheretube/watch?v=${encodeURIComponent(id)}`;
  });
  card.querySelector('.title').addEventListener('click', () => {
    location.href = `/spheretube/watch?v=${encodeURIComponent(id)}`;
  });

  return card;
}

// basic html escape to avoid injection
function escapeHtml(str){
  if (!str) return '';
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

// --- LOAD TOP 50 VIDEOS ---
async function loadTopVideos(){
  videosGrid.innerHTML = '';
  emptyState.classList.add('hidden');

  try {
    const videosRef = collection(db, 'video_metadata');
    const q = query(videosRef, orderBy('views','desc'), limit(50));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      emptyState.classList.remove('hidden');
      return;
    }
    snapshot.forEach(doc => {
      const data = doc.data();
      const card = makeVideoCard(doc.id, data);
      videosGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Błąd pobierania filmów:', err);
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = `<p>Wystąpił błąd podczas pobierania filmów.</p>`;
  }
}

// initial load
loadTopVideos();

// Optional: możesz odświeżyć co X sekund — ale tu zostawiam statyczne wywołanie.
// Jeśli chcesz realtime, użyj onSnapshot zamiast getDocs.
