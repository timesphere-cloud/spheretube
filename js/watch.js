// watch.js — watch page: loads video metadata, plays video, likes, subscribe, recommended
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, query, orderBy, limit, getDocs,
  setDoc, deleteDoc, increment, updateDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAWjSDTFk12rW1vOGXLM5HmL9mgyYjl64w",
  authDomain: "spheretube-af096.firebaseapp.com",
  projectId: "spheretube-af096",
  storageBucket: "spheretube-af096.firebasestorage.app",
  messagingSenderId: "98863701340",
  appId: "1:98863701340:web:da41ce09ad389080f83599",
  measurementId: "G-MQNLS7QYBM"
};
initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

/* UI refs */
const mainVideo = document.getElementById('mainVideo');
const playBtn = document.getElementById('playBtn');
const seekBar = document.getElementById('seekBar');
const timeDisplay = document.getElementById('timeDisplay');
const volumeBar = document.getElementById('volumeBar');
const fsBtn = document.getElementById('fsBtn');
const settingsBtn = document.getElementById('settingsBtn');

const videoTitle = document.getElementById('videoTitle');
const descText = document.getElementById('descText');
const toggleDesc = document.getElementById('toggleDesc');
const viewsText = document.getElementById('viewsText');
const publishDate = document.getElementById('publishDate');
const likeBtn = document.getElementById('likeBtn');
const likeCountEl = document.getElementById('likeCount');

const channelAvatar = document.getElementById('channelAvatar');
const channelName = document.getElementById('channelName');
const channelMeta = document.getElementById('channelMeta');
const channelActions = document.getElementById('channelActions');

const recommendedList = document.getElementById('recommendedList');

const hamburgerBtn = document.getElementById('hamburgerBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const userBtn = document.getElementById('userBtn');
const authLabel = document.getElementById('authLabel');

/* menu/auth same behavior */
function openMenu(){ sideMenu.classList.add('open'); sideMenu.classList.remove('closed'); sideMenu.setAttribute('aria-hidden','false'); overlay.classList.remove('hidden'); }
function closeMenu(){ sideMenu.classList.remove('open'); sideMenu.classList.add('closed'); sideMenu.setAttribute('aria-hidden','true'); overlay.classList.add('hidden'); }
hamburgerBtn.addEventListener('click', ()=> sideMenu.classList.contains('open')?closeMenu():openMenu());
overlay.addEventListener('click', closeMenu);

let currentUser = null;
onAuthStateChanged(auth, (u) => {
  currentUser = u;
  if (u) {
    authLabel.textContent = u.displayName || (u.email?u.email.split('@')[0]:'Account');
    userBtn.onclick = ()=> location.href = `/spheretube/account/?id=${u.uid}`;
  } else {
    authLabel.textContent = 'SignUp / SignIn';
    userBtn.onclick = ()=> location.href = '/spheretube/login/';
  }
});

/* helper format */
function pad(n){ return String(n).padStart(2,'0'); }
function formatDuration(seconds){
  if (seconds == null) return '--';
  seconds = Number(seconds);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds/60);
    const s = seconds%60;
    return `${m}:${pad(s)}`;
  }
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;
  return `${h}:${pad(m)}:${pad(s)}`;
}
function formatDatePolish(ts){
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const months = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* get query param v */
function getVideoId(){
  const params = new URLSearchParams(location.search);
  return params.get('v');
}

/* load video metadata from Firestore and populate UI */
let videoId = getVideoId();
if (!videoId) {
  videoTitle.textContent = 'Brak wideo';
  descText.textContent = '';
  viewsText.textContent = '';
  publishDate.textContent = '';
  // nothing else
} else {
  loadVideo(videoId);
  loadRecommended(videoId);
}

async function loadVideo(id){
  try {
    const vref = doc(db, 'videos', id);
    const snap = await getDoc(vref);
    if (!snap.exists()) {
      videoTitle.textContent = 'Wideo nie znalezione';
      return;
    }
    const data = snap.data();

    // set video src
    // oczekujemy pole Video (uploads_info.Video) lub Video_image etc.
    // Prefer field 'Video' in uploads_info only; here videos collection may have URL in Video_image? we used Video_image for thumbnail and saved secure_url as Videos.Video in uploads_info earlier.
    // We assume your /videos doc has a 'Video_image' (thumb) and uploads_info stored 'Video' in uploads_info. To keep simple, we try `data.Video` then fallback to `data.Video_image` for poster-only.
    const videoUrl = data.Video || data.video || null;
    // if videoUrl missing, try fetch uploads_info doc with same id
    let finalVideoUrl = videoUrl;
    if (!finalVideoUrl) {
      try {
        const upRef = doc(db, 'uploads_info', id);
        const upSnap = await getDoc(upRef);
        if (upSnap.exists()) finalVideoUrl = upSnap.data().Video || upSnap.data().video || null;
      } catch(e){}
    }

    if (finalVideoUrl) {
      mainVideo.src = finalVideoUrl;
    } else {
      // nothing to play
      mainVideo.poster = data.Video_image || '/spheretube/dev_img/site_icon.png';
    }

    // set poster (thumbnail)
    if (data.Video_image) {
      mainVideo.poster = data.Video_image;
    }

    // UI texts
    videoTitle.textContent = data.Video_name || 'Untitled';
    descText.textContent = data.Video_descriprion || '';
    viewsText.textContent = `${data.Video_views ?? 0} wyświetleń`;
    publishDate.textContent = formatDatePolish(data.createdAt);

    likeCountEl.textContent = data.Video_likes ?? 0;

    // channel info
    const owner = data.Video_Owner || null;
    if (owner) {
      try {
        const userRef = doc(db,'user_data', owner);
        const userSnap = await getDoc(userRef);
        const u = userSnap.exists() ? userSnap.data() : null;
        channelName.textContent = u?.username || (u?.email?u.email.split('@')[0]:'Channel');
        channelAvatar.textContent = (u?.username? u.username[0].toUpperCase() : (channelName.textContent[0]||'C'));
        channelMeta.textContent = `${/* placeholder */ ''}`;
      } catch(e){}
    }

    // owner actions
    if (currentUser && owner && currentUser.uid === owner) {
      channelActions.innerHTML = '';
      const editChan = document.createElement('button'); editChan.className='edit-btn'; editChan.textContent='Edit channel';
      editChan.onclick = ()=> location.href = `/spheretube/edit_channel/?id=${owner}`;
      const editVid = document.createElement('button'); editVid.className='edit-btn'; editVid.textContent='Edit video';
      editVid.onclick = ()=> location.href = `/spheretube/edit_video/?id=${videoId}`;
      channelActions.appendChild(editChan);
      channelActions.appendChild(editVid);
    } else {
      // subscribe button
      renderSubscribeButton(owner);
    }

    // likes state
    await updateLikeState();

    // increment view count (one simple increment per page load)
    try {
      await runTransaction(db, async (tx) => {
        const v = await tx.get(vref);
        if (!v.exists()) return;
        tx.update(vref, { Video_views: (v.data().Video_views ?? 0) + 1 });
      });
      // update displayed views
      const newSnap = await getDoc(vref);
      viewsText.textContent = `${newSnap.data().Video_views ?? 0} wyświetleń`;
    } catch(e){ console.warn('view increment failed', e); }

  } catch (err) {
    console.error('loadVideo error', err);
  }
}

/* Video player controls logic */
playBtn.addEventListener('click', ()=> {
  if (mainVideo.paused) mainVideo.play(); else mainVideo.pause();
});
mainVideo.addEventListener('play', ()=> playBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>');
mainVideo.addEventListener('pause', ()=> playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>');
mainVideo.addEventListener('timeupdate', ()=> {
  const cur = mainVideo.currentTime;
  const dur = mainVideo.duration || 0;
  const pct = dur ? (cur/dur)*100 : 0;
  seekBar.value = pct;
  timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
});
seekBar.addEventListener('input', ()=> {
  const dur = mainVideo.duration || 0;
  const pct = Number(seekBar.value)/100;
  mainVideo.currentTime = dur * pct;
});
volumeBar.addEventListener('input', ()=> { mainVideo.volume = Number(volumeBar.value); });

fsBtn.addEventListener('click', ()=> {
  if (!document.fullscreenElement) {
    mainVideo.requestFullscreen().catch(()=>{});
  } else {
    document.exitFullscreen().catch(()=>{});
  }
});
settingsBtn.addEventListener('click', ()=> {
  // simple menu stub: currently only show resolution if available
  alert('Settings: wybierz rozdzielczość (jeśli dostępna).');
});

function formatTime(sec){
  if (!sec || isNaN(sec)) return '0:00';
  sec = Math.floor(sec);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${m}:${pad(s)}`;
  }
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  return `${h}:${pad(m)}:${pad(s)}`;
}

/* description toggle */
let descCollapsed = true;
toggleDesc.addEventListener('click', ()=> {
  descCollapsed = !descCollapsed;
  if (descCollapsed) {
    descText.classList.add('desc-collapsed'); toggleDesc.textContent='Pokaż opis';
  } else {
    descText.classList.remove('desc-collapsed'); toggleDesc.textContent='Schowaj opis';
  }
});

/* Likes handling */
async function updateLikeState(){
  try {
    likeBtn.disabled = false;
    if (!currentUser) {
      // not logged in - clicking should redirect to login
      likeBtn.onclick = ()=> location.href = '/spheretube/login/';
      likeBtn.classList.remove('active');
      return;
    }
    const likeDocId = `${videoId}_${currentUser.uid}`;
    const likeRef = doc(db, 'video_likes', likeDocId);
    const likeSnap = await getDoc(likeRef);
    const liked = likeSnap.exists();
    likeBtn.classList.toggle('active', liked);
    likeBtn.onclick = async ()=> {
      likeBtn.disabled = true;
      try {
        if (liked) {
          await runTransaction(db, async (tx) => {
            const vref = doc(db, 'videos', videoId);
            const vdoc = await tx.get(vref);
            if (!vdoc.exists()) throw new Error('Video not found');
            tx.update(vref, { Video_likes: (vdoc.data().Video_likes ?? 1) - 1 });
            tx.delete(likeRef);
          });
        } else {
          await runTransaction(db, async (tx) => {
            const vref = doc(db, 'videos', videoId);
            const vdoc = await tx.get(vref);
            if (!vdoc.exists()) throw new Error('Video not found');
            tx.update(vref, { Video_likes: (vdoc.data().Video_likes ?? 0) + 1 });
            tx.set(likeRef, { videoId, uid: currentUser.uid, createdAt: serverTimestamp() });
          });
        }
        // refresh like state & counter
        const newV = await getDoc(doc(db,'videos',videoId));
        likeCountEl.textContent = newV.data().Video_likes ?? 0;
        // toggle
        const nowLiked = !(liked);
        likeBtn.classList.toggle('active', nowLiked);
        liked = nowLiked;
      } catch (e) {
        console.error('like failed', e);
        alert('Błąd podczas zapisu lajka.');
      } finally {
        likeBtn.disabled = false;
      }
    };
  } catch(e){ console.warn('updateLikeState err', e); }
}

/* Subscriptions */
async function renderSubscribeButton(channelId){
  channelActions.innerHTML = '';
  if (!channelId) return;
  if (!currentUser) {
    const subBtn = document.createElement('button');
    subBtn.className = 'subscribe-btn';
    subBtn.textContent = 'Subscribe';
    subBtn.onclick = ()=> location.href = '/spheretube/login/';
    channelActions.appendChild(subBtn);
    return;
  }
  const subDocId = `${channelId}_${currentUser.uid}`;
  const subRef = doc(db, 'subscriptions', subDocId);
  const subSnap = await getDoc(subRef);
  const subscribed = subSnap.exists();
  const btn = document.createElement('button');
  btn.className = 'subscribe-btn';
  btn.textContent = subscribed ? 'Subscribed' : 'Subscribe';
  btn.onclick = async ()=> {
    btn.disabled = true;
    try {
      if (subscribed) {
        await deleteDoc(subRef);
        btn.textContent = 'Subscribe';
      } else {
        await setDoc(subRef, { channelId, uid: currentUser.uid, createdAt: serverTimestamp() });
        btn.textContent = 'Subscribed';
      }
    } catch(e){ console.error('sub err', e); alert('Błąd subskrypcji'); }
    btn.disabled = false;
  };
  channelActions.appendChild(btn);
}

/* Recommended list */
async function loadRecommended(currentId){
  try {
    const q = query(collection(db, 'videos'), orderBy('Video_views','desc'), limit(8));
    const snap = await getDocs(q);
    recommendedList.innerHTML = '';
    snap.forEach(s => {
      if (s.id === currentId) return;
      const d = s.data();
      const card = document.createElement('div'); card.className='rec-card';
      const t = document.createElement('div'); t.className='rec-thumb';
      const im = document.createElement('img'); im.src = d.Video_image || '/spheretube/dev_img/site_icon.png';
      im.alt = d.Video_name || 'Video';
      im.onclick = ()=> location.href = `/spheretube/watch?v=${s.id}`;
      t.appendChild(im);
      const meta = document.createElement('div'); meta.className='rec-meta';
      const a = document.createElement('a'); a.className='rec-title'; a.href = `/spheretube/watch?v=${s.id}`; a.textContent = d.Video_name || 'Untitled';
      const v = document.createElement('div'); v.className='rec-views'; v.textContent = `${d.Video_views ?? 0} wyświetleń`;
      meta.appendChild(a); meta.appendChild(v);
      card.appendChild(t); card.appendChild(meta);
      recommendedList.appendChild(card);
    });
  } catch(e){ console.error('loadRecommended', e); }
    }
