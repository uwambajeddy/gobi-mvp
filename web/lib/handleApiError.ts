import toast from "react-hot-toast";

export const apiErrorMessage = (error: any) =>
  error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";

export const handleApiError = (error: any) => {
  toast.error(apiErrorMessage(error));
};
