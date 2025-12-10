// assets/js/auth.js
// Firebase Authentication + حماية كاملة للنظام

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// 1) إعدادات Firebase الخاصة بمشروعك
const firebaseConfig = {
  apiKey: "AIzaSyAvb_76Pm-U74MYUHMBk8xl9-iD8vPmoU0",
  authDomain: "invoicestockapp.firebaseapp.com",
  projectId: "invoicestockapp",
  storageBucket: "invoicestockapp.firebasestorage.app",
  messagingSenderId: "403989131218",
  appId: "1:403989131218:web:60cfad56a7d3abe306a20b"
};

// 2) تهيئة Firebase + Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// تخزين الجلسة في المتصفح (يبقى مسجلاً حتى بعد إغلاق المتصفح)
setPersistence(auth, browserLocalPersistence).catch(console.error);

// فلاغ لمنع تكرار initEvents / initSync
let appEventsInitialized = false;
let syncInitialized = false;

// 3) دوال مساعدة للحصول على عناصر الـ DOM
function getEls() {
  return {
    loginScreen: document.getElementById("login-screen"),
    loginForm: document.getElementById("login-form"),
    loginEmail: document.getElementById("login-email"),
    loginPass: document.getElementById("login-password"),
    loginError: document.getElementById("login-error"),
    logoutBtn: document.getElementById("btn-logout"),
    userEmailSpan: document.getElementById("current-user-email"),
    appShell: document.querySelector(".app-shell")
  };
}

// 4) تهيئة فورم تسجيل الدخول
function initLoginForm() {
  const { loginForm, loginEmail, loginPass, loginError } = getEls();
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.style.display = "none";

    const email = (loginEmail.value || "").trim();
    const pass = (loginPass.value || "").trim();

    if (!email || !pass) {
      loginError.textContent = "الرجاء إدخال البريد وكلمة السر.";
      loginError.style.display = "block";
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // في حال النجاح سيتم استدعاء onAuthStateChanged
    } catch (err) {
      console.error("Login error:", err);
      loginError.textContent = "فشل تسجيل الدخول، تأكد من البريد وكلمة السر.";
      loginError.style.display = "block";
    }
  });
}

// 5) تهيئة زر تسجيل الخروج
function initLogoutButton() {
  const { logoutBtn } = getEls();
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  });
}

// 6) مراقبة حالة تسجيل الدخول + تشغيل / تعطيل النظام
onAuthStateChanged(auth, async (user) => {
  const { loginScreen, userEmailSpan, appShell } = getEls();

  if (!loginScreen || !appShell || !userEmailSpan) return;

  if (user) {
    // مسجل دخول
    loginScreen.style.display = "none";
    appShell.style.filter = "none";
    appShell.style.pointerEvents = "auto";
    userEmailSpan.textContent = user.email || "مستخدم";

    console.log("User logged in:", user.email);

    // تشغيل النظام هنا فقط — لا أي استدعاء لـ SheetDB قبل ذلك.
    try {
      await loadAllData();           // من data.js
      await createNewInvoice("retail"); // من invoice.js

      if (!appEventsInitialized) {
        initEvents();                // من app.js
        appEventsInitialized = true;
      }

      if (!syncInitialized) {
        initSync();                  // من sync.js
        syncInitialized = true;
      }

      await refreshDashboard();      // من dashboard.js
    } catch (err) {
      console.error("Error initializing app after login:", err);
    }

  } else {
    // غير مسجل دخول -> إظهار شاشة الدخول وتعطيل النظام
    loginScreen.style.display = "flex";
    appShell.style.filter = "blur(6px)";
    appShell.style.pointerEvents = "none";
    userEmailSpan.textContent = "غير مسجل";

    console.log("No user logged in.");
  }
});

// 7) تهيئة عناصر الدخول عند تحميل الصفحة
window.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
  initLogoutButton();
});
