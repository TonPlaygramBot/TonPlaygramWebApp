import { verifyMessage } from 'ethers';
export function verifyEvmSignature(input) {
    const recovered = verifyMessage(input.message, input.signature);
    if (recovered.toLowerCase() !== input.address.toLowerCase()) {
        throw new Error('Invalid EVM signature');
    }
}
