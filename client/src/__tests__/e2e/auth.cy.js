describe("Auth Flow", () => {
  const testUser = {
    email: "customer1@example.com",
    password: "TestPassword123!",
  };

  it("renders login form", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').should("be.visible");
    cy.get('input[type="password"]').should("be.visible");
    cy.contains("button", /login/i).should("be.visible");
  });

  it("shows validation state on empty submit", () => {
    cy.visit("/login");
    cy.contains("button", /login/i).click();
    cy.get('input[type="email"]').should("exist");
  });

  it("logs in with valid credentials", () => {
    cy.intercept("POST", "**/api/v1/identity/users/login", {
      statusCode: 200,
      body: {
        id: 1,
        email: testUser.email,
        role: "customer",
        token: "test-token",
      },
    }).as("loginRequest");

    cy.visit("/login");
    cy.get('input[type="email"]').type(testUser.email);
    cy.get('input[type="password"]').type(testUser.password);
    cy.contains("button", /login/i).click();
    cy.wait("@loginRequest");
    // Expect redirect or dashboard element
    cy.url().should("not.include", "/login");
    cy.contains(/dashboard|account|logout/i).should("exist");
  });
});
