import toast from "react-hot-toast";

/** Extracts the API's `{ message }`, falling back to a generic sentence. */
export const apiErrorMessage = (error: any) =>
  error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";

/** Standard error handler for API mutations: surfaces the API's message. */
export const handleApiError = (error: any) => {
  toast.error(apiErrorMessage(error));
};
