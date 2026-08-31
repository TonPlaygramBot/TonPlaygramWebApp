// Video elements do not use fetch(), so ordinary API CORS success is not
// enough when the web app and API are hosted on different origins. Helmet's
// default CORP header is `same-origin`, which makes a phone browser discard
// an otherwise valid MP4 response from the API host.
export const setFlamingoMediaResponseHeaders = res => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
};
