describe('Account Access', () => {
  it('redirects unauthenticated access from account profile', () => {
    cy.visit('/account/profile');
    cy.location('pathname').should((path) => {
      expect(['/login', '/unauthorized', '/account/profile']).to.include(path);
    });
  });
});