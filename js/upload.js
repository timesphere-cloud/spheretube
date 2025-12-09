// upload.js — upload do Cloudinary (unsigned) + zapis metadanych do Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* ===== Twoja konfiguracja Firebase (jak wcześniej) ===== */
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
try { getAnalytics(app); } catch(e){}

const auth = getAuth(app);
const db = getFirestore(app);

/* ===== Cloudinary (public info only) ===== */
const CLOUD_NAME = 'dmogrkbja'; // from your config
// IMPORTANT: create an unsigned upload preset in Cloudinary and put its name here:
const UPLOAD_PRESET = 'Upload'; // <-- REPLACE this with your unsigned preset name

/* ===== UI ===== */
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

onAuthStateChanged(auth, (u) => { currentUser = u; });

/* ===== helpers ===== */
function setStatus(s){ statusEl.textContent = s; }

function uploadToCloudinary(file, resourceType = 'image', onProgress = null){
  // resourceType: 'image' or 'video'
  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
    const xhr = new XMLHttpRequest();
    const fd = new FormData();

    fd.append('upload_preset', UPLOAD_PRESET);
    fd.append('file', file);

    xhr.open('POST', url, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            // res contains secure_url, public_id, resource_type, bytes, duration (for video) etc.
            resolve(res);
          } catch (err) {
            reject(new Error('Cloudinary: nieprawidłowa odpowiedź JSON'));
          }
        } else {
          reject(new Error('Upload failed: ' + xhr.status + ' ' + xhr.responseText));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(fd);
  });
}

// get duration (seconds) of local video file by loading metadata
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

/* ===== UI interactions ===== */
thumbInput.addEventListener('change', (e) => {
  const f = thumbInput.files[0];
  if (!f) { thumbPreview.src = '/spheretube/dev_img/site_icon.png'; return; }
  const url = URL.createObjectURL(f);
  thumbPreview.src = url;
});

videoInput.addEventListener('change', async (e) => {
  const f = videoInput.files[0];
  if (!f) { videoPreview.src = ''; return; }
  const url = URL.createObjectURL(f);
  videoPreview.src = url;
  // pre-load metadata for preview and get duration (optional)
  try {
    const d = await getVideoDuration(f);
    if (d != null) {
      // show duration in subtitle
      const mins = Math.floor(d/60);
      const secs = d%60;
      document.getElementById('subtitle').textContent = `Gotowy — wykryto długość: ${mins}:${String(secs).padStart(2,'0')} (lokalnie).`;
    }
  } catch (e) {
    console.warn('Nie udało się pobrać czasu trwania:', e);
  }
});

resetBtn.addEventListener('click', (e) => {
  uploadForm.reset();
  thumbPreview.src = '/spheretube/dev_img/site_icon.png';
  videoPreview.src = '';
  thumbProgress.style.display = 'none';
  videoProgress.style.display = 'none';
  document.getElementById('subtitle').textContent = 'Wybierz plik wideo (.mp4) oraz miniaturkę (.png).';
  setStatus('Gotowy');
});

/* ===== Main submit logic ===== */
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setStatus('Przygotowanie...');
  uploadBtn.disabled = true;

  const title = (titleInput.value || '').trim();
  const desc = (descInput.value || '').trim();
  const thumbFile = thumbInput.files[0] || null;
  const videoFile = videoInput.files[0] || null;

  if (!title) { alert('Podaj nazwę wideo.'); uploadBtn.disabled = false; return; }
  if (!videoFile) { alert('Wybierz plik wideo.'); uploadBtn.disabled = false; return; }
  if (!UPLOAD_PRESET || UPLOAD_PRESET === 'YOUR_UNSIGNED_UPLOAD_PRESET') {
    alert('Ustaw proszę UPLOAD_PRESET w /spheretube/js/upload.js (nazwa unsigned upload preset w Cloudinary).');
    uploadBtn.disabled = false;
    return;
  }

  try {
    // 1) get duration locally (if possible)
    setStatus('Pobieranie metadanych wideo...');
    const durationSec = await getVideoDuration(videoFile);

    // 2) upload thumbnail (optional)
    let thumbResult = null;
    if (thumbFile) {
      thumbProgress.style.display = '';
      thumbProgress.querySelector('i').style.width = '0%';
      setStatus('Wysyłanie miniaturki...');
      thumbResult = await uploadToCloudinary(thumbFile, 'image', (pct) => {
        thumbProgress.querySelector('i').style.width = pct + '%';
      });
      thumbProgress.querySelector('i').style.width = '100%';
      setStatus('Miniaturka w Cloudinary: OK');
    }

    // 3) upload video
    videoProgress.style.display = '';
    videoProgress.querySelector('i').style.width = '0%';
    setStatus('Wysyłanie wideo (to może chwilę potrwać)...');
    const videoResult = await uploadToCloudinary(videoFile, 'video', (pct) => {
      videoProgress.querySelector('i').style.width = pct + '%';
    });
    videoProgress.querySelector('i').style.width = '100%';
    setStatus('Wideo przesłane do Cloudinary.');

    // 4) zapisz dane do Firestore
    setStatus('Zapisywanie metadanych do Firestore...');
    // create a doc in uploads_info
    const uploadsInfoRef = collection(db, 'uploads_info');
    const uploadsDoc = await addDoc(uploadsInfoRef, {
      Video_name: title,
      Video_desc: desc,
      Uploaded_at: serverTimestamp(),
      imageURL: thumbResult ? thumbResult.secure_url : null,
      Video: videoResult ? videoResult.secure_url : null
    });

    const docId = uploadsDoc.id;

    // create corresponding doc in videos collection with same id
    const videosRef = doc(db, 'videos', docId);
    const ownerUid = currentUser ? currentUser.uid : null;

    // Use duration from Cloudinary if available (videoResult.duration) else local duration
    const durationFromCloud = videoResult.duration ? Math.floor(videoResult.duration) : null;
    const finalDuration = durationFromCloud ?? durationSec ?? null;

    await setDoc(videosRef, {
      Video_name: title,
      Video_descriprion: desc, // note: kept spelling as requested
      Video_image: thumbResult ? thumbResult.secure_url : null,
      Video_views: 0,
      Video_likes: 0,
      Video_Duration: finalDuration,
      Video_Owner: ownerUid || null,
      createdAt: serverTimestamp()
    });

    setStatus('Upload zakończony. Dokumenty utworzone.');
    alert('Wideo zostało przesłane i zapisane w Firestore.');
    // optionally redirect to edit or watch page
    // location.href = `/spheretube/watch?v=${docId}`;
    uploadForm.reset();
    thumbPreview.src = '/spheretube/dev_img/site_icon.png';
    videoPreview.src = '';
  } catch (err) {
    console.error('Błąd uploadu:', err);
    alert('Wystąpił błąd podczas uploadu: ' + (err.message || err));
    setStatus('Błąd uploadu.');
  } finally {
    uploadBtn.disabled = false;
  }
});
