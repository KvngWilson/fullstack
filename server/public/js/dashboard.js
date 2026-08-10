document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.querySelector(".topbar-search input");

  if (searchInput) {
    searchInput.setAttribute("autocomplete", "off");
  }
});
