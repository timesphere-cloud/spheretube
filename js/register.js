// register.js — tworzenie użytkownika i zapisywanie danych do Firestore (maskujemy hasło)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* Twoja konfiguracja Firebase - jak wcześniej */
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
try { getAnalytics(app); } catch (e) { /* ignore in environments without analytics */ }

const auth = getAuth(app);
const db = getFirestore(app);

// UI
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const userBtn = document.getElementById('userBtn');
const authLabel = document.getElementById('authLabel');

const registerForm = document.getElementById('registerForm');
const birthdayInput = document.getElementById('birthday');
const emailInput = document.getElementById('email');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const registerBtn = document.getElementById('registerBtn');
const errorBox = document.getElementById('errorBox');
const pwToggle = document.getElementById('pwToggle');

let currentUser = null;

// MENU (jak poprzednio)
function openMenu(){ sideMenu.classList.add('open'); sideMenu.classList.remove('closed'); sideMenu.setAttribute('aria-hidden','false'); overlay.classList.remove('hidden'); }
function closeMenu(){ sideMenu.classList.remove('open'); sideMenu.classList.add('closed'); sideMenu.setAttribute('aria-hidden','true'); overlay.classList.add('hidden'); }
hamburgerBtn.addEventListener('click', () => { if (sideMenu.classList.contains('open')) closeMenu(); else openMenu(); });
overlay.addEventListener('click', closeMenu);

// Auth state UI (pokazywanie label)
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
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

// pw toggle
pwToggle.addEventListener('click', () => {
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    pwToggle.innerHTML = '<span class="material-symbols-outlined">visibility_off</span>';
  } else {
    passwordInput.type = 'password';
    pwToggle.innerHTML = '<span class="material-symbols-outlined">visibility</span>';
  }
});

function showError(msg){ errorBox.style.display = 'block'; errorBox.textContent = msg; }
function hideError(){ errorBox.style.display = 'none'; errorBox.textContent = ''; }

function authErrorToPolish(code){
  switch(code){
    case 'auth/email-already-in-use': return 'Adres email jest już używany.';
    case 'auth/invalid-email': return 'Nieprawidłowy adres email.';
    case 'auth/operation-not-allowed': return 'Rejestracja nie jest dostępna.';
    case 'auth/weak-password': return 'Hasło jest zbyt słabe (minimum 6 znaków).';
    default: return 'Wystąpił błąd podczas rejestracji. Spróbuj ponownie.';
  }
}

// simple date format validation: expecting yyyy-mm-dd from input[type=date]
function isValidDateString(s){
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Form submit
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const birthday = (birthdayInput.value || '').trim();
  const email = (emailInput.value || '').trim();
  const username = (usernameInput.value || '').trim();
  const password = (passwordInput.value || '');

  if (!birthday || !isValidDateString(birthday)) { showError('Podaj poprawną datę urodzenia.'); return; }
  if (!email) { showError('Podaj adres email.'); return; }
  if (!username) { showError('Podaj username.'); return; }
  if (!password || password.length < 6) { showError('Hasło musi mieć co najmniej 6 znaków.'); return; }

  registerBtn.disabled = true;
  registerBtn.textContent = 'Rejestracja...';

  try {
    // 1) create user in Firebase Auth
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // 2) set displayName to username
    try {
      await updateProfile(user, { displayName: username });
    } catch (e) {
      console.warn('Nie udało się ustawić displayName:', e);
    }

    // 3) create document in Firestore collection "user_data" with masked password
    const masked = '*'.repeat(Math.max(1, password.length)); // mask same length as password
    const userDoc = doc(db, 'user_data', user.uid);
    await setDoc(userDoc, {
      birthday: birthday,
      email: email,
      username: username,
      password: masked,        // zapisane tylko w formie gwiazdek
      createdAt: serverTimestamp()
    });

    // 4) redirect to account page
    location.href = `/spheretube/account/?id=${encodeURIComponent(user.uid)}`;
  } catch (err) {
    console.error('Register error', err);
    const msg = authErrorToPolish(err.code || '');
    showError(msg);
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register';
  }
});
