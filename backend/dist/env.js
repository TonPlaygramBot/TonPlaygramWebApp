import dotenv from 'dotenv';
dotenv.config();
function required(name) {
    const val = process.env[name];
    if (!val)
        throw new Error(`Missing env var: ${name}`);
    return val;
}
export const env = {
    botToken: required('BOT_TOKEN'),
    jwtSecret: required('JWT_SECRET'),
    frontendOrigin: required('FRONTEND_ORIGIN'),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 4000),
};
