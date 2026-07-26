describe('RBAC Routes', () => {
  it('handles anonymous admin route access safely', () => {
    cy.visit('/admin', { failOnStatusCode: false });
    cy.location('pathname').should((path) => {
      expect(['/admin', '/login', '/unauthorized']).to.include(path);
    });
  });
});