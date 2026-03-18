import toast from "react-hot-toast";

export const notifySuccess = (message, options = {}) =>
  toast.success(message, { duration: 3000, ...options });

export const notifyError = (message, options = {}) =>
  toast.error(message, { duration: 4500, ...options });

export const notifyInfo = (message, options = {}) =>
  toast(message, { duration: 3500, ...options });

export const notifyPromise = (promise, messages, options = {}) =>
  toast.promise(promise, messages, options);

export default {
  notifySuccess,
  notifyError,
  notifyInfo,
  notifyPromise,
};
