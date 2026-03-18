import apiClient from "@/api/client";
import { guestSessionService } from "./guestSessionService";

const withGuestHeaders = async (headers = {}) => ({
  headers: await guestSessionService.getGuestHeaders(headers),
});

export const guestCheckoutService = {
  saveSession: async (payload) => {
    return apiClient.post(
      "/checkout/guest/session",
      payload,
      await withGuestHeaders(),
    );
  },

  finalize: async (payload) => {
    return apiClient.post(
      "/checkout/guest/finalize",
      payload,
      await withGuestHeaders(),
    );
  },
};

export default guestCheckoutService;
