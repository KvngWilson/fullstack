describe('Cart & Checkout', () => {
  it('opens cart page', () => {
    cy.visit('/cart');
    cy.get('main').should('exist');
  });

  it('navigates to checkout route', () => {
    cy.visit('/checkout');
    cy.location('pathname').should('include', '/checkout');
  });
});