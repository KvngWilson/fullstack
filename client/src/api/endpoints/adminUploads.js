import { uploadClient } from "../client";

export const adminUploadsApi = {
  uploadFiles: async (files) => {
    const formData = new FormData();

    Array.from(files || []).forEach((file) => {
      formData.append("files", file);
    });

    const response = await uploadClient.post("/admin/uploads", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response?.data || response || [];
  },
};

export default adminUploadsApi;
