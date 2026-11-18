import {defineConfig} from 'vitest/config';
export default defineConfig({esbuild:{jsx:'automatic'},test:{environment:'jsdom',include:['src/testnet/*.test.jsx'],environmentOptions:{jsdom:{url:'https://testnet-lab.example/'}}}});
