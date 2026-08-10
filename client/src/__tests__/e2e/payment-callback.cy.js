describe('Payment Callback', () => {
  it('loads order confirmation route', () => {
    cy.visit('/order-confirmation');
    cy.get('main').should('exist');
  });
});