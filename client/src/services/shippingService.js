import { shippingApi } from "@/api/endpoints/shipping";

export const shippingService = {
  calculateShippingRates: (payload) =>
    shippingApi.calculateShippingRates(payload),
  getCheckoutShippingRates: (destination, items) =>
    shippingApi.getCheckoutShippingRates(destination, items),
};

export default shippingService;
