import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      header: {
        freeDelivery: "Free delivery on orders over {{amount}}",
        support: "Support",
        searchPlaceholder: "What are you looking for?",
        search: "Search",
        cart: "Cart",
      },
      common: {
        loading: "Loading...",
        notAvailable: "N/A",
        pending: "pending",
        pageOf: "Page {{page}} of {{totalPages}}",
      },
      auth: {
        fields: {
          name: "Name",
          namePlaceholder: "John Doe",
          email: "Email",
          emailPlaceholder: "you@example.com",
          password: "Password",
          passwordPlaceholder: "••••••••",
          confirmPassword: "Confirm Password",
        },
        login: {
          title: "Welcome back",
          subtitle: "Sign in to your account",
          submit: "Login",
          loading: "Login...",
          failedTitle: "Login failed",
          forgotPassword: "Forgot password",
          noAccount: "Don't have an account?",
          signUp: "Sign up",
          errors: {
            requiredFields: "Email and password are required.",
            invalidEmail: "Please enter a valid email address.",
          },
        },
        register: {
          title: "Create account",
          subtitle: "Join us to get started",
          submit: "Sign Up",
          loading: "Signing up...",
          failedTitle: "Registration failed",
          hasAccount: "Already have an account?",
          errors: {
            requiredFields: "All fields are required.",
            passwordMinLength: "Password requirement: minimum 8 characters.",
            passwordMismatch: "Passwords do not match.",
            duplicateEmail:
              "Email already exists. Please use a different email address.",
          },
        },
        forgotPassword: {
          title: "Forgot Password",
          subtitle: "Enter your email to reset your password.",
          submit: "Send Reset Email",
          loading: "Sending...",
          failedTitle: "Unable to send reset email",
          successMessage: "Reset email sent. Please check your email.",
          backToLogin: "Back to Login",
          errors: {
            requiredEmail: "Email is required.",
          },
        },
        resetPassword: {
          title: "Reset Password",
        },
      },
      checkout: {
        title: "Checkout",
        continueAsGuest: "Continue as guest",
        loadingData: "Loading checkout data...",
        shippingInfo: "Shipping Information",
        subtotal: "Subtotal",
        shipping: "Shipping",
        total: "Total",
        loadingShippingOptions: "Loading shipping options…",
        shippingOptions: "Shipping options",
        standardShipping: "Standard shipping",
        continue: "Continue",
        payment: "Payment",
        methodStepReady: "Method step ready.",
        paymentProcessor: "Payment processor",
        processorStripe: "Stripe",
        processorPaystack: "Paystack",
        selectedShipping: "Selected shipping: {{name}} ({{cost}})",
        placingOrder: "Placing Order...",
        placeOrder: "Place Order",
        orderConfirmationSuccess: "Order confirmation successful.",
        cartEmpty: "Your cart is empty.",
        requiredFieldsMissing: "Required fields missing: {{fields}}",
        noShippingRates: "No shipping rates available for this address.",
        shippingRatesUnavailable:
          "Unable to fetch shipping rates right now. You can still continue.",
        confirmationSuccess:
          "Thank you! Your order confirmation was successful.",
        paymentStatusSuffix: " Payment status: {{status}}.",
        paymentReferenceSuffix: " Payment reference: {{reference}}.",
        reference: "Reference: {{reference}}",
        paymentStatusLabel: "Payment status: {{status}}",
      },
      orders: {
        title: "Orders",
        orderNumber: "Order #{{id}}",
        statusLine:
          "Status: {{status}} · Payment: {{payment}} · Total: {{total}}",
        trackHint: "Track shipment at /account/orders/{{id}}/tracking",
        noOrdersTitle: "No orders yet",
        noOrdersMessage:
          "Your purchases will appear here once you place an order.",
        failedLoad: "Failed to load orders",
      },
      orderDetail: {
        title: "Order Detail",
        failedLoad: "Failed to load order",
        status: "Status: {{status}}",
        payment: "Payment: {{payment}}",
        total: "Total: {{total}}",
        created: "Created: {{created}}",
        tracking: "Tracking",
        trackingStatus: "Status: {{status}}",
        openTrackingLink: "Open tracking link",
        openFullTrackingPage: "Open full tracking page",
        notFoundTitle: "Order not found",
        notFoundMessage: "We couldn’t find this order in your account.",
      },
      orderTracking: {
        title: "Order Tracking",
        backToOrderDetail: "Back to order detail",
        failedLoad: "Failed to load tracking",
        orderStatus: "Order status: {{status}}",
        shipment: "Shipment",
        trackingStatus: "Tracking status: {{status}}",
        carrier: "Carrier: {{carrier}}",
        trackingNumber: "Tracking #: {{trackingNumber}}",
        updated: "Updated: {{updatedAt}}",
        openCarrierTracking: "Open carrier tracking",
        trackingUnavailable: "Tracking information is not available yet.",
        notFoundTitle: "Order not found",
        notFoundMessage: "We couldn’t find this order in your account.",
      },
      orderConfirmation: {
        title: "Order Confirmation",
        cancelled:
          "Payment was cancelled. You can return to checkout to retry.",
        summary: "Order ID: {{orderId}} · Processor: {{processor}}",
        verifying: "Verifying payment status...",
        paymentStatus: "Payment status: {{status}}",
        successFallback:
          "Payment was initialized successfully. Final verification may take a moment.",
        viewOrder: "View order",
        backToOrders: "Back to orders",
        backToCheckout: "Back to checkout",
      },
    },
  },
  fr: {
    translation: {
      header: {
        freeDelivery:
          "Livraison gratuite pour les commandes supérieures à {{amount}}",
        support: "Assistance",
        searchPlaceholder: "Que recherchez-vous ?",
        search: "Rechercher",
        cart: "Panier",
      },
    },
  },
  es: {
    translation: {
      header: {
        freeDelivery: "Entrega gratuita en pedidos superiores a {{amount}}",
        support: "Soporte",
        searchPlaceholder: "¿Qué estás buscando?",
        search: "Buscar",
        cart: "Carrito",
      },
    },
  },
  de: {
    translation: {
      header: {
        freeDelivery: "Kostenlose Lieferung für Bestellungen über {{amount}}",
        support: "Support",
        searchPlaceholder: "Wonach suchen Sie?",
        search: "Suchen",
        cart: "Warenkorb",
      },
    },
  },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
