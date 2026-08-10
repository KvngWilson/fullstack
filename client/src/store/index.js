import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import rootReducer from "./rootReducer";

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ["auth/setToken"],
      },
    }),
  devTools: import.meta.env.DEV, // Enable Redux DevTools in development
});

export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;
