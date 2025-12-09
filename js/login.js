// login.js — obsługa Firebase Auth dla login.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

/* Ta sama konfiguracja Firebase, którą podałeś wcześniej */
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
try { getAnalytics(app); } catch(e){ /* ignore if not available */ }
const auth = getAuth(app);

// UI elements
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const userBtn = document.getElementById('userBtn');
const authLabel = document.getElementById('authLabel');

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorBox = document.getElementById('errorBox');
const pwToggle = document.getElementById('pwToggle');

let currentUser = null;

// MENU behavior (identical to index)
function openMenu(){ sideMenu.classList.add('open'); sideMenu.classList.remove('closed'); sideMenu.setAttribute('aria-hidden','false'); overlay.classList.remove('hidden'); }
function closeMenu(){ sideMenu.classList.remove('open'); sideMenu.classList.add('closed'); sideMenu.setAttribute('aria-hidden','true'); overlay.classList.add('hidden'); }
hamburgerBtn.addEventListener('click', () => { if (sideMenu.classList.contains('open')) closeMenu(); else openMenu(); });
overlay.addEventListener('click', closeMenu);

// Auth state UI
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

// Password visibility toggle
pwToggle.addEventListener('click', () => {
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    pwToggle.innerHTML = '<span class="material-symbols-outlined">visibility_off</span>';
  } else {
    passwordInput.type = 'password';
    pwToggle.innerHTML = '<span class="material-symbols-outlined">visibility</span>';
  }
});

// Helper: show error in Polish
function showError(msg){
  errorBox.style.display = 'block';
  errorBox.textContent = msg;
}
function hideError(){ errorBox.style.display = 'none'; errorBox.textContent = ''; }

// Map Firebase error codes to Polish messages
function authErrorToPolish(code){
  switch(code){
    case 'auth/invalid-email': return 'Nieprawidłowy adres email.';
    case 'auth/user-disabled': return 'To konto zostało wyłączone.';
    case 'auth/user-not-found': return 'Konto o tym adresie email nie istnieje.';
    case 'auth/wrong-password': return 'Nieprawidłowe hasło.';
    case 'auth/too-many-requests': return 'Zbyt wiele prób logowania — spróbuj później.';
    default: return 'Wystąpił błąd podczas logowania. Spróbuj ponownie.';
  }
}

// Form submit
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const email = (emailInput.value || '').trim();
  const password = (passwordInput.value || '');

  if (!email || !password) {
    showError('Wypełnij wszystkie pola.');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logowanie...';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // success -> redirect to account page
    const user = cred.user;
    location.href = `/spheretube/account/?id=${encodeURIComponent(user.uid)}`;
  } catch (err) {
    console.error('Auth error', err);
    const message = authErrorToPolish(err.code || '');
    showError(message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});
