// account.js — pobieranie user_data/{id}, edycja email/birthday/password i logout
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* Twoja config (tak jak wcześniej) */
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

// UI elements (menu)
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const userBtn = document.getElementById('userBtn');
const authLabel = document.getElementById('authLabel');

function openMenu(){ sideMenu.classList.add('open'); sideMenu.classList.remove('closed'); sideMenu.setAttribute('aria-hidden','false'); overlay.classList.remove('hidden'); }
function closeMenu(){ sideMenu.classList.remove('open'); sideMenu.classList.add('closed'); sideMenu.setAttribute('aria-hidden','true'); overlay.classList.add('hidden'); }
hamburgerBtn.addEventListener('click', () => { if (sideMenu.classList.contains('open')) closeMenu(); else openMenu(); });
overlay.addEventListener('click', closeMenu);

// Account UI
const subtitle = document.getElementById('subtitle');
const fieldsContainer = document.getElementById('fields');
const logoutBtn = document.getElementById('logoutBtn');

// Modal
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');

let currentUser = null;
let viewingUid = null; // whose account we are viewing
let userData = null;

// Helper: get ?id= param
function getUrlId(){
  const params = new URLSearchParams(location.search);
  return params.get('id');
}

// Simple date formatting
function fmtTimestamp(ts){
  if (!ts) return '-';
  if (ts.toDate) { // Firestore Timestamp
    return ts.toDate().toLocaleString();
  }
  return new Date(ts).toLocaleString();
}

// show modal helper
function openModal(title, bodyHtml, onConfirm){
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');

  const cleanup = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    modalBody.innerHTML = '';
    modalConfirm.onclick = null;
    modalCancel.onclick = null;
  };

  modalCancel.onclick = () => { cleanup(); };
  modalConfirm.onclick = async () => {
    try {
      modalConfirm.disabled = true;
      await onConfirm(modalBody);
    } catch (err) {
      console.error('modal action error', err);
      alert(err.message || 'Wystąpił błąd');
    } finally {
      modalConfirm.disabled = false;
      cleanup();
    }
  };
}

// Display fields
function renderFields(){
  fieldsContainer.innerHTML = '';

  const showField = (label, valueHtml, actionsHtml = '') => {
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `
      <div class="field-left">
        <div class="field-label">${label}</div>
        <div class="field-value">${valueHtml}</div>
      </div>
      <div class="field-actions">${actionsHtml}</div>
    `;
    fieldsContainer.appendChild(row);
  };

  const birthday = userData?.birthday || '-';
  const email = userData?.email || (currentUser ? currentUser.email : '-');
  const username = userData?.username || (currentUser ? currentUser.displayName || '-' : '-');
  const passwordMasked = userData?.password || '*****';
  const createdAt = userData?.createdAt ? fmtTimestamp(userData.createdAt) : '-';

  // If viewer is owner, show action buttons
  const isOwner = currentUser && viewingUid && currentUser.uid === viewingUid;

  showField('Username', escapeHtml(username), '');
  showField('Email', escapeHtml(email), isOwner ? `<button id="changeEmailBtn" class="small-btn">Change email</button>` : '');
  showField('Birthday', escapeHtml(birthday), isOwner ? `<button id="changeBirthdayBtn" class="small-btn">Change birthday</button>` : '');
  showField('Password', escapeHtml(passwordMasked), isOwner ? `<button id="changePasswordBtn" class="small-btn">Change password</button>` : '');
  showField('Created', escapeHtml(createdAt), '');

  // hook actions
  if (isOwner) {
    document.getElementById('changeEmailBtn').addEventListener('click', handleChangeEmail);
    document.getElementById('changeBirthdayBtn').addEventListener('click', handleChangeBirthday);
    document.getElementById('changePasswordBtn').addEventListener('click', handleChangePassword);
  }
}

// Escape helper
function escapeHtml(s){
  if (s == null) return '';
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

// Load user data doc
async function loadUserData(uid){
  subtitle.textContent = 'Ładowanie danych...';
  fieldsContainer.innerHTML = '';
  try {
    const docRef = doc(db, 'user_data', uid);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      userData = null;
      subtitle.textContent = 'Brak dokumentu user_data dla tego użytkownika.';
      // still allow to view basic auth info if available
      renderFields();
      return;
    }
    userData = snap.data();
    subtitle.textContent = `Pokaż dane konta: ${uid}`;
    renderFields();
  } catch (err) {
    console.error('loadUserData error', err);
    subtitle.textContent = 'Błąd podczas pobierania danych.';
  }
}

// Handler: change birthday (only updates Firestore)
async function handleChangeBirthday(){
  openModal('Change birthday', `
    <div class="row">
      <label style="color:var(--muted);font-size:13px">New birthday</label>
      <input id="modalBirthday" type="date" />
    </div>
    <div class="info-note">Podaj datę w formacie YYYY-MM-DD</div>
  `, async (body) => {
    const input = body.querySelector('#modalBirthday');
    const val = (input.value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) throw new Error('Podaj poprawną datę.');
    // update Firestore
    const docRef = doc(db, 'user_data', viewingUid);
    await updateDoc(docRef, { birthday: val, updatedAt: serverTimestamp() });
    // refresh
    await loadUserData(viewingUid);
    alert('Birthday zaktualizowany.');
  });
}

// Handler: change email (updates auth + user_data.email)
async function handleChangeEmail(){
  openModal('Change email', `
    <div class="row">
      <label style="color:var(--muted);font-size:13px">New email</label>
      <input id="modalEmail" type="email" placeholder="nowy@adres.pl" />
    </div>
    <div class="info-note">Firebase może wymagać ponownej autentykacji jeśli sesja jest stara.</div>
  `, async (body) => {
    const input = body.querySelector('#modalEmail');
    const newEmail = (input.value || '').trim();
    if (!newEmail) throw new Error('Podaj nowy adres email.');

    if (!currentUser) throw new Error('Musisz być zalogowany aby zmienić email.');

    try {
      await updateEmail(currentUser, newEmail);
    } catch (err) {
      // if need reauth, tell user
      console.error('updateEmail error', err);
      if (err.code === 'auth/requires-recent-login') {
        throw new Error('Potrzebna ponowna autentykacja. Zaloguj się ponownie i spróbuj ponownie.');
      } else {
        throw new Error(err.message || 'Błąd przy aktualizacji email.');
      }
    }

    // update Firestore email field if exists
    try {
      const docRef = doc(db, 'user_data', viewingUid);
      await updateDoc(docRef, { email: newEmail, updatedAt: serverTimestamp() });
    } catch (e) {
      console.warn('Nie udało się zaktualizować user_data.email:', e);
    }

    await loadUserData(viewingUid);
    alert('Email zaktualizowany.');
  });
}

// Handler: change password (updates auth and masked field in user_data)
async function handleChangePassword(){
  openModal('Change password', `
    <div class="row">
      <label style="color:var(--muted);font-size:13px">New password (min 6 znaków)</label>
      <input id="modalPassword" type="password" />
    </div>
    <div class="info-note">Hasło nie jest zapisywane w postaci jawnej. Zostanie zaktualizowane w Firebase Auth.</div>
  `, async (body) => {
    const input = body.querySelector('#modalPassword');
    const newPw = (input.value || '');
    if (newPw.length < 6) throw new Error('Hasło musi mieć co najmniej 6 znaków.');

    if (!currentUser) throw new Error('Musisz być zalogowany aby zmienić hasło.');

    try {
      await updatePassword(currentUser, newPw);
    } catch (err) {
      console.error('updatePassword error', err);
      if (err.code === 'auth/requires-recent-login') {
        throw new Error('Potrzebna ponowna autentykacja. Zaloguj się ponownie i spróbuj ponownie.');
      } else {
        throw new Error(err.message || 'Błąd przy aktualizacji hasła.');
      }
    }

    // update masked password in Firestore
    try {
      const masked = '*'.repeat(Math.max(1, newPw.length));
      const docRef = doc(db, 'user_data', viewingUid);
      await updateDoc(docRef, { password: masked, updatedAt: serverTimestamp() });
    } catch (e) {
      console.warn('Nie udało się zaktualizować maski hasła w Firestore:', e);
    }

    await loadUserData(viewingUid);
    alert('Hasło zaktualizowane.');
  });
}

// Logout
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  location.href = '/spheretube/'; // redirect to homepage after logout
});

// AUTH state and initial load
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    const name = user.displayName || user.email || (user.email ? user.email.split('@')[0] : 'User');
    authLabel.textContent = name;
    userBtn.onclick = () => { location.href = `/spheretube/account/?id=${user.uid}`; };
  } else {
    authLabel.textContent = 'SignUp / SignIn';
    userBtn.onclick = () => { location.href = '/spheretube/login/'; };
  }

  // determine viewingUid: URL param or current user
  const paramId = getUrlId();
  viewingUid = paramId || (user ? user.uid : null);

  if (!viewingUid) {
    subtitle.textContent = 'Brak informacji którego konta dotyczy strona. Zaloguj się.';
    fieldsContainer.innerHTML = '';
    return;
  }

  // load user_data for viewingUid
  await loadUserData(viewingUid);

  // if current user is not owner, hide logout button (you can still logout from header)
  if (!currentUser || currentUser.uid !== viewingUid) {
    logoutBtn.style.display = 'none';
  } else {
    logoutBtn.style.display = '';
  }
});
