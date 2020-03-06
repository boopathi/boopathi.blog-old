const id = document.getElementById("nav-burger");
let isSiteHeadOpen = false;

id.addEventListener("click", e => {
  e.preventDefault();

  if (isSiteHeadOpen) {
    isSiteHeadOpen = false;
    document.body.classList.remove("site-head-open");
  } else {
    isSiteHeadOpen = true;
    document.body.classList.add("site-head-open");
  }
});
