import { auth, db, storage } from './firebase-config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc, 
  getDoc,
  writeBatch,
  addDoc,
  updateDoc
} from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import { 
  ref, 
  uploadBytesResumable, 
  uploadString,
  getDownloadURL,
  uploadBytes
} from 'firebase/storage';
import { onSnapshot as firestoreOnSnapshot } from 'firebase/firestore';
// Firestore Services
export const getFirestoreCollection = (collectionName: string) => {
  return collection(db, collectionName);
};

export const getFirestoreDoc = (collectionName: string, docId: string) => {
  return doc(db, collectionName, docId);
};

export const createFirestoreQuery = (collectionRef: any, ...queryConstraints: any[]) => {
  return query(collectionRef, ...queryConstraints);
};

export const getFirestoreDocuments = async (queryRef: any) => {
  return await getDocs(queryRef);
};

export const getFirestoreDocument = async (docRef: any) => {
  return await getDoc(docRef);
};

export const addFirestoreDocument = async (collectionRef: any, data: any) => {
  return await addDoc(collectionRef, data);
};

export const updateFirestoreDocument = async (docRef: any, data: any) => {
  return await updateDoc(docRef, data);
};

export const deleteFirestoreDocument = async (docRef: any) => {
  return await deleteDoc(docRef);
};
export const onSnapshot = (query: any, onNext: any, onError: any) => {
    return firestoreOnSnapshot(query, onNext, onError);
  };

export const createFirestoreBatch = () => {
  return writeBatch(db);
};

export const uploadImage = async (base64Image: string, path: string) => {
  try {
    console.log("Iniciando upload de imagem para:", path);
    
    // Remover data URL prefix se existir
    let base64Data = base64Image;
    if (base64Data.includes('data:')) {
      base64Data = base64Data.split(',')[1];
    }
    
    console.log("Tamanho da string base64:", base64Data.length);

    // Criar um arquivo temporário
    const tempFilePath = FileSystem.documentDirectory + 'temp_image.jpg';
    await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
      encoding: FileSystem.EncodingType.Base64
    });

    // Ler o arquivo como blob
    const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
    if (!fileInfo.exists) {
      throw new Error("Arquivo temporário não foi criado");
    }

    // Criar uma referência para o storage
    const storageRef = ref(storage, path);

    // Fazer upload usando uploadBytesResumable
    const response = await fetch(tempFilePath);
    const blob = await response.blob();
    const uploadTask = uploadBytesResumable(storageRef, blob);

    // Esperar o upload terminar
    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progresso opcional
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        },
        (error) => {
          // Erro
          reject(error);
        },
        () => {
          // Completo
          resolve(null);
        }
      );
    });

    // Deletar o arquivo temporário
    await FileSystem.deleteAsync(tempFilePath);

    // Obter a URL de download
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Ficheiro disponível em', downloadURL);
    return downloadURL;

  } catch (error) {
    console.error("Erro ao fazer upload da imagem:", error);
    throw error;
  }
};
// Auth Services
export const getCurrentUser = () => {
  return auth.currentUser;
};

export const getUserId = () => {
  return auth.currentUser?.uid;
};

// Export Firebase instances for special cases
export { auth, db, storage };
