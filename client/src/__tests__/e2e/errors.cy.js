describe('Error Routes', () => {
  it('shows not found page for unknown route', () => {
    cy.visit('/this-route-does-not-exist', { failOnStatusCode: false });
    // Wait for any API calls to finish (if needed)
    cy.get('body').should('contain.text', 'Page Not Found');
    // Optionally, check for 401 error message and ensure not-found page still renders
    cy.get('body').should('not.contain.text', 'Unauthorized');
  });
});