// ===== Firebase Init (Compat) =====
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase App Initialized");
} catch (error) {
    console.error("Firebase Init Error:", error);
}

const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();
