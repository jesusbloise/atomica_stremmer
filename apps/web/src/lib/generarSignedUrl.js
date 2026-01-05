import minioClient from "./minioClient";

export async function generarSignedUrl(fileKey) {
  return new Promise((resolve, reject) => {
    minioClient.presignedGetObject("archivos", fileKey, 7 * 24 * 60 * 60, (err, url) => {
      if (err) return reject(err);
      resolve(url);
    });
  });
}
