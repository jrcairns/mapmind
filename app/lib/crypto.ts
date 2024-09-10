import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export async function encrypt(text: string, password: string): Promise<string> {
    const iv = randomBytes(16);
    const salt = randomBytes(16);
    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    const cipher = createCipheriv('aes-256-ctr', key, iv);
    const encryptedText = Buffer.concat([
        cipher.update(text),
        cipher.final(),
    ]);
    return `${iv.toString('hex')}:${salt.toString('hex')}:${encryptedText.toString('hex')}`;
}

export async function decrypt(encryptedText: string, password: string): Promise<string> {
    const [ivHex, saltHex, encryptedTextHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const salt = Buffer.from(saltHex, 'hex');
    const key = (await scryptAsync(password, salt, 32)) as Buffer;
    const decipher = createDecipheriv('aes-256-ctr', key, iv);
    const decryptedBuffer = Buffer.concat([
        decipher.update(Buffer.from(encryptedTextHex, 'hex')),
        decipher.final(),
    ]);
    return decryptedBuffer.toString();
}