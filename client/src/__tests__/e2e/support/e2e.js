Cypress.on("uncaught:exception", (err) => {
  if (/Request failed with status code (401|403)/.test(err.message || "")) {
    return false;
  }

  return undefined;
});

