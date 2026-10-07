// What Sentry may collect with an error report. The privacy policy promises reports without form
// contents or personal details, and Sentry collects bodies, cookies and headers unless told not to.
export const sentryPrivacy = () => ({
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent", "referer"] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false
});
