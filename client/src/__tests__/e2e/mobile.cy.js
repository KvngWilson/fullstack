describe('Mobile View', () => {
  it('renders homepage on mobile viewport', () => {
    cy.viewport('iphone-6');
    cy.visit('/');
    cy.get('body').should('be.visible');
  });
});