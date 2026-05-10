import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app, auth } from '../lib/firebase';

const storage = getStorage(app);

export const uploadFile = async (file: File, path: string): Promise<string> => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const normalizedPath = path.replace(/^\/+/, '');
  const fileRef = ref(storage, `users/${auth.currentUser.uid}/${normalizedPath}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
};
