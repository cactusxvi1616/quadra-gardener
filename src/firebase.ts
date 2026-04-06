import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBnmMmSsxZ90Sw3HUOgwFGvzMUmQ7Gc2L8",
  authDomain: "quadra-gardener.firebaseapp.com",
  databaseURL: "https://quadra-gardener-default-rtdb.firebaseio.com/",
  projectId: "quadra-gardener",
  storageBucket: "quadra-gardener.firebasestorage.app",
  messagingSenderId: "1039703566150",
  appId: "1:1039703566150:web:a550c99d4e66abd887e747",
  measurementId: "G-5Q4H969NXL"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
