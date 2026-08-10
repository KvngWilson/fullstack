import React from "react";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";

// Import all reducers
import authReducer from "@/features/auth/authSlice";
import cartReducer from "@/features/cart/cartSlice";
import productsReducer from "@/features/products/productsSlice";
import ordersReducer from "@/features/orders/ordersSlice";
import userReducer from "@/features/user/userSlice";

/**
 * Render component with Redux provider for testing
 * @param component - React component to render
 * @param preloadedState - Initial Redux state
 * @param renderOptions - Additional React Testing Library options
 */
export function renderWithRedux(
  component,
  {
    preloadedState = {},
    store = configureStore({
      reducer: {
        auth: authReducer,
        cart: cartReducer,
        products: productsReducer,
        orders: ordersReducer,
        user: userReducer,
      },
      preloadedState,
    }),
    ...renderOptions
  } = {},
) {
  function Wrapper({ children }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return {
    ...render(component, { wrapper: Wrapper, ...renderOptions }),
    store,
  };
}

// Re-export everything from React Testing Library
