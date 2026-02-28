import { combineReducers } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';
import cartReducer from '@/features/cart/cartSlice';
import productsReducer from '@/features/products/productsSlice';
import ordersReducer from '@/features/orders/ordersSlice';
import userReducer from '@/features/user/userSlice';
import wishlistReducer from '@/features/wishlist/wishlistSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  cart: cartReducer,
  products: productsReducer,
  orders: ordersReducer,
  user: userReducer,
  wishlist: wishlistReducer,
});

export default rootReducer;
