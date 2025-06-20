import { HttpsProxyAgent } from 'https-proxy-agent';

export const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
export const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

export function withProxy(options = {}) {
  if (!proxyAgent) return options;
  return { ...options, dispatcher: proxyAgent };
}
