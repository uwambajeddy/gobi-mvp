import toast from "react-hot-toast";

/** Standard error handler for API mutations: surfaces the API's message. */
export const handleApiError = (error: any) => {
  const message =
    error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";
  toast.error(message);
};
