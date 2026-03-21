import { Provider } from "react-redux";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { AppPreferencesProvider } from "@/contexts/AppPreferencesContext";
import { store } from "@/store";

export default function AppProviders({ children }) {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <AppPreferencesProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              className: "border border-border bg-card text-foreground",
              success: {
                className: "border border-green-300 bg-green-50 text-green-900",
              },
              error: {
                className: "border border-red-300 bg-red-50 text-red-900",
              },
            }}
          />
        </AppPreferencesProvider>
      </Provider>
    </ErrorBoundary>
  );
}
