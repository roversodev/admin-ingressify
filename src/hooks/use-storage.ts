import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@/api";

export function useStorage() {
  const convex = useConvex();
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: { type: any; }) => {
    try {
      setIsUploading(true);
      
      // Obter URL para upload
      const uploadUrl = await convex.mutation(api.storage.generateUploadUrl);
      
      // Fazer upload do arquivo
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
        },
        body: file as Blob,
      });
      
      if (!result.ok) {
        throw new Error(`Erro ao fazer upload: ${result.statusText}`);
      }
      
      // Obter o ID do arquivo no storage
      const { storageId } = await result.json();
      
      return { success: true, storageId };
    } catch (error) {
      console.error("Erro no upload:", error);
      return { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred' };
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadFile,
    isUploading,
  };
}