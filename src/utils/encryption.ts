import { Buffer } from 'buffer';
import logger from './logger';

const ENCRYPTION_KEY = 'your-encryption-key'; // This should be stored in Supabase secrets

export const encryptData = async (data: string): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ENCRYPTION_KEY),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      dataBuffer
    );

    const encryptedArray = new Uint8Array(encryptedData);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    return Buffer.from(combined).toString('base64');
  } catch (error) {
    logger.error('Encryption failed', {
      component: 'encryption',
      action: 'encryptData',
      error
    });
    throw error;
  }
};

export const decryptData = async (encryptedData: string): Promise<string> => {
  try {
    const combined = Buffer.from(encryptedData, 'base64');
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ENCRYPTION_KEY),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    logger.error('Decryption failed', {
      component: 'encryption',
      action: 'decryptData',
      error
    });
    throw error;
  }
};