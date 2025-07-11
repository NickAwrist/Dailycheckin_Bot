import crypto from 'crypto';
import dotenv from "dotenv";
import logger from "./logger";

dotenv.config();

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY || 'missing', 'utf8');

if(!key || key.toString('utf8') === 'missing'){
    logger.error('!!! Missing encryption key in .env.encryption !!!');
    process.exit(1);
}

const iv = Buffer.alloc(16, 0);

export const encrypt = (data: string): string => {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

export const decrypt = (data: string): string => {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

export const encryptParsedCookies = (parsedCookies: Record<string, string>): Record<string, string> => {
    const encryptedCookies: Record<string, string> = {};
    Object.entries(parsedCookies).forEach(([key, value]) => {
        encryptedCookies[key] = encrypt(value);
    });
    return encryptedCookies;
};