import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

export const env = {
  botToken: process.env.BOT_TOKEN ?? '',
  jwtSecret: required('JWT_SECRET'),
  frontendOrigin: required('FRONTEND_ORIGIN'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  tpcUsdPrice: Number(process.env.TPC_USD_PRICE ?? 0.1),
};
