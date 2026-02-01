import i18n from '../i18n';

/**
 * A wrapper for the fetch API that throws an error on non-2xx responses.
 * This allows .catch() blocks to handle HTTP errors.
 * @param {string} url The URL to fetch.
 * @param {object} options The options for the fetch request.
 * @returns {Promise<Response>} A promise that resolves with the response object.
 */
export const fetchWithErrors = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error('HTTP error');
    error.response = response;
    throw error;
  }
  return response;
};

/**
 * Handles API errors, translates them, and displays an alert.
 * @param {Error} error The error object, potentially containing a response from the server.
 */
export const handleApiError = async (error) => {
  console.error("API Error:", error);

  let messageKey = 'errors.internal.generic'; // Default error message

  if (error.response) {
    try {
      const errorData = await error.response.json();
      if (errorData.error) {
        messageKey = errorData.error;
      }
    } catch (e) {
      console.error("Could not parse error response:", e);
    }
  } else if (error.message === 'Failed to fetch') {
    // Network error
    messageKey = 'errors.internal.networkError'; // Add this key to your translation files
  } else {
    // Other errors
    messageKey = error.message;
  }

  const translatedMessage = i18n.exists(messageKey)
    ? i18n.t(messageKey)
    : messageKey;

  alert(translatedMessage);
};