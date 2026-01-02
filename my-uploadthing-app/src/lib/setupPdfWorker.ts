"use client";
import { pdfjs } from "react-pdf";

// Worker desde CDN (unpkg siempre tiene todas las versiones)
const version = pdfjs.version;
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
