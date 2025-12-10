// upload.js (module) — menu/auth + upload via backend (Render) + Firestore writes
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* ====== Firebase config (jak wcześniej) ====== */
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

/* ===== Backend upload server (Render) ===== */
const UPLOAD_SERVER = 'https://spheretube-backend.onrender.com'; // <-- upewnij się, że to Twój URL na Render
const UPLOAD_ENDPOINT = `${UPLOAD_SERVER}/upload`;

/* ===== UI refs ===== */
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const userBtn = document.getElementById('userBtn');
const authLabel = document.getElementById('authLabel');

const uploadForm = document.getElementById('uploadForm');
const titleInput = document.getElementById('title');
const descInput = document.getElementById('desc');
const thumbInput = document.getElementById('thumb');
const videoInput = document.getElementById('videoFile');

const thumbPreview = document.getElementById('thumbPreview');
const videoPreview = document.getElementById('videoPreview');

const thumbProgress = document.getElementById('thumbProgress');
const videoProgress = document.getElementById('videoProgress');
const uploadBtn = document.getElementById('uploadBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');

let currentUser = null;

/* ===== Menu open/close (robust, działa zawsze) ===== */
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

/* ===== Auth state handling (label + account link) ===== */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authLabel.textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'Account');
    userBtn.onclick = () => { location.href = `/spheretube/account/?id=${user.uid}`; };
  } else {
    authLabel.textContent = 'SignUp / SignIn';
    userBtn.onclick = () => { location.href = '/spheretube/login/'; };
  }
});

/* ===== Helpers ===== */
function setStatus(s){ statusEl.textContent = s; }
function showProgress(el, pct){
  el.style.display = '';
  const bar = el.querySelector('i');
  bar.style.width = pct + '%';
}

/* ===== Upload to backend (XHR so we get progress) =====
   Returns an object: { videoUrl, thumbUrl, ... } (like backend returns)
   onProgress(percent) - callback with 0..100 overall progress
*/
function uploadToServer(file, thumbFile, onProgress = null){
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_ENDPOINT, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (typeof onProgress === 'function') onProgress(pct);
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res);
          } catch (err) {
            reject(new Error('Server returned invalid JSON'));
          }
        } else {
          let msg = `Upload failed: ${xhr.status}`;
          try { const r = JSON.parse(xhr.responseText); if (r && r.error) msg = r.error; } catch(e){}
          reject(new Error(msg));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    const fd = new FormData();
    fd.append('video', file);
    if (thumbFile) fd.append('thumb', thumbFile);

    xhr.send(fd);
  });
}

/* Get video duration from local file */
function getVideoDuration(file){
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => {
      const d = v.duration || 0;
      URL.revokeObjectURL(url);
      resolve(Math.floor(d));
    };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
  });
}

/* ===== UI events ===== */
thumbInput.addEventListener('change', () => {
  const f = thumbInput.files[0];
  if (!f) { thumbPreview.src = '/spheretube/dev_img/site_icon.png'; return; }
  thumbPreview.src = URL.createObjectURL(f);
});

videoInput.addEventListener('change', async () => {
  const f = videoInput.files[0];
  if (!f) { videoPreview.src = ''; return; }
  videoPreview.src = URL.createObjectURL(f);
  try {
    const d = await getVideoDuration(f);
    if (d != null) {
      const mins = Math.floor(d/60);
      const secs = d%60;
      document.getElementById('subtitle').textContent = `Gotowy — wykryto długość: ${mins}:${String(secs).padStart(2,'0')} (lokalnie).`;
    }
  } catch (err) {
    console.warn('duration error', err);
  }
});

resetBtn.addEventListener('click', () => {
  uploadForm.reset();
  thumbPreview.src = '/spheretube/dev_img/site_icon.png';
  videoPreview.src = '';
  thumbProgress.style.display = 'none';
  videoProgress.style.display = 'none';
  setStatus('Gotowy');
});

/* ===== Main upload flow (uses uploadToServer) ===== */
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = (titleInput.value || '').trim();
  const desc = (descInput.value || '').trim();
  const thumbFile = thumbInput.files[0] || null;
  const videoFile = videoInput.files[0] || null;

  if (!title) { alert('Podaj nazwę wideo.'); return; }
  if (!videoFile) { alert('Wybierz plik wideo.'); return; }

  uploadBtn.disabled = true;
  setStatus('Przygotowanie...');

  try {
    // 1) duration from local
    setStatus('Analiza metadanych wideo...');
    const durationSec = await getVideoDuration(videoFile);

    // 2) upload to server (single request) with progress callback
    setStatus('Wysyłanie wideo i miniaturki na serwer...');
    showProgress(videoProgress, 0);
    showProgress(thumbProgress, 0);

    const uploadResult = await uploadToServer(videoFile, thumbFile, (pct) => {
      // update both bars proportionally (simple UX)
      showProgress(videoProgress, pct);
      showProgress(thumbProgress, pct);
      setStatus(`Wysyłanie... ${pct}%`);
    });

    // uploadResult expected: { videoUrl: "...", thumbUrl: "..." }
    const videoResult = { secure_url: uploadResult.videoUrl || uploadResult.video || null, duration: uploadResult.duration || null };
    const thumbResult = uploadResult.thumbUrl ? { secure_url: uploadResult.thumbUrl } : null;

    showProgress(videoProgress, 100);
    showProgress(thumbProgress, 100);
    setStatus('Pliki przesłane. Zapis do Firestore...');

    // 3) save to Firestore: uploads_info
    const uploadsRef = collection(db, 'uploads_info');
    const uploadsDoc = await addDoc(uploadsRef, {
      Video_name: title,
      Video_desc: desc,
      Uploaded_at: serverTimestamp(),
      imageURL: thumbResult ? thumbResult.secure_url : null,
      Video: videoResult ? videoResult.secure_url : null
    });

    const docId = uploadsDoc.id;
    const videosRef = doc(db, 'videos', docId);

    const durationFromCloud = (videoResult && videoResult.duration) ? Math.floor(videoResult.duration) : null;
    const finalDuration = durationFromCloud ?? durationSec ?? null;
    const ownerUid = currentUser ? currentUser.uid : null;

    await setDoc(videosRef, {
      Video_name: title,
      Video_descriprion: desc,
      Video_image: thumbResult ? thumbResult.secure_url : null,
      Video_views: 0,
      Video_likes: 0,
      Video_Duration: finalDuration,
      Video_Owner: ownerUid || null,
      createdAt: serverTimestamp()
    });

    setStatus('Upload zakończony. Dokumenty utworzone.');
    alert('Wideo przesłane i zapisane w Firestore.');
    uploadForm.reset();
    thumbPreview.src = '/spheretube/dev_img/site_icon.png';
    videoPreview.src = '';
  } catch (err) {
    console.error('Upload error', err);
    alert('Błąd podczas uploadu: ' + (err.message || err));
    setStatus('Błąd uploadu');
  } finally {
    uploadBtn.disabled = false;
  }
});
