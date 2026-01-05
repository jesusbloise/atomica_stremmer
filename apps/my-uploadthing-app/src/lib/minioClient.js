import { Client } from "minio";

const minioClient = new Client({
  endPoint: "192.168.229.25",
  port: 9000,
  useSSL: false,
  accessKey: "admin",
  secretKey: "admin123",
});

export default minioClient;

