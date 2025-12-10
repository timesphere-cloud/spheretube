// videos.js — pobiera listę z kolekcji "videos" i renderuje siatkę
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, startAfter, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

/* UI */
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const userBtn = document.getElementById('userBtn');
const authLabel = document.getElementById('authLabel');

const grid = document.getElementById('grid');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const subtitle = document.getElementById('subtitle');

let currentUser = null;
onAuthStateChanged(auth, (u)=> { currentUser = u; if(u){ authLabel.textContent = u.displayName || (u.email?u.email.split('@')[0]:'Account'); userBtn.onclick=()=>location.href=`/spheretube/account/?id=${u.uid}` } else { authLabel.textContent='SignUp / SignIn'; userBtn.onclick=()=>location.href='/spheretube/login/' }});

/* menu behaviour (same as other pages) */
function openMenu(){ sideMenu.classList.add('open'); sideMenu.classList.remove('closed'); sideMenu.setAttribute('aria-hidden','false'); overlay.classList.remove('hidden'); }
function closeMenu(){ sideMenu.classList.remove('open'); sideMenu.classList.add('closed'); sideMenu.setAttribute('aria-hidden','true'); overlay.classList.add('hidden'); }
hamburgerBtn.addEventListener('click', ()=> sideMenu.classList.contains('open')?closeMenu():openMenu());
overlay.addEventListener('click', closeMenu);

/* Firestore pagination */
const PAGE_SIZE = 25;
let lastVisible = null;
let loading = false;

async function fetchPage() {
  if (loading) return;
  loading = true;
  subtitle.textContent = 'Ładowanie...';

  try {
    let q;
    if (!lastVisible) {
      q = query(collection(db, 'videos'), orderBy('Video_views', 'desc'), limit(PAGE_SIZE));
    } else {
      q = query(collection(db, 'videos'), orderBy('Video_views', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
    }

    const snap = await getDocs(q);
    if (snap.empty && !lastVisible) {
      subtitle.textContent = 'Brak filmów.';
      loadMoreBtn.style.display = 'none';
      loading = false;
      return;
    }

    // render docs
    snap.forEach(docSnap => renderCard(docSnap.id, docSnap.data()));

    // update lastVisible
    lastVisible = snap.docs[snap.docs.length - 1];

    // hide load more if less than page
    if (snap.docs.length < PAGE_SIZE) {
      loadMoreBtn.style.display = 'none';
    } else {
      loadMoreBtn.style.display = '';
    }

    subtitle.textContent = 'Lista posortowana według liczby wyświetleń.';
  } catch (err) {
    console.error('fetchPage error', err);
    subtitle.textContent = 'Błąd podczas ładowania filmów.';
  } finally {
    loading = false;
  }
}

/* helpers: format duration and timeAgo */
function pad(n){ return String(n).padStart(2,'0'); }

function formatDuration(seconds){
  if (seconds == null) return '--';
  seconds = Number(seconds);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 600) {
    const m = Math.floor(seconds/60);
    const s = seconds%60;
    return `${m}:${pad(s)}`;
  }
  if (seconds < 3600) {
    const m = Math.floor(seconds/60);
    const s = seconds%60;
    return `${m}:${pad(s)}`;
  }
  // >= 3600 -> show hh:mm:ss+
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;
  return `${h}:${pad(m)}:${pad(s)}+`;
}

function timeAgo(ts){
  if (!ts) return '';
  // Firestore timestamp may be a Timestamp with toDate()
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime())/1000);
  if (diff < 60) return `${diff} sekund temu`;
  if (diff < 3600) {
    const m = Math.floor(diff/60);
    if (m === 1) return '1 minutę temu';
    if (m < 5) return `${m} minuty temu`;
    return `${m} minut temu`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff/3600);
    if (h === 1) return '1 godzinę temu';
    return `${h} godzin temu`;
  }
  const d = Math.floor(diff/86400);
  if (d === 1) return '1 dzień temu';
  return `${d} dni temu`;
}

/* render single card */
function renderCard(id, data){
  const card = document.createElement('div'); card.className = 'card';

  // thumbnail area
  const thumbWrap = document.createElement('div'); thumbWrap.className = 'thumb';
  const img = document.createElement('img');
  img.src = data.Video_image || '/spheretube/dev_img/site_icon.png';
  img.alt = data.Video_name || 'Video';
  img.addEventListener('click', ()=> location.href = `/spheretube/watch?v=${id}`);
  thumbWrap.appendChild(img);

  const dur = document.createElement('div'); dur.className = 'duration';
  dur.textContent = formatDuration(data.Video_Duration);
  thumbWrap.appendChild(dur);

  // three dots control
  const dotsBtn = document.createElement('button'); dotsBtn.className = 'dots-btn';
  dotsBtn.innerHTML = '<span class="material-symbols-outlined">more_vert</span>';
  dotsBtn.style.position = 'absolute'; dotsBtn.style.right='8px'; dotsBtn.style.top='8px';
  thumbWrap.appendChild(dotsBtn);

  // menu
  const menu = document.createElement('div'); menu.className = 'dots-menu';
  menu.style.right = '8px'; menu.style.top = '36px';
  const reportLink = document.createElement('a'); reportLink.href = `/spheretube/report_video/?id=${id}`; reportLink.textContent = 'Report';
  menu.appendChild(reportLink);

  // if owner, add edit
  if (currentUser && data.Video_Owner && currentUser.uid === data.Video_Owner) {
    const editLink = document.createElement('a'); editLink.href = `/spheretube/edit_video/?id=${id}`; editLink.textContent = 'Edit';
    menu.insertBefore(editLink, reportLink);
  }

  // show/hide menu
  dotsBtn.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const shown = menu.style.display === 'block';
    document.querySelectorAll('.dots-menu').forEach(m=>m.style.display='none');
    menu.style.display = shown ? 'none' : 'block';
  });

  document.addEventListener('click', ()=> { menu.style.display='none'; });

  thumbWrap.appendChild(menu);

  // body
  const body = document.createElement('div'); body.className = 'card-body';
  const meta = document.createElement('div'); meta.className = 'meta';
  const title = document.createElement('a'); title.className = 'title'; title.href = `/spheretube/watch?v=${id}`; title.textContent = data.Video_name || 'Untitled';
  const desc = document.createElement('div'); desc.className = 'desc'; desc.textContent = data.Video_descriprion ? (data.Video_descriprion.length>120?data.Video_descriprion.slice(0,120)+'...':data.Video_descriprion) : '';
  meta.appendChild(title);
  meta.appendChild(desc);

  const bottom = document.createElement('div'); bottom.className = 'bottom';
  const views = document.createElement('div'); views.className='views'; views.textContent = `${data.Video_views ?? 0} wyświetleń • ${timeAgo(data.createdAt) || ''}`;
  bottom.appendChild(views);
  meta.appendChild(bottom);

  body.appendChild(meta);

  card.appendChild(thumbWrap);
  card.appendChild(body);

  grid.appendChild(card);
}

/* load more */
loadMoreBtn.addEventListener('click', fetchPage);

/* initial load */
fetchPage();
