/* ═══════════════════════════════════════════════════════
   Firebase Configuration & Initialization
   ═══════════════════════════════════════════════════════ */

window.ZAP = window.ZAP || {};

ZAP.FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCesCx1QMSuvKZe8trbJANIiikm3ncASnI",
  authDomain:        "zaproshennya-a1ea7.firebaseapp.com",
  databaseURL:       "https://zaproshennya-a1ea7-default-rtdb.firebaseio.com",
  projectId:         "zaproshennya-a1ea7",
  storageBucket:     "zaproshennya-a1ea7.firebasestorage.app",
  messagingSenderId: "474356200698",
  appId:             "1:474356200698:web:5a2d9c83240dfd44070543"
};

try {
  ZAP.firebaseApp = firebase.initializeApp(ZAP.FIREBASE_CONFIG);
  ZAP.authInstance = firebase.auth();
  ZAP.dbRef = firebase.database();
  console.log('✦ Firebase initialized');
} catch (e) {
  console.error('Firebase init failed:', e.message);
  ZAP.authInstance = null;
  ZAP.dbRef = null;
}
