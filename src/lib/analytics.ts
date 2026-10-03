/**
 * Safe wrapper for GA4 events.
 * Avoids PII.
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, params);
  }
};

export const trackStepComplete = (stepName: string, stepIndex: number, program: string) => {
  trackEvent("step_complete", {
    step_name: stepName,
    step_index: stepIndex,
    program_name: program,
  });
};

export const trackPaymentSuccess = (program: string) => {
  trackEvent("payment_success", {
    program_name: program,
    currency: "INR",
    value: 1000,
  });
};
