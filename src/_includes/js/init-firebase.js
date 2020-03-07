"use strict";

const firebaseConfig = {
  apiKey: "AIzaSyDhfRgeSlggR1DkA_bxgQU1jcEJW9NLYcQ",
  authDomain: "boopathi-blog.firebaseapp.com",
  databaseURL: "https://boopathi-blog.firebaseio.com",
  projectId: "boopathi-blog",
  storageBucket: "boopathi-blog.appspot.com",
  messagingSenderId: "452500282162",
  appId: "1:452500282162:web:a7205cf1b1185ed44c952b",
  measurementId: "G-FBDLWY9VFC"
};

function initFirebase() {
  firebase.initializeApp(firebaseConfig);
  window.firebasePerf = firebase.performance();
}
